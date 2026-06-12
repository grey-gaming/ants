import type { Message } from "@ants/llm";
import type { Tool, ToolResult } from "@ants/tools";
import type { AgentResult } from "../types/agent";
import { BaseAgent } from "./base-agent";
import { ValidationError, logger } from "@ants/core";

export class ResearchAgent extends BaseAgent {
  private tool: Tool;

  constructor(tool: Tool) {
    super({
      name: "research",
      description: "Research agent that performs web searches and summarizes results",
    });
    this.tool = tool;
  }

  protected async _execute(messages: Message[], _tools: Tool[]): Promise<AgentResult> {
    if (!messages.length) {
      throw new ValidationError("At least one message is required");
    }

    const query = messages[messages.length - 1]?.content.trim();

    if (!query) {
      throw new ValidationError("Query must not be empty");
    }

    logger.info("agents", `${this.name} executing search for: ${query}`);

    const result = await this.tool.execute({ query });
    logger.info("agents", `${this.name} search completed`);

    return {
      content: `Research result for "${query}" - ${JSON.stringify(result)}`,
      metadata: {
        query,
        tool: this.tool.name,
        result,
      },
      tokensUsed: 0,
    };
  }
}
