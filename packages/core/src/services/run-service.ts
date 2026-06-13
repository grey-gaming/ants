import { eq, and, desc, lt, inArray, count, or, sql, type SQL } from "drizzle-orm";
import { runs, runSteps } from "@ants/store";
import type { Run, NewRun, RunStep } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { NotFoundError, ConflictError, ValidationError } from "../lib/errors";

type RunStatus = NewRun["status"];

const TERMINAL_STATUSES: RunStatus[] = ["completed", "failed", "cancelled"];

interface RunCreateInput {
  userId: string;
  threadId: string;
  agentTypeId: string;
  modelConfig?: Record<string, unknown> | null;
  parentRunId?: string | null;
}

interface RunListOptions {
  limit?: number;
  cursor?: string;
  status?: RunStatus;
}

export interface RunService {
  create(input: RunCreateInput): Promise<Run>;
  getById(id: string): Promise<Run | null>;
  list(threadId: string, options?: RunListOptions): Promise<{ data: Run[]; nextCursor: string | null }>;
  updateStatus(id: string, status: RunStatus): Promise<Run>;
  cancel(id: string): Promise<Run>;
  getSteps(runId: string): Promise<RunStep[]>;
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

export function createRunService(db: PostgresJsDatabase): RunService {
  async function create(input: RunCreateInput): Promise<Run> {
    if (!input.threadId || !input.agentTypeId) {
      throw new ValidationError("threadId and agentTypeId are required");
    }

    const [run] = await db
      .insert(runs)
      .values({
        userId: input.userId,
        threadId: input.threadId,
        agentTypeId: input.agentTypeId,
        modelConfig: input.modelConfig ?? null,
        parentRunId: input.parentRunId ?? null,
        status: "queued",
      })
      .returning();

    return run;
  }

  async function getById(id: string): Promise<Run | null> {
    const [run] = await db
      .select()
      .from(runs)
      .where(eq(runs.id, id));

    return run ?? null;
  }

  async function list(
    threadId: string,
    options: RunListOptions = {},
  ): Promise<{ data: Run[]; nextCursor: string | null }> {
    const limit = options.limit ?? 50;
    const cursor = decodeCursor(options.cursor);

    const conditions = [eq(runs.threadId, threadId)];
    if (options.status) {
      conditions.push(eq(runs.status, options.status));
    }
    if (cursor) {
      conditions.push(or(
        sql`${runs.createdAt} < ${cursor.dateStr}`,
        and(
          sql`${runs.createdAt} = ${cursor.dateStr}`,
          sql`${runs.id} < ${cursor.id}`,
        ),
      )!);
    }

    const rows = await db
      .select()
      .from(runs)
      .where(and(...conditions.filter(Boolean)))
      .orderBy(desc(runs.createdAt), desc(runs.id))
      .limit(limit + 1);

    const hasMore = rows.length > limit;
    const data = rows.slice(0, limit);
    const nextCursor = hasMore && data.length > 0
      ? encodeCursor(data[data.length - 1].createdAt, data[data.length - 1].id)
      : null;

    return { data, nextCursor };
  }

  async function updateStatus(id: string, status: RunStatus): Promise<Run> {
    const existing = await getById(id);
    if (!existing) {
      throw new NotFoundError("Run", id);
    }

    const updates: Partial<Run> = { status };
    if (status === "in_progress" && !existing.startedAt) {
      updates.startedAt = new Date();
    }
    if (TERMINAL_STATUSES.includes(status)) {
      updates.completedAt = new Date();
    }

    const [updated] = await db
      .update(runs)
      .set(updates)
      .where(eq(runs.id, id))
      .returning();

    return updated;
  }

  async function cancel(id: string): Promise<Run> {
    const existing = await getById(id);
    if (!existing) {
      throw new NotFoundError("Run", id);
    }

    if (TERMINAL_STATUSES.includes(existing.status)) {
      throw new ConflictError(
        `Cannot cancel run in terminal state: ${existing.status}`,
      );
    }

    return updateStatus(id, "cancelled");
  }

  async function getSteps(runId: string): Promise<RunStep[]> {
    const existing = await getById(runId);
    if (!existing) {
      throw new NotFoundError("Run", runId);
    }

    return db
      .select()
      .from(runSteps)
      .where(eq(runSteps.runId, runId))
      .orderBy(desc(runSteps.createdAt));
  }

  return { create, getById, list, updateStatus, cancel, getSteps };
}
