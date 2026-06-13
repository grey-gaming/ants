import { Hono } from "hono";
import type { Env } from "hono/types";
import { zValidator } from "@hono/zod-validator";
import { settingUpsertRequestSchema } from "../schemas/request";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createSettingsRoutes(svc: Services) {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const settings = await svc.settings.getAll();
    return c.json(settings, 200);
  });

  app.get("/:key", async (c) => {
    const key = c.req.param("key");
    const setting = await svc.settings.getByKey(key);
    if (!setting) return c.json({ error: "Setting not found" }, 404);
    return c.json(setting, 200);
  });

  app.patch("/:key", zValidator("json", settingUpsertRequestSchema), async (c) => {
    const key = c.req.param("key");
    const body = c.req.valid("json");
    const setting = await svc.settings.upsert({ key, value: body.storeValue });
    return c.json(setting, 200);
  });

  app.delete("/:key", async (c) => {
    const key = c.req.param("key");
    await svc.settings.remove(key);
    return c.json({ deleted: true }, 200);
  });

  return app;
}
