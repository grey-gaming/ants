import { Hono } from "hono";
import type { Env } from "hono/types";
import { zValidator } from "../utils/validator";
import { createRunRequestSchema, updateRunStatusRequestSchema } from "../schemas/request";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createRunRoutes(svc: Services) {
  const app = new Hono<AppEnv>();

  app.post("/", zValidator("json", createRunRequestSchema), async (c) => {
    const userId = c.get("userId");
    const input = c.req.valid("json");
    const result = await svc.run.create({ ...input, userId });
    return c.json(result, 201);
  });

  app.get("/:id", async (c) => {
    const result = await svc.run.getById(c.req.param("id"));
    if (!result) return c.json({ error: "Run not found" }, 404);
    return c.json(result, 200);
  });

  app.patch("/:id/status", zValidator("json", updateRunStatusRequestSchema), async (c) => {
    const { status } = c.req.valid("json");
    const result = await svc.run.updateStatus(c.req.param("id"), status);
    return c.json(result, 200);
  });

  app.post("/:id/cancel", async (c) => {
    const result = await svc.run.cancel(c.req.param("id"));
    return c.json(result, 200);
  });

  app.get("/:id/steps", async (c) => {
    const steps = await svc.run.getSteps(c.req.param("id"));
    return c.json(steps, 200);
  });

  return app;
}
