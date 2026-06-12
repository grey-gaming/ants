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
