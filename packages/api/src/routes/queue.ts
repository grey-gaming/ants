import { Hono } from "hono";
import type { Env } from "hono/types";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createQueueRoutes(svc: Services) {
  const app = new Hono<AppEnv>();

  app.post("/enqueue", async (c) => {
    const input = await c.req.json();
    await svc.queue.enqueue({
      runId: String(input.runId),
      userId: String(input.userId),
      threadId: String(input.threadId),
    });
    return c.json({ status: "enqueued" }, 201);
  });

  app.get("/stats", async (c) => {
    const stats = await svc.queue.getStats();
    return c.json(stats, 200);
  });

  return app;
}
