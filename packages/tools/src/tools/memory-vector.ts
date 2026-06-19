import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

interface MemoryItem {
	id: string;
	content: string;
	tags: string[];
	createdAt: string;
}

const memoryStore = new Map<string, MemoryItem>();

export class MemoryVector extends BaseTool<typeof MemoryVector.parameters> {
	name = "memory-vector";
	description =
		"Store and retrieve information using keyword search. Actions: 'store' (save a memory with optional tags), 'search' (find similar memories by keyword), 'list' (list all memories), 'delete' (remove a memory).";
	static parameters = z.object({
		action: z.enum(["store", "search", "list", "delete"]),
		content: z.string().optional(),
		query: z.string().optional(),
		tags: z.array(z.string()).optional(),
		limit: z.number().int().min(1).max(50).optional(),
		memoryId: z.string().optional(),
	});
	parameters = MemoryVector.parameters;

	protected async _execute(
		input: z.infer<typeof MemoryVector.parameters>,
	): Promise<ToolResult> {
		const { action } = input;

		switch (action) {
			case "store":
				return this.store(input);
			case "search":
				return this.search(input);
			case "list":
				return this.list(input);
			case "delete":
				return this.remove(input);
		}
	}

	private store(input: z.infer<typeof MemoryVector.parameters>): ToolResult {
		if (!input.content?.trim()) {
			return { success: false, error: "content is required for store action" };
		}
		const id = `mem_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
		memoryStore.set(id, {
			id,
			content: input.content.trim(),
			tags: input.tags || [],
			createdAt: new Date().toISOString(),
		});
		return {
			success: true,
			data: { id, content: input.content.trim(), tags: input.tags || [] },
		};
	}

	private search(input: z.infer<typeof MemoryVector.parameters>): ToolResult {
		if (!input.query?.trim()) {
			return { success: false, error: "query is required for search action" };
		}
		const query = input.query.toLowerCase();
		const queryWords = query.split(/\s+/).filter(Boolean);
		const limit = input.limit ?? 10;

		const scored: Array<{ item: MemoryItem; score: number }> = [];

		for (const item of memoryStore.values()) {
			let score = 0;
			const contentLower = item.content.toLowerCase();

			if (contentLower.includes(query)) score += 10;

			for (const word of queryWords) {
				if (contentLower.includes(word)) score += 1;
			}

			if (input.tags) {
				for (const tag of input.tags) {
					if (item.tags.includes(tag)) score += 5;
				}
			}

			if (score > 0) {
				scored.push({ item, score });
			}
		}

		scored.sort((a, b) => b.score - a.score);
		const results = scored.slice(0, limit);

		return {
			success: true,
			data: {
				query: input.query,
				count: results.length,
				results: results.map((r) => ({
					id: r.item.id,
					content: r.item.content,
					tags: r.item.tags,
					score: r.score,
					createdAt: r.item.createdAt,
				})),
			},
		};
	}

	private list(input: z.infer<typeof MemoryVector.parameters>): ToolResult {
		const limit = input.limit ?? 50;
		let all = Array.from(memoryStore.values());
		if (input.tags && input.tags.length > 0) {
			all = all.filter((item) =>
				input.tags!.some((tag) => item.tags.includes(tag)),
			);
		}
		return {
			success: true,
			data: { count: all.length, items: all.slice(0, limit) },
		};
	}

	private remove(input: z.infer<typeof MemoryVector.parameters>): ToolResult {
		if (!input.memoryId) {
			return {
				success: false,
				error: "memoryId is required for delete action",
			};
		}
		if (memoryStore.has(input.memoryId)) {
			memoryStore.delete(input.memoryId);
			return { success: true, data: { deleted: input.memoryId } };
		}
		return { success: false, error: `Memory not found: ${input.memoryId}` };
	}
}
