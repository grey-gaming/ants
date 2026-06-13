import { eq, inArray, and, count, asc, desc, sql } from "drizzle-orm";
import { runs, jobQueue } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { RateLimitError, ValidationError } from "../lib/errors";

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

interface DequeueResult {
  queueItemId: string;
  runId: string;
  userId: string;
  threadId: string;
  priority: QueuePriority;
}

export interface QueueService {
  enqueue(input: EnqueueInput): Promise<void>;
  dequeue(): Promise<DequeueResult | null>;
  getStats(): Promise<QueueStats>;
  enforceConcurrencyLimits(userId?: string): Promise<void>;
}

export function createQueueService(db: PostgresJsDatabase): QueueService {
  async function enqueue(input: EnqueueInput): Promise<void> {
    await db
      .insert(jobQueue)
      .values({
        runId: input.runId,
        userId: input.userId,
        threadId: input.threadId,
        priority: input.priority ?? "normal",
        status: "waiting",
      });
  }

  async function dequeue(): Promise<DequeueResult | null> {
    const [job] = await db
      .select()
      .from(jobQueue)
      .where(eq(jobQueue.status, "waiting"))
      .orderBy(
        asc(jobQueue.priority),
        asc(jobQueue.enqueuedAt),
      )
      .limit(1);

    if (!job) return null;

    const jobId = job.id;

    await db
      .update(jobQueue)
      .set({ status: "active", processedAt: new Date() })
      .where(and(eq(jobQueue.id, jobId), eq(jobQueue.status, "waiting")))
      .returning();

    await db
      .update(runs)
      .set({ status: "in_progress" })
      .where(eq(runs.id, job.runId));

    return {
      queueItemId: jobId,
      runId: job.runId,
      userId: job.userId,
      threadId: job.threadId,
      priority: job.priority as QueuePriority,
    };
  }

  async function getStats(): Promise<QueueStats> {
    const [queuedResult] = await db
      .select({ count: count() })
      .from(jobQueue)
      .where(eq(jobQueue.status, "waiting"));

    const activeResults = await db
      .select({
        userId: sql<string>`COALESCE(${runs.userId}, null)`,
        activeCount: count(),
      })
      .from(runs)
      .where(inArray(runs.status, ["in_progress", "awaiting_response"]))
      .groupBy(runs.userId);

    const totalActive = activeResults.reduce((sum, r) => sum + Number(r.activeCount), 0);

    const perUserActiveRuns: Record<string, number> = {};
    for (const row of activeResults) {
      if (row.userId) {
        perUserActiveRuns[row.userId] = Number(row.activeCount);
      }
    }

    return {
      queueDepth: Number(queuedResult?.count ?? 0),
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
