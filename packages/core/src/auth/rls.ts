import { eq, and } from 'drizzle-orm';
import { threads, runs } from '@ants/store';
import { NotFoundError } from '../lib/errors';

/**
 * Build a WHERE clause filtering a user-scoped table to a specific userId.
 */
export function scopeByUserId(table: { userId: any }, userId: string) {
  return eq(table.userId, userId);
}

/**
 * Verify a thread exists and belongs to the given user.
 * Throws NotFoundError if the thread is missing or does not belong to the user.
 */
export async function verifyThreadOwnership(threadId: string, userId: string): Promise<void> {
  const { $db } = await import('@ants/store');

  if (!$db) throw new Error('Database not initialized');

  const result = await $db
    .select()
    .from(threads)
    .where(and(eq(threads.id, threadId), eq(threads.userId, userId)));

  if (result.length === 0) {
    throw new NotFoundError('Thread', threadId);
  }
}

/**
 * Verify a run exists and belongs to a thread owned by the given user.
 */
export async function verifyRunOwnership(runId: string, userId: string): Promise<void> {
  const { $db } = await import('@ants/store');

  if (!$db) throw new Error('Database not initialized');

  const result = await $db
    .select({ id: runs.id })
    .from(runs)
    .innerJoin(threads, eq(runs.threadId, threads.id))
    .where(and(eq(runs.id, runId), eq(threads.userId, userId)));

  if (result.length === 0) {
    throw new NotFoundError('Run', runId);
  }
}

/**
 * Filter a result set to only rows owned by a specific user.
 */
export function filterByUserId<T extends { userId?: string | null }>(items: T[], userId: string): T[] {
  return items.filter((item) => item.userId === userId);
}