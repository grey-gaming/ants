import { afterEach, describe, expect, test } from "bun:test";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";
import { createUserService } from "./user-service";

// ─── Mock DB builder (same pattern as thread-service.test.ts) ───────────────

// Values captured during a DB call so tests can assert on them
let capturedInsertValues: Record<string, unknown> | null = null;
let capturedUpdateValues: Record<string, unknown> | null = null;
let capturedDelete = false;

function resetCaptures() {
	capturedInsertValues = null;
	capturedUpdateValues = null;
	capturedDelete = false;
}

function makeMockDb(opts: {
	selectRows?: unknown[];
	insertRows?: unknown[];
	updateRows?: unknown[];
	insertThrows?: boolean;
} = {}) {
	const {
		selectRows = [],
		insertRows = [{ id: "new-user-id", createdAt: new Date() }],
		updateRows = [{ id: "updated-id", updatedAt: new Date() }],
		insertThrows = false,
	} = opts;

	return {
		insert: () => ({
			values: (vals: Record<string, unknown>) => {
				capturedInsertValues = { ...vals };
				const ret = {
					returning: async () => {
						if (insertThrows) throw new Error("23505");
						return insertRows;
					},
				};
				return ret;
			},
		}),
		select: () => ({
			from: () => {
				const base = Promise.resolve(selectRows) as Promise<unknown[]> & {
					limit: (n: number) => Promise<unknown[]>;
					orderBy: () => { limit: (n: number) => Promise<unknown[]> };
				};
				base.limit = (n: number) => Promise.resolve(selectRows.slice(0, n));
				const orderByChain = {
					limit: (n: number) => Promise.resolve(selectRows.slice(0, n)),
				};
				base.orderBy = () => orderByChain;
				return {
					where: () => base,
					orderBy: () => orderByChain,
				};
			},
		}),
		update: () => ({
			set: (vals: Record<string, unknown>) => {
				capturedUpdateValues = { ...vals };
				const ret = {
					where: async () => [],
					returning: async () => updateRows,
				};
				return ret;
			},
		}),
		delete: () => ({
			where: async () => {
				capturedDelete = true;
			},
		}),
	} as never;
}

afterEach(resetCaptures);

// ─── Tests ──────────────────────────────────────────────────────────────────

describe("user-service", () => {
	describe("create", () => {
		test("creates a user and returns it", async () => {
			const db = makeMockDb();
			const service = createUserService(db);

			const user = await service.create("test@example.com", "Test User", "password123");

			expect(user.id).toBe("new-user-id");
			expect(capturedInsertValues).toMatchObject({
				email: "test@example.com",
				name: "Test User",
			});
		});

		test("normalizes email to lowercase", async () => {
			const db = makeMockDb();
			const service = createUserService(db);

			await service.create("TEST@EXAMPLE.COM", "Test User", "password123");

			expect(capturedInsertValues?.email).toBe("test@example.com");
		});

		test("throws ValidationError for empty email", async () => {
			const db = makeMockDb();
			const service = createUserService(db);

			await expect(
				service.create("", "Test User", "password123"),
			).rejects.toThrow(ValidationError);
		});

		test("throws ValidationError for whitespace-only email", async () => {
			const db = makeMockDb();
			const service = createUserService(db);

			await expect(
				service.create("   ", "Test User", "password123"),
			).rejects.toThrow(ValidationError);
		});

		test("throws ValidationError for empty name", async () => {
			const db = makeMockDb();
			const service = createUserService(db);

			await expect(
				service.create("test@example.com", "", "password123"),
			).rejects.toThrow(ValidationError);
		});

		test("throws ValidationError for short password", async () => {
			const db = makeMockDb();
			const service = createUserService(db);

			await expect(
				service.create("test@example.com", "Test User", "abcde"),
			).rejects.toThrow(ValidationError);
		});

		test("throws ConflictError on duplicate email", async () => {
			const db = makeMockDb({ insertThrows: true });
			const service = createUserService(db);

			await expect(
				service.create("test@example.com", "Test User", "password123"),
			).rejects.toThrow(ConflictError);
		});
	});

	describe("findByEmail", () => {
		test("returns null when no user found", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createUserService(db);

			const result = await service.findByEmail("nobody@example.com");
			expect(result).toBeNull();
		});
	});

	describe("getById", () => {
		test("returns null when user not found", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createUserService(db);

			const result = await service.getById("nonexistent-id");
			expect(result).toBeNull();
		});
	});

	describe("getCurrentUser", () => {
		test("throws NotFoundError when user not found", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createUserService(db);

			await expect(
				service.getCurrentUser("nonexistent-id"),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("update", () => {
		test("throws NotFoundError for non-existent user", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createUserService(db);

			await expect(
				service.update("nonexistent-id", { name: "New Name" }),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("deactivate", () => {
		test("throws NotFoundError for non-existent user", async () => {
			const db = makeMockDb({ selectRows: [] });
			const service = createUserService(db);

			await expect(
				service.deactivate("nonexistent-id", "admin-id"),
			).rejects.toThrow(NotFoundError);
		});
	});

	describe("list", () => {
		test("returns list with specified limit", async () => {
			const rows = [
				{ id: "1", createdAt: new Date() },
				{ id: "2", createdAt: new Date() },
			];
			const db = makeMockDb({ selectRows: rows });
			const service = createUserService(db);

			const results = await service.list("admin-id", { limit: 1 });
			expect(results.length).toBe(1);
		});
	});

	describe("verifyPassword", () => {
		test("delegates to bcrypt.compare", async () => {
			const db = makeMockDb();
			const service = createUserService(db);

			const user = {
				id: "u1",
				email: "test@example.com",
				name: "Test",
				passwordHash: "$2a$12$somehash",
				emailVerified: false,
				emailVerificationToken: null,
				emailVerificationTokenExpiry: null,
				passwordResetToken: null,
				passwordResetTokenExpiry: null,
				createdAt: new Date(),
				updatedAt: new Date(),
			};
			// bcryptjs.compare will run; we just verify no crash
			const result = await service.verifyPassword(user, "some-password");
			expect(typeof result).toBe("boolean");
		});
	});
});
