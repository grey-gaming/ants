import { eq, and, desc, asc, ilike, count } from 'drizzle-orm';
import { threads } from '@ants/store';
import type { Thread } from '@ants/store';
import { NotFoundError, ValidationError } from '../lib/errors';
import { generateId } from '../lib/utils';

/**
 * Cursor-based pagination params and result.
 */
interface PaginationParams {
  cursor?: string;
  limit?: number;
}

interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
}

const DEFAULT_LIMIT = 20;

class ThreadService {
  /**
   * Create a new thread for the given user.
   */
  public async create(
    userId: string,
    input: {
      title: string;
      metadata?: Record<string, unknown>;
     },
   ): Promise<Thread> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const title = input.title.trim();
    if (!title) {
      throw new ValidationError('Thread title is required');
     }

    const [thread] = await $db
       .insert(threads)
       .values({
        id: generateId(),
        userId,
        title,
        metadata: input.metadata ?? null,
       })
       .returning();

    return thread;
   }

  /**
   * Get a single thread by ID (scoped to user).
   */
  public async getById(userId: string, id: string): Promise<Thread | null> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [thread] = await $db
       .select()
       .from(threads)
       .where(and(eq(threads.id, id), eq(threads.userId, userId)));

    return thread ?? null;
   }

  /**
   * List threads for a user with cursor pagination.
   */
  public async list(
    userId: string,
    params: PaginationParams & { search?: string } = {},
  ): Promise<PaginatedResult<Thread>> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, 100);
    const fetchLimit = limit + 1;

    let query = $db.select().from(threads).where(eq(threads.userId, userId));

    if (params.search) {
      query = $db
         .select()
         .from(threads)
         .where(
          and(
            eq(threads.userId, userId),
            ilike(threads.title, `%${params.search}%`),
           ),
         );
     }

    let rows = await query.orderBy(desc(threads.createdAt)).limit(fetchLimit);

    if (params.cursor) {
      const cursorIdx = rows.findIndex((r) => r.id === params.cursor);
      if (cursorIdx >= 0) {
        rows = rows.slice(cursorIdx + 1);
       }
     }

    const hasMore = rows.length > limit;
    const items = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? items[items.length - 1]?.id ?? null : null;

    return { items, nextCursor };
   }

  /**
   * Update a thread's title and/or metadata (scoped to user).
   */
  public async update(
    userId: string,
    id: string,
    input: {
      title?: string;
      metadata?: Record<string, unknown>;
     },
  ): Promise<Thread> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const existing = await this.getById(userId, id);
    if (!existing) {
      throw new NotFoundError('Thread', id);
     }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (input.title !== undefined) {
      const trimmed = input.title.trim();
      if (!trimmed) throw new ValidationError('Thread title cannot be empty');
      updates.title = trimmed;
     }

    if (input.metadata !== undefined) {
      updates.metadata = input.metadata;
     }

    const [thread] = await $db
       .update(threads)
       .set(updates)
       .where(and(eq(threads.id, id), eq(threads.userId, userId)))
       .returning();

    if (!thread) {
      throw new NotFoundError('Thread', id);
     }

    return thread;
   }

  /**
   * Delete a thread (scoped to user). Cascade deletes messages/runs via FK.
   */
  public async remove(userId: string, id: string): Promise<void> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const existing = await this.getById(userId, id);
    if (!existing) {
      throw new NotFoundError('Thread', id);
     }

    await $db
        .delete(threads)
        .where(and(eq(threads.id, id), eq(threads.userId, userId)));
   }

  /**
   * Count threads for a user.
   */
  public async count(userId: string): Promise<number> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [row] = await $db
       .select({ count: count() })
       .from(threads)
       .where(eq(threads.userId, userId));

    return Number(row.count);
   }
}

export const threadService = new ThreadService();
