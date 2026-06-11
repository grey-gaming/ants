import { eq, and, count } from 'drizzle-orm';
import { runs } from '@ants/store';

const PRIORITY: Record<string, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

const GLOBAL_CONCURRENCY_LIMIT = 10;
const PER_USER_CONCURRENCY_LIMIT = 3;

interface QueuedItem {
  runId: string;
  userId: string;
  threadId: string;
  agentTypeId: string;
  priority: 'critical' | 'high' | 'normal' | 'low';
  enqueuedAt: number;
}

/**
 * In-memory priority queue with FIFO ordering within each level.
 * Queries the DB for concurrency stats on each dequeue.
 */
class QueueService {
  private items: QueuedItem[] = [];

  public enqueue(
    runId: string,
    userId: string,
    threadId: string,
    agentTypeId: string,
    priority: 'critical' | 'high' | 'normal' | 'low' = 'normal',
   ): void {
    this.items.push({
      runId,
      userId,
      threadId,
      agentTypeId,
      priority,
      enqueuedAt: Date.now(),
      });

    this.sort();
    }

  public async dequeue(): Promise<QueuedItem | null> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const globalCount = await this.getInProgressGlobal($db);

    if (globalCount >= GLOBAL_CONCURRENCY_LIMIT) return null;

    for (let i = 0; i < this.items.length; i++) {
      const item = this.items[i];
      const userCount = await this.getInProgressForUser($db, item.userId);

      if (userCount < PER_USER_CONCURRENCY_LIMIT) {
        this.items.splice(i, 1);
        return item;
        }
      }

    return null;
    }

  public dequeueByRunId(runId: string): QueuedItem | null {
    const idx = this.items.findIndex((i) => i.runId === runId);
    if (idx < 0) return null;

    return this.items.splice(idx, 1)[0];
    }

  public get length(): number {
    return this.items.length;
    }

  public get all(): ReadonlyArray<QueuedItem> {
    return [...this.items];
    }

  public async stats(): Promise<{
    queued: number;
    inProgressGlobal: number;
    byPriority: Record<string, number>;
    }> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const inProgressGlobal = await this.getInProgressGlobal($db);

    const byPriority: Record<string, number> = { critical: 0, high: 0, normal: 0, low: 0 };

    for (const item of this.items) {
      byPriority[item.priority]++;
      }

    return { queued: this.items.length, inProgressGlobal, byPriority };
    }

   // ── Private helpers ──────────────────────────────────────────

  private async getInProgressGlobal($db: any): Promise<number> {
    const [row] = await $db.select({ count: count() }).from(runs).where(eq(runs.status, 'in_progress'));
    return Number(row.count);
    }

  private async getInProgressForUser($db: any, userId: string): Promise<number> {
    const { threads } = await import('@ants/store');
    const [row] = await $db
        .select({ count: count() })
        .from(runs)
        .innerJoin(threads, eq(runs.threadId, threads.id))
        .where(and(eq(threads.userId, userId), eq(runs.status, 'in_progress')));

    return Number(row.count);
    }

  private sort(): void {
    this.items.sort((a, b) => {
      const pa = PRIORITY[a.priority];
      const pb = PRIORITY[b.priority];
      if (pa !== pb) return pa - pb;
      return a.enqueuedAt - b.enqueuedAt;
      });
    }
}

export const queueService = new QueueService();
