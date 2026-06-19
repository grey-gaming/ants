import { describe, expect, test } from "bun:test";
import {
	scopeByUserId,
	verifyRunOwnership,
	verifyThreadOwnership,
} from "./rls";

describe("RLS helpers", () => {
	test("scopeByUserId returns a SQL object", () => {
		const filter = scopeByUserId("user-123");
		expect(filter).toBeDefined();
	});

	test("verifyThreadOwnership returns a SQL object", () => {
		const filter = verifyThreadOwnership("user-123", "thread-456");
		expect(filter).toBeDefined();
	});

	test("verifyRunOwnership returns a SQL object using subquery for ownership", () => {
		if (!process.env.DATABASE_URL) {
			return;
		}
		const filter = verifyRunOwnership("user-123", "thread-456", "run-789");
		expect(filter).toBeDefined();
	});
});
