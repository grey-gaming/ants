import { Hono } from "hono";
import type { Env } from "hono/types";
import { zValidator } from "../utils/validator";
import {
  registerUserRequestSchema,
  loginRequestSchema,
} from "../schemas/request";
import type { Services } from "../types";

const SESSION_COOKIE_NAME = "ants_session";
const SESSION_MAX_AGE = 7 * 24 * 60 * 60; // 7 days in seconds

type AppEnv = Env & { Variables: { userId: string } };

export function createAuthRoutes(svc: Services) {
  const app = new Hono<AppEnv>();

  app.post("/register", zValidator("json", registerUserRequestSchema), async (c) => {
    const { email, name, password, inviteCode } = c.req.valid("json");
    try {
      const result = await svc.user.create(email, name, password, inviteCode);
      return c.json({ id: result.id, email: result.email, name: result.name }, 201);
    } catch (err: unknown) {
      console.error("Register error:", err);
      throw err;
    }
  });

  app.post("/login", zValidator("json", loginRequestSchema), async (c) => {
    const { email, password } = c.req.valid("json");
    const user = await svc.user.findByEmail(email);
    if (!user) {
      throw Object.assign(new Error("Invalid email or password"), { name: "AuthError" });
    }
    const valid = await svc.user.verifyPassword(user, password);
    if (!valid) {
      throw Object.assign(new Error("Invalid email or password"), { name: "AuthError" });
    }
    const token = await svc.session.create(user.id);
    c.header("Set-Cookie", `${SESSION_COOKIE_NAME}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${SESSION_MAX_AGE}`);
    return c.json({ id: user.id, email: user.email, name: user.name }, 200);
  });

  app.post("/logout", async (c) => {
    const token = c.getCookie(SESSION_COOKIE_NAME);
    if (token) {
      await svc.session.destroy(token);
    }
    c.header("Set-Cookie", `${SESSION_COOKIE_NAME}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0`);
    return c.json({ loggedOut: true }, 200);
  });

  app.get("/me", async (c) => {
    const userId = c.get("userId");
    if (!userId) {
      return c.json({ error: "Not authenticated" }, 401);
    }
    const user = await svc.user.getCurrentUser(userId);
    return c.json({ id: user.id, email: user.email, name: user.name }, 200);
  });

  return app;
}
