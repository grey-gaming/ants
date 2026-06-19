import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { WebSearch } from "./web-search";

describe("WebSearch", () => {
	let originalFetch: typeof globalThis.fetch;

	function mockFetchResponse(body: unknown) {
		return {
			ok: true,
			status: 200,
			statusText: "OK",
			text: async () => "",
			json: async () => body,
			preconnect: async () => {},
		};
	}

	beforeEach(() => {
		originalFetch = globalThis.fetch;
		// Clear SEARCH_API_URL to prevent test pollution
		delete process.env.SEARCH_API_URL;
	});

	afterEach(() => {
		globalThis.fetch = originalFetch;
		if (process.env.SEARCH_API_URL !== undefined) {
			process.env.SEARCH_API_URL = process.env.SEARCH_API_URL;
		} else {
			delete process.env.SEARCH_API_URL;
		}
	});
	test("returns structured results on successful fetch", async () => {
		// DuckDuckGo returns 3 results: instant answer + 2 related topics
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

		const calls: string[] = [];

		const mockFetch = async (url: string) => {
			calls.push(url);
			if (typeof url === "string" && url.includes("api.duckduckgo.com")) {
				return mockFetchResponse(duckDuckGoResult);
			}
			// Wikipedia returns empty
			return mockFetchResponse({});
		};
		mockFetch.preconnect = async () => {};
		globalThis.fetch = mockFetch as any;

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
		expect(data[1].title).toBe("Related topic 1");
		expect(data[1].url).toBe("https://example.com/1");
		expect(data[1].snippet).toBe("Snippet 1");
		expect(data[2].title).toBe("Related topic 2");
		expect(data[2].url).toBe("https://example.com/2");
		expect(data[2].snippet).toBe("Snippet 2");
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

		const wikiTitles = ["Wiki A", "Wiki B", "Wiki C", "Wiki D", "Wiki E"];
		const wikiURLs = wikiTitles.map((_, i) => `https://example.com/wiki/${i}`);
		const wikiResult = [
			"test",
			wikiTitles,
			wikiTitles.map((t) => `Description of ${t}`),
			wikiURLs,
		];

		const calls: string[] = [];

		const mockFetch2 = async (url: RequestInfo | URL) => {
			if (typeof url === "string") {
				calls.push(url);
			}
			if (typeof url === "string" && url.includes("api.duckduckgo.com")) {
				return mockFetchResponse(duckDuckGoResult);
			}
			if (typeof url === "string" && url.includes("en.wikipedia.org")) {
				return mockFetchResponse(wikiResult);
			}
			return mockFetchResponse({ results: [] });
		};
		mockFetch2.preconnect = async () => {};
		globalThis.fetch = mockFetch2 as any;

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

		// Verify limit=5 was used in Wikipedia API call
		expect(calls.some((c) => c.includes("limit=5"))).toBe(true);
	});

	test("respects custom SEARCH_API_URL env var", async () => {
		const originalEnv = process.env.SEARCH_API_URL;
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

		const calls: string[] = [];

		const mockFetch3 = async (url: RequestInfo | URL) => {
			if (typeof url === "string") {
				calls.push(url);
			}
			if (typeof url === "string" && url.includes("api.duckduckgo.com")) {
				return mockFetchResponse(duckDuckGoResult);
			}
			if (typeof url === "string" && url.includes("en.wikipedia.org")) {
				return mockFetchResponse(wikiResult);
			}
			if (typeof url === "string" && url.includes("custom.search")) {
				return mockFetchResponse(searxResult);
			}
			return mockFetchResponse({});
		};
		mockFetch3.preconnect = async () => {};
		globalThis.fetch = mockFetch3 as any;

		const tool = new WebSearch();
		const result = await tool.execute({ query: "custom" });

		expect(result.success).toBe(true);
		expect(Array.isArray(result.data)).toBe(true);
		const data = result.data as Array<{
			title: string;
			url: string;
			snippet: string;
		}>;
		expect(data.length).toBeGreaterThanOrEqual(3);

		// Verify SearXNG endpoint was called
		expect(calls.some((c) => c.includes("https://custom.search/api"))).toBe(
			true,
		);

		process.env.SEARCH_API_URL = originalEnv;
	});

	test("returns error on network failure", async () => {
		const mockFetchErr = async () => {
			throw new Error("ECONNREFUSED");
		};
		mockFetchErr.preconnect = async () => {};
		globalThis.fetch = mockFetchErr as any;

		const tool = new WebSearch();
		const result = await tool.execute({ query: "test" });

		expect(result.success).toBe(false);
		expect(result.error).toContain("Network error");
	});

	test("returns error on HTTP failure", async () => {
		const mockFetchHttp = async () => {
			throw new Error("ERR_LINE_BREAK");
		};
		mockFetchHttp.preconnect = async () => {};
		globalThis.fetch = mockFetchHttp as any;

		const tool = new WebSearch();
		const result = await tool.execute({ query: "test" });

		expect(result.success).toBe(false);
		expect(result.error).toContain("Network error");
	});
});
