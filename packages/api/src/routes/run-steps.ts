import { Hono } from "hono";
import type { Env } from "hono/types";
import { NotFoundError } from "@ants/core";
import { runSteps } from "@ants/store";
import type { Services } from "../types";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

type AppEnv = Env & { Variables: { userId: string } };

export function createRunStepsRoutes(db: PostgresJsDatabase, svc: Services) {
  const app = new Hono<AppEnv>();

  app.get("/threads/:threadId/runs/:runId/steps", async (c) => {
    const threadId = c.req.param("threadId");
    const runId = c.req.param("runId");
    const userId = c.get("userId");

    const thread = await svc.thread.getById(userId, threadId);
    if (!thread) throw new NotFoundError("Thread", threadId);

    const run = await svc.run.getById(runId);
    if (!run || run.threadId !== threadId) {
      throw new NotFoundError("Run", runId);
    }

    const steps = await db.select().from(runSteps)
      .where(eq(runSteps.runId, runId))
      .orderBy(runSteps.createdAt);

    return c.json(steps, 200);
  });

  return app;
}
