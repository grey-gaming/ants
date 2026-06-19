import { sessions, users } from "@ants/store";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Context, Env } from "hono";
import { getCookie } from "hono/cookie";

const SESSION_COOKIE_NAME = "ants_session";

type AppEnv = Env & { Variables: { userId: string } };

let sharedDb: PostgresJsDatabase | null = null;

export function createAuthMiddleware(db: PostgresJsDatabase) {
	sharedDb = db;

	return async function authMiddleware(
		c: Context<AppEnv>,
		next: () => Promise<void>,
	) {
		// Skip auth for public auth routes
		const path = c.req.path;
		if (
			path === "/v1/auth/register" ||
			path === "/v1/auth/login" ||
			path === "/v1/auth/logout"
		) {
			return next();
		}

		const token = getCookie(c)[SESSION_COOKIE_NAME];
		if (!token) {
			throw Object.assign(new Error("Not authenticated"), {
				name: "AuthError",
			});
		}

		const persistentDb = sharedDb!;
		const [session] = await persistentDb
			.select()
			.from(sessions)
			.where(eq(sessions.token, token))
			.limit(1);

		if (!session) {
			throw Object.assign(new Error("Invalid session"), { name: "AuthError" });
		}

		if (session.expiresAt < new Date()) {
			await persistentDb.delete(sessions).where(eq(sessions.id, session.id));
			throw Object.assign(new Error("Session expired"), { name: "AuthError" });
		}

		const [user] = await persistentDb
			.select({ id: users.id })
			.from(users)
			.where(eq(users.id, session.userId))
			.limit(1);

		if (!user) {
			throw Object.assign(new Error("User not found for session"), {
				name: "AuthError",
			});
		}

		c.set("userId", user.id);
		await next();
	};
}
