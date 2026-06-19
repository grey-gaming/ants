import { $db, initDb, runs, threads } from "@ants/store";
import { and, eq, exists, type SQL, sql } from "drizzle-orm";

export function scopeByUserId(userId: string): SQL {
	return eq(threads.userId, userId);
}

export function verifyThreadOwnership(userId: string, threadId: string): SQL {
	return and(eq(threads.id, threadId), eq(threads.userId, userId))!;
}

export function createVerifyRunOwnership(
	userId: string,
	threadId: string,
	runId: string,
): SQL {
	initDb();
	const db = $db!;

	const subquery = db
		.select({ one: sql`1` })
		.from(threads)
		.where(and(eq(threads.id, threadId), eq(threads.userId, userId)))
		.limit(1);

	return and(
		eq(runs.id, runId),
		eq(runs.threadId, threadId),
		exists(subquery),
	) as SQL;
}

export function verifyRunOwnership(
	userId: string,
	threadId: string,
	runId: string,
): SQL {
	return createVerifyRunOwnership(userId, threadId, runId);
}

export function filterByUserId(
	table: { userId: typeof threads.userId },
	userId: string,
): SQL {
	return eq(table.userId, userId);
}
