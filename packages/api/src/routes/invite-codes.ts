import { Hono } from "hono";
import type { Env } from "hono/types";
import { z } from "zod";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

const generateCodeSchema = z.object({
  count: z.number().int().min(1).max(100).default(1),
  expiresAt: z.string().datetime().optional(),
});

export function createInviteCodesRoutes(svc: Services) {
  const app = new Hono<AppEnv>();

  app.get("/", async (c) => {
    const codes = await svc.inviteCode.list();
    return c.json(codes, 200);
  });

  app.post("/", async (c) => {
    const body = await c.req.json();
    const parsed = generateCodeSchema.parse(body);
    const codes = await svc.inviteCode.generate(parsed.count, parsed.expiresAt ? new Date(parsed.expiresAt) : undefined);
    return c.json(codes, 201);
  });

  return app;
}
