import type { InviteCode, User } from "@ants/store";
import { inviteCodes, users } from "@ants/store";
import bcrypt from "bcryptjs";
import { desc, eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";

interface UserUpdateInput {
	name?: string;
	password?: string;
}

interface UserListOptions {
	limit?: number;
}

export interface UserService {
	create(
		email: string,
		name: string,
		password: string,
		inviteCode?: string,
	): Promise<User>;
	getById(id: string): Promise<User | null>;
	getCurrentUser(userId: string): Promise<User>;
	update(userId: string, input: UserUpdateInput): Promise<User>;
	deactivate(userId: string, adminId: string): Promise<User>;
	list(userId: string, options?: UserListOptions): Promise<User[]>;
	findByEmail(email: string): Promise<User | null>;
	verifyPassword(user: User, password: string): Promise<boolean>;
}

export function createUserService(db: PostgresJsDatabase): UserService {
	async function checkInviteCode(code: string): Promise<void> {
		const [found] = await db
			.select()
			.from(inviteCodes)
			.where(eq(inviteCodes.code, code))
			.limit(1);
		if (!found) throw new ConflictError("Invalid invite code");
		if (found.used) throw new ConflictError("Invite code already used");
		if (found.expiresAt && found.expiresAt < new Date())
			throw new ConflictError("Invite code expired");
	}

	async function create(
		email: string,
		name: string,
		password: string,
		inviteCode?: string,
	): Promise<User> {
		if (!email?.trim()) throw new ValidationError("Email is required");
		if (!name?.trim()) throw new ValidationError("Name is required");
		if (!password || password.length < 6)
			throw new ValidationError("Password must be at least 6 characters");
		if (inviteCode) {
			await checkInviteCode(inviteCode);
			await db
				.update(inviteCodes)
				.set({ used: true })
				.where(eq(inviteCodes.code, inviteCode));
		}
		const passwordHash = await bcrypt.hash(password, 12);
		try {
			const [user] = await db
				.insert(users)
				.values({
					email: email.trim().toLowerCase(),
					name: name.trim(),
					passwordHash,
				})
				.returning();
			return user;
		} catch (err: unknown) {
			if (
				err instanceof Error &&
				(err.message.includes("23505") || err.message.includes("unique"))
			) {
				throw new ConflictError("Email already registered");
			}
			throw err;
		}
	}

	async function getById(id: string): Promise<User | null> {
		const [user] = await db.select().from(users).where(eq(users.id, id));
		return user ?? null;
	}

	async function getCurrentUser(userId: string): Promise<User> {
		const user = await getById(userId);
		if (!user) throw new NotFoundError("User", userId);
		return user;
	}

	async function update(userId: string, input: UserUpdateInput): Promise<User> {
		const existing = await getById(userId);
		if (!existing) throw new NotFoundError("User", userId);
		const updates: Record<string, unknown> = { updatedAt: new Date() };
		if (input.name !== undefined) updates.name = input.name.trim();
		if (input.password !== undefined)
			updates.passwordHash = await bcrypt.hash(input.password, 12);
		const [updated] = await db
			.update(users)
			.set(updates)
			.where(eq(users.id, userId))
			.returning();
		return updated;
	}

	async function deactivate(userId: string, _adminId: string): Promise<User> {
		const existing = await getById(userId);
		if (!existing) throw new NotFoundError("User", userId);
		const [updated] = await db
			.update(users)
			.set({
				email: `${existing.email}.deactivated`,
				updatedAt: new Date(),
			})
			.where(eq(users.id, userId))
			.returning();
		return updated;
	}

	async function list(
		_userId: string,
		options: UserListOptions = {},
	): Promise<User[]> {
		const limit = options.limit ?? 50;
		return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
	}

	async function findByEmail(email: string): Promise<User | null> {
		const [user] = await db
			.select()
			.from(users)
			.where(eq(users.email, email.trim().toLowerCase()))
			.limit(1);
		return user ?? null;
	}

	async function verifyPassword(
		user: User,
		password: string,
	): Promise<boolean> {
		return bcrypt.compare(password, user.passwordHash);
	}

	return {
		create,
		getById,
		getCurrentUser,
		update,
		deactivate,
		list,
		findByEmail,
		verifyPassword,
	};
}
