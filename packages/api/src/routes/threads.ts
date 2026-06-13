import { Hono } from "hono";
import type { Env } from "hono/types";
import { zValidator } from "../utils/validator";
import { createThreadRequestSchema } from "../schemas/request";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createThreadRoutes(svc: Services) {
  const app = new Hono<AppEnv>();

  app.post("/", zValidator("json", createThreadRequestSchema), async (c) => {
    const userId = c.get("userId");
    const input = c.req.valid("json");
    const result = await svc.thread.create(userId, input);
    return c.json(result, 201);
  });

  app.get("/", async (c) => {
    const userId = c.get("userId");
    const result = await svc.thread.list(userId, {
      cursor: c.req.query("cursor"),
      limit: c.req.query("limit") ? parseInt(c.req.query("limit")!, 10) : undefined,
    });
    return c.json(result, 200);
  });

  app.get("/:id", async (c) => {
    const userId = c.get("userId");
    const result = await svc.thread.getById(userId, c.req.param("id"));
    if (!result) return c.json({ error: "Thread not found" }, 404);
    return c.json(result, 200);
  });

  app.patch("/:id", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json();
    if (Object.keys(body).length === 0) {
      return c.json({ error: "No fields to update" }, 422);
    }
    const result = await svc.thread.update(userId, c.req.param("id"), body);
    return c.json(result, 200);
  });

  app.delete("/:id", async (c) => {
    const userId = c.get("userId");
    await svc.thread.remove(userId, c.req.param("id"));
    return c.json({ deleted: true }, 200);
  });

  return app;
}
