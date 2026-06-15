import { Hono } from "hono";
import type { Env } from "hono/types";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createMessageRoutes(svc: Services) {
  const app = new Hono<AppEnv>();

  app.post("/", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json();
    const result = await svc.message.create(userId, body);

    // If this is a user message, trigger a T1 orchestrator run
    if (body.role === "user") {
      try {
        const agents = await svc.agent.list();
        const t1Agent = agents.find((a) => a.tier === "T1" && a.status === "active");

        if (t1Agent) {
          const run = await svc.run.create({
            threadId: body.threadId,
            agentTypeId: t1Agent.id,
            userId,
          });

          await svc.queue.enqueue({
            runId: run.id,
            userId,
            threadId: body.threadId,
          });
        }
      } catch (err) {
        // Log but don't fail the message send
        console.error("Failed to create run for user message:", err);
      }
    }

    return c.json(result, 201);
  });

  app.get("/:threadId", async (c) => {
    const userId = c.get("userId");
    const result = await svc.message.list(userId, c.req.param("threadId"), {
      cursor: c.req.query("cursor"),
      limit: c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : undefined,
    });
    return c.json(result, 200);
  });

  return app;
}
