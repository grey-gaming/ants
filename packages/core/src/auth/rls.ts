import { eq, and, type SQL } from "drizzle-orm";
import { threads, runs } from "@ants/store";

export function scopeByUserId(userId: string): SQL {
  return eq(threads.userId, userId);
}

export function verifyThreadOwnership(userId: string, threadId: string): SQL {
  return and(eq(threads.id, threadId), eq(threads.userId, userId))!;
}

export function verifyRunOwnership(userId: string, threadId: string, runId: string): SQL {
  return and(
    eq(runs.id, runId),
    eq(runs.threadId, threadId),
    eq(threads.userId, userId),
  )!;
}

export function filterByUserId(table: { userId: typeof threads.userId }, userId: string): SQL {
  return eq(table.userId, userId);
}
