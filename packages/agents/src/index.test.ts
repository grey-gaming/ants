import type { Tool, ToolResult } from "@ants/tools";
import type { Message } from "@ants/llm";
import type { AgentResult } from "./types/agent";
import { BaseAgent } from "./agents/base-agent";
import { ResearchAgent } from "./agents/research-agent";
import { ValidationError, estimateTokens } from "@ants/core";
import { describe, test, expect, beforeEach } from "bun:test";

class TestAgent extends BaseAgent {
  protected async _execute(messages: Message[], _tools: Tool[]): Promise<AgentResult> {
    return {
      content: "test response",
      metadata: {},
      tokensUsed: estimateTokens(messages.map((m) => m.content).join(" ")),
    };
  }
}

const makeMessage = (content: string): Message => ({
  role: "user",
  content,
});

describe("BaseAgent", () => {
  test("executes and returns result with tokens", async () => {
    const agent = new TestAgent({ name: "test", description: "test agent" });
    const result = await agent.run([makeMessage("hello")], []);
    expect(result.content).toBe("test response");
    expect(result.tokensUsed).toBeGreaterThan(0);
  });
});

describe("ResearchAgent", () => {
  let mockTool: Tool;

  beforeEach(() => {
    mockTool = {
      name: "web_search",
      description: "Mock search tool",
      execute: async () =>
        ({
          success: true,
          data: "Mock search results",
        }) as ToolResult,
    };
  });

  test("executes search with provided tool", async () => {
    const agent = new ResearchAgent(mockTool);
    const result = await agent.run([makeMessage("test query")], [mockTool]);
    expect(result.content).toContain("test query");
    expect(result.content).toContain("Mock search results");
    expect(result.metadata).toHaveProperty("query", "test query");
  });

  test("requires at least one message", () => {
    const agent = new ResearchAgent(mockTool);
    expect(async () => await agent.run([], [mockTool])).toThrow(ValidationError);
  });

  test("requires non-empty query", () => {
    const agent = new ResearchAgent(mockTool);
    expect(async () => await agent.run([makeMessage("  ")], [mockTool])).toThrow(ValidationError);
  });
});
