import { describe, test, expect, beforeEach, spyOn } from "bun:test";
import { z } from "zod";
import { BaseTool } from "./tools/base-tool";
import { WebSearch } from "./tools/web-search";

class MockTool extends BaseTool<typeof MockTool.parameters> {
  name = "mock-tool";
  description = "A mock tool for testing";
  static parameters = z.object({
    value: z.string(),
    count: z.number(),
  });
  parameters = MockTool.parameters;

  protected async _execute(
    input: z.infer<typeof MockTool.parameters>
  ) {
    return { success: true, data: input };
  }
}

describe("BaseTool", () => {
  test("rejects invalid params with validation error", async () => {
    const tool = new MockTool();
    const result = await tool.execute({ value: 123, count: "not a number" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Validation failed");
  });

  test("rejects missing required fields", async () => {
    const tool = new MockTool();
    const result = await tool.execute({});

    expect(result.success).toBe(false);
    expect(result.error).toContain("Validation failed");
  });

  test("passes valid params to _execute", async () => {
    const tool = new MockTool();
    const result = await tool.execute({ value: "hello", count: 42 });

    expect(result.success).toBe(true);
    expect(result.data).toEqual({ value: "hello", count: 42 });
  });
});

describe("WebSearch", () => {
  let fetchSpy: ReturnType<typeof spyOn>;

  beforeEach(() => {
    fetchSpy = spyOn(globalThis, "fetch");
  });

  test("returns structured results on successful fetch", async () => {
    const mockHtml = `
      <a class="result__a" href="https://example.com/1">Example Title 1</a>
      <a class="result__snippet">This is a snippet for the first result.</a>
      <a class="result__a" href="https://example.com/2">Example Title 2</a>
      <a class="result__snippet">Snippet for second result here.</a>
    `;

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => mockHtml,
    });

    const tool = new WebSearch();
    const result = await tool.execute({ query: "test search" });

    expect(result.success).toBe(true);
    expect(Array.isArray(result.data)).toBe(true);
    const data = result.data as Array<{ title: string; url: string; snippet: string }>;
    expect(data.length).toBe(2);
    expect(data[0].title).toBe("Example Title 1");
    expect(data[0].url).toBe("https://example.com/1");
    expect(data[0].snippet).toBe("This is a snippet for the first result.");
  });

  test("applies default numResults of 5", async () => {
    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
    });

    const tool = new WebSearch();
    await tool.execute({ query: "test" });

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("count=5")
    );
  });

  test("caps numResults at 10", async () => {
    const result = await new WebSearch().execute({ query: "test", numResults: 20 });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Validation failed");
  });

  test("respects custom SEARCH_API_URL env var", async () => {
    const originalEnv = process.env.SEARCH_API_URL;
    process.env.SEARCH_API_URL = "https://custom.search/api";

    fetchSpy.mockResolvedValue({
      ok: true,
      status: 200,
      statusText: "OK",
      text: async () => "",
    });

    const tool = new WebSearch();
    await tool.execute({ query: "custom" });

    process.env.SEARCH_API_URL = originalEnv;

    expect(fetchSpy).toHaveBeenCalledWith(
      expect.stringContaining("https://custom.search/api")
    );
  });

  test("returns error on network failure", async () => {
    fetchSpy.mockRejectedValue(new Error("Connection refused"));

    const tool = new WebSearch();
    const result = await tool.execute({ query: "test" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("Network error");
  });

  test("returns error on HTTP failure", async () => {
    fetchSpy.mockResolvedValue({
      ok: false,
      status: 500,
      statusText: "Internal Server Error",
    });

    const tool = new WebSearch();
    const result = await tool.execute({ query: "test" });

    expect(result.success).toBe(false);
    expect(result.error).toContain("HTTP 500");
  });
});
