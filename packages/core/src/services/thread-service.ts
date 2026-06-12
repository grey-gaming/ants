import { eq, and, desc, or, sql, type SQL } from "drizzle-orm";
import { threads } from "@ants/store";
import type { Thread, NewThread } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { NotFoundError, ValidationError } from "../lib/errors";

interface ThreadListOptions {
  limit?: number;
  cursor?: string;
}

interface ThreadUpdateInput {
  title?: string;
  metadata?: Record<string, unknown>;
}

interface ThreadService {
  create(userId: string, input: Pick<NewThread, "title" | "metadata">): Promise<Thread>;
  getById(userId: string, id: string): Promise<Thread | null>;
  list(userId: string, options?: ThreadListOptions): Promise<{ data: Thread[]; nextCursor: string | null }>;
  update(userId: string, id: string, input: ThreadUpdateInput): Promise<Thread>;
  remove(userId: string, id: string): Promise<void>;
}

function encodeCursor(createdAt: Date, id: string): string {
  return btoa(`${createdAt.toISOString()}~${id}`);
}

function decodeCursor(cursor: string | undefined): { dateStr: string; id: string } | null {
  if (!cursor) return null;
  try {
    const decoded = Buffer.from(cursor, "base64").toString();
    const [dateStr, id] = decoded.split("~");
    return dateStr ? { dateStr, id: id || "" } : null;
  } catch {
    return null;
  }
}

export function createThreadService(db: PostgresJsDatabase): ThreadService {
  async function create(userId: string, input: Pick<NewThread, "title" | "metadata">): Promise<Thread> {
    if (!input.title?.trim()) {
      throw new ValidationError("Title must not be empty");
    }

    const [thread] = await db
      .insert(threads)
      .values({
        userId,
        title: input.title.trim(),
        metadata: input.metadata ?? null,
      })
      .returning();

    return thread;
  }

  async function getById(userId: string, id: string): Promise<Thread | null> {
    const [thread] = await db
      .select()
      .from(threads)
      .where(and(eq(threads.id, id), eq(threads.userId, userId)));

    return thread ?? null;
  }

  async function list(
    userId: string,
    options: ThreadListOptions = {},
  ): Promise<{ data: Thread[]; nextCursor: string | null }> {
    const limit = options.limit ?? 50;
    const cursor = decodeCursor(options.cursor);

    const conditions: SQL[] = [eq(threads.userId, userId)];
    if (cursor) {
      conditions.push(or(
        sql`${threads.createdAt} < ${cursor.dateStr}`,
        and(
          sql`${threads.createdAt} = ${cursor.dateStr}`,
          sql`${threads.id} < ${cursor.id}`,
        ),
      )!);
    }

    const rows = await db
      .select()
      .from(threads)
      .where(and(...conditions.filter(Boolean)))
      .orderBy(desc(threads.createdAt), desc(threads.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor(data[data.length - 1].createdAt, data[data.length - 1].id)
      : null;

    return { data, nextCursor };
  }

  async function update(
    userId: string,
    id: string,
    input: ThreadUpdateInput,
  ): Promise<Thread> {
    const existing = await getById(userId, id);
    if (!existing) {
      throw new NotFoundError("Thread", id);
    }

    const [updated] = await db
      .update(threads)
      .set({
        ...(input.title !== undefined && { title: input.title.trim() }),
        ...(input.metadata !== undefined && { metadata: input.metadata }),
        updatedAt: new Date(),
      })
      .where(and(eq(threads.id, id), eq(threads.userId, userId)))
      .returning();

    return updated;
  }

  async function remove(userId: string, id: string): Promise<void> {
    const existing = await getById(userId, id);
    if (!existing) {
      throw new NotFoundError("Thread", id);
    }

    await db
      .delete(threads)
      .where(and(eq(threads.id, id), eq(threads.userId, userId)));
  }

  return { create, getById, list, update, remove };
}
