import { Hono } from "hono";
import type { Env } from "hono/types";
import type { WorkerManager } from "../services/worker-manager";

type AppEnv = Env & { Variables: { userId: string } };

export function createWorkerRoutes(_svc: unknown, manager: WorkerManager) {
  const app = new Hono<AppEnv>();

  app.get("/status", async (c) => {
    const status = manager.getStatus();
    return c.json(status, 200);
  });

  app.post("/restart", async (c) => {
    // Worker restart is handled by the app lifecycle
    return c.json({ status: "ok" }, 200);
  });

  return app;
}
