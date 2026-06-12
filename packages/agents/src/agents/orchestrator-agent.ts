import type { Message } from "@ants/llm";
import type { Tool } from "@ants/tools";
import type { AgentResult } from "../types/agent";
import { BaseAgent } from "./base-agent";
import { ValidationError, NotFoundError, logger } from "@ants/core";

type Tier = "T2" | "T3";

const TIER_AGENT_MAP: Record<Tier, string> = {
  T2: "orchestrator",
  T3: "research",
};

export class OrchestratorAgent extends BaseAgent {
  private delegate: BaseAgent | null = null;

  setAgent(delegate: BaseAgent) {
    this.delegate = delegate;
  }

  protected async _execute(messages: Message[], tools: Tool[]): Promise<AgentResult> {
    if (!messages.length) {
      throw new ValidationError("At least one message is required");
    }

    if (!this.delegate) {
      throw new ValidationError("No delegate agent configured");
    }

    const tier = messages.length > 0 && messages[messages.length - 1].content.includes("T2") ? "T2" : "T3";
    logger.info("agents", `${this.name} delegating to ${this.delegate.name} for tier ${tier}`);

    const result = await this.delegate.run(messages, tools);
    logger.info("agents", `${this.name} delegation complete`);

    return {
      ...result,
      metadata: {
        ...result.metadata,
        delegate: this.delegate.name,
        tier,
      },
      tokensUsed: result.tokensUsed,
    };
  }
}
