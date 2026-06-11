import { eq, and, asc, notInArray } from 'drizzle-orm';
import { runs, runSteps, threads } from '@ants/store';
import type { Run, RunStep } from '@ants/store';
import { NotFoundError, ConflictError } from '../lib/errors';
import { generateId } from '../lib/utils';
import { verifyThreadOwnership, verifyRunOwnership } from '../auth/rls';

type RunStatus = 'queued' | 'in_progress' | 'awaiting_response' | 'paused' | 'completed' | 'failed' | 'cancelled';
const TERMINAL_STATES: readonly RunStatus[] = ['completed', 'failed', 'cancelled'];

class RunService {
  public async create(
    userId: string,
    input: {
      threadId: string;
      agentTypeId: string;
      parentRunId?: string | null;
      modelConfig?: Record<string, unknown>;
      },
   ): Promise<Run> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    await verifyThreadOwnership(userId, input.threadId);

    const [run] = await $db.insert(runs).values({
      id: generateId(),
      threadId: input.threadId,
      agentTypeId: input.agentTypeId,
      parentRunId: input.parentRunId ?? null,
      status: 'queued',
      modelConfig: input.modelConfig ?? null,
      }).returning();

    return run;
  }

  public async getById(userId: string, id: string): Promise<Run | null> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [row] = await $db
        .select({ run: runs })
        .from(runs)
        .innerJoin(threads, eq(runs.threadId, threads.id))
        .where(and(eq(runs.id, id), eq(threads.userId, userId)));

    return row?.run ?? null;
  }

  public async listByThread(userId: string, threadId: string): Promise<Run[]> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    await verifyThreadOwnership(userId, threadId);

    return $db
        .select()
        .from(runs)
        .where(eq(runs.threadId, threadId))
        .orderBy(asc(runs.createdAt));
  }

  public async start(userId: string, id: string): Promise<Run> {
    await this.ensureAccessible(userId, id);
    return this.transitionFrom(id, 'in_progress', { startedAt: new Date() });
  }

  public async complete(
    userId: string,
    id: string,
    usage?: Record<string, unknown>,
   ): Promise<Run> {
    const run = await this.ensureAccessible(userId, id);
    if (TERMINAL_STATES.includes(run.status as RunStatus)) {
      throw new ConflictError(`Run is already in a terminal state: ${run.status}`);
    }
    return this.transitionFrom(id, 'completed', {
      completedAt: new Date(),
      usage: usage ?? run.usage,
    });
  }

  public async fail(
    userId: string,
    id: string,
    details?: Record<string, unknown>,
   ): Promise<Run> {
    const run = await this.ensureAccessible(userId, id);
    if (TERMINAL_STATES.includes(run.status as RunStatus)) {
      throw new ConflictError(`Run is already in a terminal state: ${run.status}`);
    }
    return this.transitionFrom(id, 'failed', {
      completedAt: new Date(),
      usage: details ?? run.usage,
    });
  }

  public async cancel(userId: string, id: string): Promise<Run> {
    const run = await this.ensureAccessible(userId, id);
    if (TERMINAL_STATES.includes(run.status as RunStatus)) {
      throw new ConflictError(`Cannot cancel a run in terminal state: ${run.status}`);
    }
    return this.transitionFrom(id, 'cancelled', { completedAt: new Date() });
  }

  // ── Steps ────────────────────────────────────────────────────────

  public async createStep(
    userId: string,
    input: {
      runId: string;
      type: 'message_creation' | 'tool_call' | 'agent_delegation' | 'reasoning';
      details?: Record<string, unknown>;
      },
   ): Promise<RunStep> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    await verifyRunOwnership(userId, input.runId);

    const [step] = await $db
        .insert(runSteps)
        .values({
          id: generateId(),
          runId: input.runId,
          type: input.type,
          status: 'in_progress',
          details: input.details ?? null,
          })
        .returning();

    return step;
  }

  public async completeStep(
    userId: string,
    stepId: string,
    details?: Record<string, unknown>,
   ): Promise<RunStep> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [row] = await $db
        .select({ step: runSteps, runId: runs.id })
        .from(runSteps)
        .innerJoin(runs, eq(runSteps.runId, runs.id))
        .innerJoin(threads, eq(runs.threadId, threads.id))
        .where(and(eq(runSteps.id, stepId), eq(threads.userId, userId)));

    if (!row) throw new NotFoundError('RunStep', stepId);

    const [updated] = await $db
        .update(runSteps)
        .set({
          status: 'completed',
          details: details ?? null,
          completedAt: new Date(),
          })
        .where(eq(runSteps.id, stepId))
        .returning();

    return updated;
  }

  public async failStep(
    userId: string,
    stepId: string,
    details?: Record<string, unknown>,
   ): Promise<RunStep> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [row] = await $db
        .select({ step: runSteps, runId: runs.id })
        .from(runSteps)
        .innerJoin(runs, eq(runSteps.runId, runs.id))
        .innerJoin(threads, eq(runs.threadId, threads.id))
        .where(and(eq(runSteps.id, stepId), eq(threads.userId, userId)));

    if (!row) throw new NotFoundError('RunStep', stepId);

    const [updated] = await $db
        .update(runSteps)
        .set({
          status: 'failed',
          details: details ?? null,
          completedAt: new Date(),
          })
        .where(eq(runSteps.id, stepId))
        .returning();

    return updated;
  }

  public async getStepsForRun(userId: string, runId: string): Promise<RunStep[]> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    await verifyRunOwnership(userId, runId);

    return $db
        .select()
        .from(runSteps)
        .where(eq(runSteps.runId, runId))
        .orderBy(asc(runSteps.createdAt));
  }

  // ── Private helpers ───────────────────────────────────────────────

  private async ensureAccessible(userId: string, id: string): Promise<Run> {
    const run = await this.getById(userId, id);
    if (!run) throw new NotFoundError('Run', id);
    return run;
  }

  private async transitionFrom(
    id: string,
    newStatus: RunStatus,
    extra: Record<string, unknown>,
   ): Promise<Run> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [updated] = await $db
        .update(runs)
        .set({ status: newStatus, ...extra })
        .where(
          and(
            eq(runs.id, id),
            notInArray(runs.status, [...TERMINAL_STATES]),
          ),
        )
        .returning();

    if (!updated) {
      throw new ConflictError(`Run ${id} cannot transition to ${newStatus}`);
    }
    return updated;
  }
}

export const runService = new RunService();