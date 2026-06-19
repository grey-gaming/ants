import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { z } from "zod";
import { toolRegistry } from "./registry";
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

	protected async _execute(input: z.infer<typeof MockTool.parameters>) {
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
	let fetchCalls: string[];
	let savedSearchApiUrl: string | undefined;

	function mockJsonResponse(body: unknown) {
		return {
			ok: true,
			status: 200,
			statusText: "OK",
			text: async () => "",
			json: async () => body,
		};
	}

	beforeEach(() => {
		fetchCalls = [];
		savedSearchApiUrl = process.env.SEARCH_API_URL;
		delete process.env.SEARCH_API_URL;
		fetchSpy = spyOn(globalThis, "fetch");
	});

	afterEach(() => {
		if (savedSearchApiUrl !== undefined) {
			process.env.SEARCH_API_URL = savedSearchApiUrl;
		}
		fetchSpy.mockRestore();
	});

	test("returns structured results on successful fetch", async () => {
		const duckDuckGoResult = {
			Abstract: "Test abstract answer",
			AbstractURL: "https://example.com/abstract",
			AbstractSource: "Wikipedia",
			Heading: "Test Heading",
			RelatedTopics: [
				{
					Text: "Related topic 1",
					FirstURL: "https://example.com/1",
					FirstParagraphString: "Snippet 1",
				},
				{
					Text: "Related topic 2",
					FirstURL: "https://example.com/2",
					FirstParagraphString: "Snippet 2",
				},
			],
		};

		fetchSpy.mockImplementation(async (url: string) => {
			if (typeof url === "string") {
				fetchCalls.push(url);
			}
			if (typeof url === "string" && url.includes("api.duckduckgo.com")) {
				return mockJsonResponse(duckDuckGoResult);
			}
			return mockJsonResponse({});
		});

		const tool = new WebSearch();
		const result = await tool.execute({ query: "test search" });

		expect(result.success).toBe(true);
		expect(Array.isArray(result.data)).toBe(true);
		const data = result.data as Array<{
			title: string;
			url: string;
			snippet: string;
		}>;
		expect(data.length).toBe(3);
		expect(data[0].title).toBe("Test Heading");
		expect(data[0].url).toBe("https://example.com/abstract");
		expect(data[0].snippet).toBe("Test abstract answer");
	});

	test("applies default numResults of 5", async () => {
		const duckDuckGoResult = {
			Abstract: "Duck answer",
			AbstractURL: "https://example.com/abstract",
			Heading: "Duck Heading",
			RelatedTopics: [
				{
					Text: "Related 1",
					FirstURL: "https://example.com/1",
					FirstParagraphString: "Snippet 1",
				},
			],
		};
		const wikiResult = [
			"test",
			["A", "B", "C", "D", "E"],
			["Desc A", "Desc B", "Desc C", "Desc D", "Desc E"],
			[
				"https://example.com/1",
				"https://example.com/2",
				"https://example.com/3",
				"https://example.com/4",
				"https://example.com/5",
			],
		];

		fetchSpy.mockImplementation(async (url: string) => {
			if (typeof url === "string") {
				fetchCalls.push(url);
			}
			if (typeof url === "string" && url.includes("api.duckduckgo.com")) {
				return mockJsonResponse(duckDuckGoResult);
			}
			if (typeof url === "string" && url.includes("en.wikipedia.org")) {
				return mockJsonResponse(wikiResult);
			}
			return mockJsonResponse({ results: [] });
		});

		const tool = new WebSearch();
		const result = await tool.execute({ query: "test" });

		expect(result.success).toBe(true);
		expect(Array.isArray(result.data)).toBe(true);
		const data = result.data as Array<{
			title: string;
			url: string;
			snippet: string;
		}>;
		expect(data.length).toBe(5);
		expect(fetchCalls.some((c) => c.includes("limit=5"))).toBe(true);
	});

	test("caps numResults at 10", async () => {
		const result = await new WebSearch().execute({
			query: "test",
			numResults: 20,
		});

		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("respects custom SEARCH_API_URL env var", async () => {
		process.env.SEARCH_API_URL = "https://custom.search/api";

		const duckDuckGoResult = {
			Abstract: "Duck answer",
			AbstractURL: "https://example.com/abstract",
			Heading: "Duck Heading",
		};
		const wikiResult = [
			"test",
			["Wiki A", "Wiki B"],
			["Description A", "Description B"],
			["https://example.com/wiki/1", "https://example.com/wiki/2"],
		];
		const searxResult = {
			results: [
				{
					title: "SearXNG Result",
					url: "https://custom.search/result",
					content: "From SearXNG",
				},
			],
		};

		fetchSpy.mockImplementation(async (url: string) => {
			if (typeof url === "string") {
				fetchCalls.push(url);
			}
			if (typeof url === "string" && url.includes("api.duckduckgo.com")) {
				return mockJsonResponse(duckDuckGoResult);
			}
			if (typeof url === "string" && url.includes("en.wikipedia.org")) {
				return mockJsonResponse(wikiResult);
			}
			if (typeof url === "string" && url.includes("custom.search")) {
				return mockJsonResponse(searxResult);
			}
			return mockJsonResponse({});
		});

		const tool = new WebSearch();
		const result = await tool.execute({ query: "custom" });

		expect(result.success).toBe(true);
		expect(Array.isArray(result.data)).toBe(true);
		expect(
			fetchCalls.some((c) => c.includes("https://custom.search/api")),
		).toBe(true);
	});

	test("returns error on network failure", async () => {
		fetchSpy.mockRejectedValue(new Error("Connection refused"));

		const tool = new WebSearch();
		const result = await tool.execute({ query: "test" });

		expect(result.success).toBe(false);
		expect(result.error).toContain("Network error");
	});

	test("returns error on HTTP failure", async () => {
		fetchSpy.mockRejectedValue(new Error("ERR_LINE_BREAK"));

		const tool = new WebSearch();
		const result = await tool.execute({ query: "test" });

		expect(result.success).toBe(false);
		expect(result.error).toContain("Network error");
	});
});

describe("Tool Registry", () => {
	const expectedTools = [
		"web-search",
		"calculator",
		"time-date",
		"file-read-write",
		"shell-command",
		"code-execution",
		"web-scraping",
		"memory-vector",
		"sql-query",
		"weather",
		"image-generation",
	];

	test("has all 11 tools registered", () => {
		const all = toolRegistry.getAll();
		expect(all.length).toBe(expectedTools.length);
		for (const name of expectedTools) {
			expect(toolRegistry.has(name)).toBe(true);
		}
	});

	test("getAll returns tool definitions", () => {
		const all = toolRegistry.getAll();
		for (const entry of all) {
			expect(entry.definition.name).toBeDefined();
			expect(entry.definition.description).toBeDefined();
			expect(entry.definition.parameters).toBeDefined();
		}
	});

	test("get returns correct tool by name", () => {
		const calc = toolRegistry.get("calculator");
		expect(calc).toBeDefined();
		expect(calc!.definition.name).toBe("calculator");
	});

	test("get returns undefined for unknown tool", () => {
		const unknown = toolRegistry.get("nonexistent-tool");
		expect(unknown).toBeUndefined();
	});

	test("execute delegates to correct tool", async () => {
		const result = await toolRegistry.execute("calculator", {
			expression: "2 + 2",
		});
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(4);
	});

	test("execute returns error for unknown tool", async () => {
		const result = await toolRegistry.execute("nonexistent", {});
		expect(result.success).toBe(false);
		expect(result.error).toContain("Unknown tool");
	});

	test("zodToJsonSchema converts schema correctly", () => {
		const schema = toolRegistry.zodToJsonSchema(
			z.object({
				name: z.string(),
				age: z.number(),
				active: z.boolean().optional(),
			}),
		);
		expect(schema.type).toBe("object");
		expect((schema.properties as any).name.type).toBe("string");
		expect((schema.properties as any).age.type).toBe("number");
		expect(schema.required).toContain("name");
		expect(schema.required).toContain("age");
		expect(schema.required).not.toContain("active");
	});
});
