import { eq, inArray, count, sql } from "drizzle-orm";
import { runs } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { RateLimitError, ValidationError } from "../lib/errors";
import { config } from "../lib/config";

const DEFAULT_GLOBAL_CONCURRENCY = 10;
const DEFAULT_PER_USER_CONCURRENCY = 3;

export type QueuePriority = "critical" | "high" | "normal" | "low";

const PRIORITY_WEIGHT: Record<QueuePriority, number> = {
  critical: 0,
  high: 1,
  normal: 2,
  low: 3,
};

interface QueueItem {
  runId: string;
  userId: string;
  threadId: string;
  priority: QueuePriority;
  enqueuedAt: Date;
}

interface QueueStats {
  queueDepth: number;
  activeRuns: number;
  maxConcurrency: number;
  perUserActiveRuns: Record<string, number>;
}

interface EnqueueInput {
  runId: string;
  userId: string;
  threadId: string;
  priority?: QueuePriority;
}

interface QueueService {
  enqueue(input: EnqueueInput): void;
  dequeue(): QueueItem | null;
  getStats(): Promise<QueueStats>;
  enforceConcurrencyLimits(userId?: string): void;
}

function createInMemoryQueue(): QueueItem[] {
  return [];
}

export function createQueueService(db: PostgresJsDatabase): QueueService {
  const queue = createInMemoryQueue();

  function enqueue(input: EnqueueInput): void {
    queue.push({
      runId: input.runId,
      userId: input.userId,
      threadId: input.threadId,
      priority: input.priority ?? "normal",
      enqueuedAt: new Date(),
    });

    queue.sort((a, b) => {
      const priorityDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (priorityDiff !== 0) return priorityDiff;
      return a.enqueuedAt.getTime() - b.enqueuedAt.getTime();
    });
  }

  function dequeue(): QueueItem | null {
    if (queue.length === 0) return null;
    return queue.shift() ?? null;
  }

  async function getStats(): Promise<QueueStats> {
    const activeResults = await db
      .select({
        userId: runs.userId,
        activeCount: count(),
      })
      .from(runs)
      .where(inArray(runs.status, ["in_progress", "awaiting_response"]))
      .groupBy(runs.userId ?? sql`null`);

    const totalActive = activeResults.reduce((sum, r) => sum + Number(r.activeCount), 0);

    const perUserActiveRuns: Record<string, number> = {};
    for (const row of activeResults) {
      if (row.userId) {
        perUserActiveRuns[row.userId] = Number(row.activeCount);
      }
    }

    return {
      queueDepth: queue.length,
      activeRuns: totalActive,
      maxConcurrency: DEFAULT_GLOBAL_CONCURRENCY,
      perUserActiveRuns,
    };
  }

  async function enforceConcurrencyLimits(userId?: string): Promise<void> {
    const stats = await getStats();

    if (stats.activeRuns >= DEFAULT_GLOBAL_CONCURRENCY) {
      throw new RateLimitError(
        `Global concurrency limit reached: ${stats.activeRuns}/${DEFAULT_GLOBAL_CONCURRENCY}`,
      );
    }

    if (userId) {
      const userActive = stats.perUserActiveRuns[userId] ?? 0;
      if (userActive >= DEFAULT_PER_USER_CONCURRENCY) {
        throw new RateLimitError(
          `Per-user concurrency limit reached: ${userActive}/${DEFAULT_PER_USER_CONCURRENCY}`,
        );
      }
    }
  }

  return { enqueue, dequeue, getStats, enforceConcurrencyLimits };
}
