import { Hono } from "hono";
import type { Env } from "hono/types";
import type { Services } from "../types";
import { createAdminMiddleware } from "../middleware/auth";

type AppEnv = Env & { Variables: { userId: string; apiKeyName: string | undefined } };

export function createUserRoutes(svc: Services) {
  const app = new Hono<AppEnv>();
  const adminMiddleware = createAdminMiddleware();

  app.get("/me", adminMiddleware, async (c) => {
    const userId = c.get("userId");
    const result = await svc.user.getCurrentUser(userId);
    return c.json(result, 200);
  });

  app.patch("/me", adminMiddleware, async (c) => {
    const userId = c.get("userId");
    const body = await c.req.json();
    const result = await svc.user.update(userId, { name: body.name });
    return c.json(result, 200);
  });

  app.get("/", adminMiddleware, async (c) => {
    const users = await svc.user.list("", { limit: 100 });
    return c.json(users, 200);
  });

  app.get("/:id", adminMiddleware, async (c) => {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Id required" }, 400);
    const result = await svc.user.getById(id);
    if (!result) return c.json({ error: "User not found" }, 404);
    return c.json(result, 200);
  });

  app.patch("/:id", adminMiddleware, async (c) => {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Id required" }, 400);
    const body = await c.req.json();
    const result = await svc.user.update(id, { name: body.name });
    return c.json(result, 200);
  });

  app.delete("/:id", adminMiddleware, async (c) => {
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Id required" }, 400);
    const userId = c.get("userId");
    await svc.user.deactivate(id, userId);
    return c.json({ deactivated: true }, 200);
  });

  return app;
}
