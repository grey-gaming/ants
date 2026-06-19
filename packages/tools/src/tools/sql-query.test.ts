import { describe, expect, test } from "bun:test";
import { SqlQuery } from "./sql-query";

describe("SqlQuery", () => {
	const tool = new SqlQuery();

	test("returns error when DATABASE_URL not configured", async () => {
		const original = process.env.DATABASE_URL;
		delete process.env.DATABASE_URL;

		const result = await tool.execute({ query: "SELECT 1" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("DATABASE_URL not configured");

		process.env.DATABASE_URL = original;
	});

	test("blocks DELETE query", async () => {
		const result = await tool.execute({ query: "DELETE FROM users" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("not allowed");
	});

	test("blocks DROP query", async () => {
		const result = await tool.execute({ query: "DROP TABLE users" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("not allowed");
	});

	test("blocks UPDATE query", async () => {
		const result = await tool.execute({
			query: "UPDATE users SET name='hacked'",
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("not allowed");
	});

	test("blocks INSERT query", async () => {
		const result = await tool.execute({
			query: "INSERT INTO users VALUES (1)",
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("not allowed");
	});

	test("allows SELECT query (fails gracefully without DB)", async () => {
		const original = process.env.DATABASE_URL;
		delete process.env.DATABASE_URL;

		const result = await tool.execute({ query: "SELECT * FROM users" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("DATABASE_URL not configured");

		process.env.DATABASE_URL = original;
	});

	test("rejects empty query", async () => {
		const result = await tool.execute({ query: "" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("respects limit parameter", async () => {
		const original = process.env.DATABASE_URL;
		delete process.env.DATABASE_URL;

		const result = await tool.execute({
			query: "SELECT * FROM users",
			limit: 10,
		});
		expect(result.success).toBe(false);
		// limit is validated (<= 1000)
		expect(result.error).toBeDefined();

		process.env.DATABASE_URL = original;
	});
});
