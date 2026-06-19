import { beforeEach, describe, expect, test } from "bun:test";
import { createSettingsService } from "./settings-service";

// ─── Mock DB builder ─────────────────────────────────────────────────────────

let selectRows: unknown[] = [];
let insertedValues: Record<string, unknown> | null = null;
let updatedValues: Record<string, unknown> | null = null;

function resetState() {
	selectRows = [];
	insertedValues = null;
	updatedValues = null;
}

function makeMockDb(opts: {
	selectRows?: unknown[];
	insertRows?: unknown[];
	updateRows?: unknown[];
} = {}) {
	selectRows = opts.selectRows ?? [];
	const insertRows = opts.insertRows ?? [
		{ id: "new-setting-id", key: "test-key", value: {}, createdAt: new Date() },
	];
	const updateRows = opts.updateRows ?? [
		{ id: "existing-setting-id", key: "test-key", value: {}, updatedAt: new Date() },
	];

	return {
		insert: () => ({
			values: (vals: Record<string, unknown>) => {
				insertedValues = { ...vals };
				return {
					returning: async () => insertRows,
				};
			},
		}),
		select: () => ({
			from: () => {
				const base = Promise.resolve(selectRows) as Promise<unknown[]> & {
					limit: (n: number) => Promise<unknown[]>;
					orderBy: () => Promise<unknown[]>;
				};
				base.limit = (n: number) => Promise.resolve(selectRows.slice(0, n));
				base.orderBy = () => Promise.resolve(selectRows);
				return Object.assign(base, {
					where: () => base,
					orderBy: () => Promise.resolve(selectRows),
				});
			},
		}),
		update: () => ({
			set: (vals: Record<string, unknown>) => {
				updatedValues = { ...vals };
				return {
					where: () => ({
						returning: async () => updateRows,
					}),
				};
			},
		}),
		delete: () => ({
			where: async () => {},
		}),
	} as never;
}

beforeEach(resetState);

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("settings-service", () => {
	describe("getAll", () => {
		test("returns all settings", async () => {
			const rows = [
				{ id: "1", key: "a", value: { x: 1 } },
				{ id: "2", key: "b", value: { y: 2 } },
			];
			const db = makeMockDb({ selectRows: rows });
			const service = createSettingsService(db);

			const results = await service.getAll();
			expect(results.length).toBe(2);
			expect(results[0]).toMatchObject({ id: "1", key: "a" });
		});

		test("returns empty array when no settings", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createSettingsService(db);

			const results = await service.getAll();
			expect(results).toEqual([]);
		});
	});

	describe("getByKey", () => {
		test("returns null when key does not exist", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createSettingsService(db);

			const result = await service.getByKey("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("upsert", () => {
		test("inserts a new setting when not found", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createSettingsService(db);

			const result = await service.upsert({
				key: "theme",
				value: { mode: "dark" },
			});

			expect(result.id).toBe("new-setting-id");
			expect(insertedValues).toMatchObject({
				key: "theme",
				value: { mode: "dark" },
				isGlobal: false,
			});
		});

		test("inserts with userId when provided", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createSettingsService(db);

			await service.upsert({
				key: "user-theme",
				value: { mode: "light" },
				userId: "user-123",
			});

			expect(insertedValues).toMatchObject({
				userId: "user-123",
			});
		});

		test("updates existing global setting when found", async () => {
			const existingSetting = {
				id: "existing-setting-id",
				key: "theme",
				value: { mode: "light" },
				isGlobal: true,
			};
			const db = makeMockDb({ selectRows: [existingSetting] });
			const service = createSettingsService(db);

			const result = await service.upsert({
				key: "theme",
				value: { mode: "dark" },
				isGlobal: true,
			});

			expect(result.id).toBe("existing-setting-id");
		});

		test("inserts new global setting when none found", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createSettingsService(db);

			await service.upsert({
				key: "global-theme",
				value: { mode: "dark" },
				isGlobal: true,
			});

			expect(insertedValues).toMatchObject({
				key: "global-theme",
				isGlobal: true,
			});
		});
	});

	describe("remove", () => {
		test("does nothing when key does not exist", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createSettingsService(db);

			// Should not throw
			await service.remove("nonexistent");
		});
	});
});
