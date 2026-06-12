import { eq, and, asc, or, sql, type SQL } from "drizzle-orm";
import { messages, threads } from "@ants/store";
import type { Message, NewMessage } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { NotFoundError, ValidationError } from "../lib/errors";

interface MessageListOptions {
  limit?: number;
  cursor?: string;
}

interface MessageCreateInput {
  threadId: string;
  role: NewMessage["role"];
  content: string;
  agentTypeId?: string | null;
  metadata?: Record<string, unknown> | null;
}

interface MessageService {
  create(userId: string, input: MessageCreateInput): Promise<Message>;
  getById(userId: string, threadId: string, id: string): Promise<Message | null>;
  list(userId: string, threadId: string, options?: MessageListOptions): Promise<{ data: Message[]; nextCursor: string | null }>;
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

export function createMessageService(db: PostgresJsDatabase): MessageService {
  async function verifyThreadAccess(userId: string, threadId: string): Promise<void> {
    const [thread] = await db
      .select({ id: threads.id })
      .from(threads)
      .where(and(eq(threads.id, threadId), eq(threads.userId, userId)));

    if (!thread) {
      throw new NotFoundError("Thread", threadId);
    }
  }

  async function create(userId: string, input: MessageCreateInput): Promise<Message> {
    if (!input.content?.trim()) {
      throw new ValidationError("Message content must not be empty");
    }

    await verifyThreadAccess(userId, input.threadId);

    const [message] = await db
      .insert(messages)
      .values({
        threadId: input.threadId,
        role: input.role,
        content: input.content,
        agentTypeId: input.agentTypeId ?? null,
        metadata: input.metadata ?? null,
      })
      .returning();

    return message;
  }

  async function getById(
    userId: string,
    threadId: string,
    id: string,
  ): Promise<Message | null> {
    await verifyThreadAccess(userId, threadId);

    const [message] = await db
      .select()
      .from(messages)
      .where(and(eq(messages.id, id), eq(messages.threadId, threadId)));

    return message ?? null;
  }

  async function list(
    userId: string,
    threadId: string,
    options: MessageListOptions = {},
  ): Promise<{ data: Message[]; nextCursor: string | null }> {
    await verifyThreadAccess(userId, threadId);

    const limit = options.limit ?? 50;
    const cursor = decodeCursor(options.cursor);

    const conditions: SQL[] = [eq(messages.threadId, threadId)];
    if (cursor) {
      conditions.push(or(
        sql`${messages.createdAt} < ${cursor.dateStr}`,
        and(
          sql`${messages.createdAt} = ${cursor.dateStr}`,
          sql`${messages.id} < ${cursor.id}`,
        ),
      )!);
    }

    const rows = await db
      .select()
      .from(messages)
      .where(and(...conditions.filter(Boolean)))
      .orderBy(asc(messages.createdAt), asc(messages.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor(data[data.length - 1].createdAt, data[data.length - 1].id)
      : null;

    return { data, nextCursor };
  }

  return { create, getById, list };
}
