import { eq, and, isNull, sql, count } from "drizzle-orm";
import { jobQueue, runs } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { LLMProvider } from "@ants/llm";
import { logger } from "@ants/core";

// ---------------------------------------------------------------------------
// Queue worker — background loop polling job_queue and dispatching to executor
// ---------------------------------------------------------------------------

interface WorkerOptions {
  pollIntervalMs?: number;
  maxRetries?: number;
  retryDelayMs?: number;
  maxConcurrentRuns?: number;
}

export interface QueueWorker {
  start(): void;
  stop(): Promise<void>;
  getStatus(): { activeRuns: number; queueDepth: number; running: boolean };
}

type DispatchFn = (runId: string, userId: string, threadId: string, agentTypeId: string, llmProvider: LLMProvider) => Promise<void>;

export function createQueueWorker(
  db: PostgresJsDatabase,
  llmProvider: LLMProvider,
  dispatch: DispatchFn,
  options: WorkerOptions = {},
): QueueWorker {
  const pollIntervalMs = options.pollIntervalMs ?? 2000;
  const maxRetries = options.maxRetries ?? 3;
  const retryDelayMs = options.retryDelayMs ?? 5000;
  const maxConcurrent = options.maxConcurrentRuns ?? 4;

  let running = false;
  let activeRunIds = new Set<string>();
  let pollTimer: ReturnType<typeof setTimeout> | null = null;

  async function countActive(): Promise<number> {
    const [row] = await db.select({ count: count() })
      .from(runs)
      .where(sql`${runs.status} IN ('in_progress', 'awaiting_response')`);
    return Number(row?.count ?? 0);
  }

  async function dequeue(): Promise<{
    id: string;
    runId: string;
    userId: string;
    threadId: string;
    priority: string;
    agentTypeId: string;
  } | null> {
    const [job] = await db.select().from(jobQueue)
      .where(eq(jobQueue.status, "waiting"))
      .orderBy(sql`FIELD(job_queue.priority, 'critical', 'high', 'normal', 'low')`)
      .limit(1);

    if (!job) return null;

    const active = await countActive();
    if (active >= maxConcurrent) return null;

    const jobId = job.id;
    await db.update(jobQueue)
      .set({ status: "active", processedAt: new Date() })
      .where(and(eq(jobQueue.id, jobId), eq(jobQueue.status, "waiting")));

    const [run] = await db.select().from(runs)
      .where(eq(runs.id, job.runId));
    if (!run) return null;

    await db.update(runs)
      .set({ status: "in_progress" })
      .where(eq(runs.id, job.runId));

    return {
      id: jobId,
      runId: job.runId,
      userId: job.userId,
      threadId: job.threadId,
      priority: job.priority,
      agentTypeId: run.agentTypeId,
    };
  }

  async function processOne(): Promise<void> {
    const result = await dequeue();
    if (!result) return;

    activeRunIds.add(result.runId);
    logger.info("queue-worker", `Dispatching run ${result.runId} (priority: ${result.priority})`);

    let success = false;
    let retries = 0;

    while (retries < maxRetries && !success) {
      retries++;
      try {
        if (retries > 1) {
          await new Promise(resolve => setTimeout(resolve, retryDelayMs));
        }
        await dispatch(result.runId, result.userId, result.threadId, result.agentTypeId, llmProvider);
        success = true;
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.warn("queue-worker", `Retry ${retries}/${maxRetries} for run ${result.runId}: ${msg}`);
      }
    }

    if (!success) {
      await db.update(runs)
        .set({ status: "failed", completedAt: new Date() })
        .where(eq(runs.id, result.runId));
      await db.update(jobQueue)
        .set({ status: "failed" })
        .where(eq(jobQueue.id, result.id));
    }

    activeRunIds.delete(result.runId);
  }

  function poll(): void {
    if (!running) return;
    processOne().finally(() => {
      pollTimer = setTimeout(poll, pollIntervalMs);
    });
  }

  function start(): void {
    if (running) return;
    running = true;
    logger.info("queue-worker", "Worker starting");
    poll();
  }

  async function stop(): Promise<void> {
    running = false;
    if (pollTimer) {
      clearTimeout(pollTimer);
      pollTimer = null;
    }
    logger.info("queue-worker", "Worker stopped");
  }

  function getStatus(): { activeRuns: number; queueDepth: number; running: boolean } {
    return {
      activeRuns: activeRunIds.size,
      queueDepth: 0,
      running,
    };
  }

  return { start, stop, getStatus };
}
