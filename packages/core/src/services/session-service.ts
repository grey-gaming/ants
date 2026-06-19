import { sessions } from "@ants/store";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

export interface SessionService {
	create(userId: string): Promise<string>;
	validate(token: string): Promise<{ userId: string; expiresAt: Date } | null>;
	destroy(token: string): Promise<void>;
	destroyByUserId(userId: string): Promise<void>;
}

export function createSessionService(db: PostgresJsDatabase): SessionService {
	function generateToken(): string {
		const bytes = crypto.getRandomValues(new Uint8Array(32));
		return Array.from(bytes)
			.map((b) => b.toString(16).padStart(2, "0"))
			.join("");
	}

	async function create(userId: string): Promise<string> {
		const token = generateToken();
		const expiresAt = new Date(Date.now() + SESSION_DURATION_MS);
		await db.insert(sessions).values({
			userId,
			token,
			expiresAt,
		});
		return token;
	}

	async function validate(
		token: string,
	): Promise<{ userId: string; expiresAt: Date } | null> {
		const [session] = await db
			.select()
			.from(sessions)
			.where(eq(sessions.token, token))
			.limit(1);
		if (!session) return null;
		if (session.expiresAt < new Date()) {
			await db.delete(sessions).where(eq(sessions.id, session.id));
			return null;
		}
		return { userId: session.userId, expiresAt: session.expiresAt };
	}

	async function destroy(token: string): Promise<void> {
		await db.delete(sessions).where(eq(sessions.token, token));
	}

	async function destroyByUserId(userId: string): Promise<void> {
		await db.delete(sessions).where(eq(sessions.userId, userId));
	}

	return { create, validate, destroy, destroyByUserId };
}
