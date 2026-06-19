import { describe, expect, test } from "bun:test";
import { MemoryVector } from "./memory-vector";

describe("MemoryVector", () => {
	const tool = new MemoryVector();

	test("store memory", async () => {
		const result = await tool.execute({
			action: "store",
			content: "The sky is blue",
			tags: ["nature", "color"],
		});
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.id).toBeDefined();
		expect(data.content).toBe("The sky is blue");
	});

	test("store requires content", async () => {
		const result = await tool.execute({ action: "store" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("content is required");
	});

	test("search memories", async () => {
		// Store first
		await tool.execute({
			action: "store",
			content: "I love programming in TypeScript",
			tags: ["coding"],
		});
		await tool.execute({
			action: "store",
			content: "Python is also great",
			tags: ["coding"],
		});
		await tool.execute({
			action: "store",
			content: "The weather is nice",
			tags: ["weather"],
		});

		const result = await tool.execute({
			action: "search",
			query: "programming",
		});
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.count).toBeGreaterThan(0);
		expect(data.results[0].content).toContain("programming");
	});

	test("search requires query", async () => {
		const result = await tool.execute({ action: "search" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("query is required");
	});

	test("list all memories", async () => {
		const result = await tool.execute({ action: "list" });
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data).toHaveProperty("count");
		expect(data).toHaveProperty("items");
	});

	test("delete memory", async () => {
		const storeResult = await tool.execute({
			action: "store",
			content: "Temp memory",
		});
		const id = (storeResult.data as any).id;

		const deleteResult = await tool.execute({ action: "delete", memoryId: id });
		expect(deleteResult.success).toBe(true);

		// Verify deleted
		const listResult = await tool.execute({ action: "list" });
		const items = (listResult.data as any).items;
		expect(items.some((item: any) => item.id === id)).toBe(false);
	});

	test("delete requires memoryId", async () => {
		const result = await tool.execute({ action: "delete" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("memoryId is required");
	});

	test("delete non-existent memory", async () => {
		const result = await tool.execute({
			action: "delete",
			memoryId: "nonexistent",
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});
});
