import { Hono } from "hono";
import type { Env } from "hono/types";
import { zValidator } from "../utils/validator";
import { registerToolRequestSchema } from "../schemas/request";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createToolRoutes(svc: Services) {
  const app = new Hono<AppEnv>();

  app.post("/", zValidator("json", registerToolRequestSchema), async (c) => {
    const userId = c.get("userId");
    const body = c.req.valid("json");
    const result = await svc.tool.register(userId, body);
    return c.json(result, 201);
  });

  app.get("/", async (c) => {
    const userId = c.get("userId");
    const result = await svc.tool.list({ userId, limit: 100 });
    return c.json(result, 200);
  });

  app.get("/:id", async (c) => {
    const result = await svc.tool.getById(c.req.param("id"));
    if (!result) return c.json({ error: "Tool not found" }, 404);
    return c.json(result, 200);
  });

  app.patch("/:id", async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json();
    if (Object.keys(body).length === 0) {
      return c.json({ error: "No fields to update" }, 422);
    }
    const result = await svc.tool.update(userId, c.req.param("id"), body);
    return c.json(result, 200);
  });

  return app;
}
