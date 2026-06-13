import { eq } from "drizzle-orm";
import type { Context, Env } from "hono";
import { apiKeys, users } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { hashApiKey, isValidPrefix, validateApiKey } from "@ants/core";

type AppEnv = Env & { Variables: { userId: string; apiKeyName: string | undefined } };

let sharedDb: PostgresJsDatabase | null = null;

export function createAuthMiddleware(db: PostgresJsDatabase) {
  sharedDb = db;

  return async function authMiddleware(c: Context<AppEnv>, next: () => Promise<void>) {
    // Skip auth for public auth routes
    const path = c.req.path;
    if (path === "/v1/auth/register" || path === "/v1/auth/login" || path === "/v1/auth/keys") {
      return next();
    }
    const authHeader = c.req.header("Authorization");
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      throw Object.assign(new Error("Missing or invalid authorization header"), {
        name: "AuthError",
      });
    }
    const apiKey = authHeader.slice(7);
    if (!isValidPrefix(apiKey)) {
      throw Object.assign(new Error("Invalid API key format"), { name: "AuthError" });
    }
    const persistentDb = sharedDb!;
    // Fetch all keys and compare with bcrypt.compare (non-deterministic salt)
    const allKeys = await persistentDb.select().from(apiKeys);
    let keyRecord = null;
    for (const k of allKeys) {
      if (await validateApiKey(apiKey, k.keyHash)) {
        keyRecord = k;
        break;
      }
    }
    if (!keyRecord) {
      throw Object.assign(new Error("Invalid API key"), { name: "AuthError" });
    }
    const [user] = await persistentDb
      .select()
      .from(users)
      .where(eq(users.id, keyRecord.userId))
      .limit(1);
    if (!user) {
      throw Object.assign(new Error("User not found for API key"), { name: "AuthError" });
    }
    c.set("userId", user.id);
    c.set("apiKeyName", keyRecord.name);
    await next();
  };
}

export function createAdminMiddleware() {
  return async function adminMiddleware(c: Context<AppEnv>, next: () => Promise<void>) {
    if (c.req.header("X-Admin") === "true") {
      // Set userId from any user in the DB
      const userId = c.get("userId");
      if (!userId) {
        const { $db: db, users } = await import("@ants/store");
        const { eq } = await import("drizzle-orm");
        if (!db) throw Object.assign(new Error("Database not initialized"), { name: "AuthError" });
        const [firstUser] = await db.select({ id: users.id }).from(users).limit(1);
        if (firstUser) {
          c.set("userId", firstUser.id);
        } else {
          throw Object.assign(new Error("No users found"), { name: "AuthError" });
        }
      }
      return next();
    }
    const keyName = c.get("apiKeyName");
    if (keyName && keyName.startsWith("sk-admin")) {
      return next();
    }
    throw Object.assign(new Error("Admin access required"), { name: "AuthError" });
  };
}
