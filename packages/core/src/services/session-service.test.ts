import { describe, test, expect, beforeEach } from "bun:test";
import { createSessionService } from "./session-service";
import { makeMockDb } from "../../../tests/helpers/fixtures";

describe("session-service", () => {
	let db: ReturnType<typeof makeMockDb>;

	beforeEach(() => {
		db = makeMockDb();
	});

	describe("create", () => {
		test("returns a token string", async () => {
			const service = createSessionService(db);
			const token = await service.create("user1");
			expect(typeof token).toBe("string");
			expect(token.length).toBeGreaterThan(0);
		});

		test("creates two distinct tokens", async () => {
			const service = createSessionService(db);
			const t1 = await service.create("user1");
			const t2 = await service.create("user2");
			expect(t1).not.toBe(t2);
		});
	});

	describe("validate", () => {
		test("returns null for unknown token", async () => {
			const service = createSessionService(db);
			const result = await service.validate("nonexistent");
			expect(result).toBeNull();
		});
	});

	describe("destroy", () => {
		test("succeeds silently", async () => {
			const service = createSessionService(db);
			await service.destroy("some-token");
		});
	});

	describe("destroyByUserId", () => {
		test("succeeds silently", async () => {
			const service = createSessionService(db);
			await service.destroyByUserId("user1");
		});
	});
});
