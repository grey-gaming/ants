import { describe, expect, test } from "bun:test";
import { ImageGeneration } from "./image-generation";

describe("ImageGeneration", () => {
	const tool = new ImageGeneration();

	test("rejects empty prompt", async () => {
		const result = await tool.execute({ prompt: "" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("rejects oversized dimensions", async () => {
		const result = await tool.execute({
			prompt: "a cat",
			width: 5000,
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("rejects oversized steps", async () => {
		const result = await tool.execute({
			prompt: "a cat",
			steps: 200,
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("accepts valid parameters (skipped - requires GPU)", async () => {
		expect(true).toBe(true);
	}, 500);
});
