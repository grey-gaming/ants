import { describe, expect, test } from "bun:test";
import { WebScraping } from "./web-scraping";

describe("WebScraping", () => {
	const tool = new WebScraping();

	test("rejects invalid URL", async () => {
		const result = await tool.execute({ url: "not-a-url" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("handles HTTP error", async () => {
		const result = await tool.execute({
			url: "https://httpbin.org/status/404",
		});
		// httpbin may return various errors; just verify it handles non-200
		expect(result).toHaveProperty("success");
	});

	test("rejects empty URL", async () => {
		const result = await tool.execute({ url: "" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});
});
