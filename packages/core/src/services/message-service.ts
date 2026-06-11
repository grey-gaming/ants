import { eq, and, asc } from 'drizzle-orm';
import { messages, threads } from '@ants/store';
import type { Message } from '@ants/store';
import { NotFoundError, ValidationError } from '../lib/errors';
import { generateId } from '../lib/utils';
import { verifyThreadOwnership } from '../auth/rls';

interface PaginationParams {
  limit?: number;
}

const DEFAULT_LIMIT = 100;

class MessageService {
  /**
   * Create a new message in a thread. Validates ownership via RLS.
   */
  public async create(
    userId: string,
    input: {
      threadId: string;
      role: 'user' | 'assistant' | 'system';
      content: string;
      agentTypeId?: string | null;
      metadata?: Record<string, unknown>;
     },
   ): Promise<Message> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    await verifyThreadOwnership(input.threadId, userId);

    const content = (input.content ?? '').trim();
    if (!content) {
      throw new ValidationError('Message content is required');
     }

    const [message] = await $db
       .insert(messages)
       .values({
        id: generateId(),
        threadId: input.threadId,
        role: input.role,
        content,
        agentTypeId: input.agentTypeId ?? null,
        metadata: input.metadata ?? null,
       })
       .returning();

    return message;
   }

  /**
   * Get all messages for a thread (ordered by created_at ASC).
   */
  public async getByThread(
    userId: string,
    threadId: string,
    params: PaginationParams = {},
  ): Promise<Message[]> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    await verifyThreadOwnership(threadId, userId);

    const limit = Math.min(params.limit ?? DEFAULT_LIMIT, 500);

    return $db
       .select()
       .from(messages)
       .where(eq(messages.threadId, threadId))
       .orderBy(asc(messages.createdAt))
       .limit(limit);
   }

  /**
   * Get a single message by ID (scoped to user via thread ownership).
   */
  public async getById(userId: string, id: string): Promise<Message | null> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [row] = await $db
       .select({ message: messages })
       .from(messages)
       .innerJoin(threads, eq(messages.threadId, threads.id))
       .where(and(eq(messages.id, id), eq(threads.userId, userId)));

    return row?.message ?? null;
   }

  /**
   * Delete a message (scoped to user via thread ownership).
   */
  public async remove(userId: string, id: string): Promise<void> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [row] = await $db
       .select({ threadId: messages.threadId })
       .from(messages)
       .innerJoin(threads, eq(messages.threadId, threads.id))
       .where(and(eq(messages.id, id), eq(threads.userId, userId)));

    if (!row) {
      throw new NotFoundError('Message', id);
     }

    await $db.delete(messages).where(eq(messages.id, id));
   }
}

export const messageService = new MessageService();
