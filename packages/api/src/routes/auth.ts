import { Hono } from "hono";
import type { Env } from "hono/types";
import { zValidator } from "@hono/zod-validator";
import {
  registerUserRequestSchema,
  loginRequestSchema,
  createApiKeyRequestSchema,
} from "../schemas/request";
import type { Services } from "../types";
import { createAdminMiddleware } from "../middleware/auth";

type AppEnv = Env & { Variables: { userId: string; apiKeyName: string | undefined } };

export function createAuthRoutes(svc: Services) {
  const app = new Hono<AppEnv>();
  const adminMiddleware = createAdminMiddleware();

  app.post("/register", zValidator("json", registerUserRequestSchema), async (c) => {
    const { email, name, inviteCode } = c.req.valid("json");
    const result = await svc.user.create(email, name, inviteCode);
    return c.json(result, 201);
  });

  app.post("/login", zValidator("json", loginRequestSchema), async (c) => {
    const { apiKey: rawKey } = c.req.valid("json");
    const result = await svc.apiKey.login(rawKey);
    return c.json(result, 200);
  });

  app.post(
    "/keys",
    adminMiddleware,
    zValidator("json", createApiKeyRequestSchema),
    async (c) => {
      const userId = c.get("userId");
      const body = c.req.valid("json");
      const result = await svc.apiKey.generate(userId, {
        name: body.name,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : undefined,
      });
      return c.json(result, 201);
    },
  );

  app.get("/keys", adminMiddleware, async (c) => {
    const userId = c.get("userId");
    const keys = await svc.apiKey.list(userId);
    return c.json(keys, 200);
  });

  app.delete("/keys/:id", adminMiddleware, async (c) => {
    const userId = c.get("userId");
    const id = c.req.param("id");
    if (!id) return c.json({ error: "Id required" }, 400);
    await svc.apiKey.revoke(userId, id);
    return c.json({ deleted: true }, 200);
  });

  return app;
}
