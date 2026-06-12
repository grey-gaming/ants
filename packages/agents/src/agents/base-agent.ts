import type { Message } from "@ants/llm";
import type { Tool } from "@ants/tools";
import type { Agent, AgentDefinition, AgentResult } from "../types/agent";
import { ValidationError, logger, estimateTokens } from "@ants/core";

export abstract class BaseAgent implements Agent {
  public name: string;
  public description: string;

  constructor(def: AgentDefinition) {
    if (!def.name.trim()) {
      throw new ValidationError("Agent name must not be empty");
    }
    if (!def.description.trim()) {
      throw new ValidationError("Agent description must not be empty");
    }
    this.name = def.name;
    this.description = def.description;
  }

  async run(messages: Message[], tools: Tool[]): Promise<AgentResult> {
    logger.info("agents", `Running agent "${this.name}" with ${messages.length} message(s)`);
    const result = await this._execute(messages, tools);
    const tokens = estimateTokens(result.content);
    logger.info("agents", `${this.name} produced ${result.content.length} char(s) of output`);
    return {
      ...result,
      tokensUsed: Math.max(tokens, 1),
    };
  }

  protected abstract _execute(messages: Message[], tools: Tool[]): Promise<AgentResult>;
}
