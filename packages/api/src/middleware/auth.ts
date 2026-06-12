import { eq } from "drizzle-orm";
import type { Context, Env } from "hono";
import { apiKeys, users } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { hashApiKey, isValidPrefix } from "@ants/core";

type AppEnv = Env & { Variables: { userId: string } };

let sharedDb: PostgresJsDatabase | null = null;

export function createAuthMiddleware(db: PostgresJsDatabase) {
  sharedDb = db;

  return async function authMiddleware(c: Context<AppEnv>, next: () => Promise<void>) {
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw Object.assign(new Error("Missing or invalid authorization header"), { name: "AuthError" });
    }
    const apiKey = authHeader.slice(7);
    if (!isValidPrefix(apiKey)) {
      throw Object.assign(new Error("Invalid API key format"), { name: "AuthError" });
    }
    const persistentDb = sharedDb!;
    const [keyRecord] = await persistentDb
      .select()
      .from(apiKeys)
      .where(eq(apiKeys.keyHash, await hashApiKey(apiKey)))
      .limit(1);
    if (!keyRecord) {
      throw Object.assign(new Error("Invalid API key"), { name: "AuthError" });
    }
    const [user] = await persistentDb
      .select()
      .from(users)
      .where(eq(users.id, keyRecord.userId))
      .limit(1);
    if (!user) {
      throw Object.assign(new Error("Associated user not found"), { name: "AuthError" });
    }
    c.set("userId", user.id);
    await next();
  };
}
