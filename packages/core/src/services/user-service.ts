import { eq, desc } from "drizzle-orm";
import { users, inviteCodes } from "@ants/store";
import type { User, InviteCode } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { hashApiKey } from "../auth/api-key";
import { NotFoundError, ValidationError, ConflictError } from "../lib/errors";

interface UserUpdateInput {
  name?: string;
  password?: string;
}

interface UserListOptions { limit?: number; }

export interface UserService {
  create(email: string, name: string, inviteCode?: string): Promise<User>;
  getById(id: string): Promise<User | null>;
  getCurrentUser(userId: string): Promise<User>;
  update(userId: string, input: UserUpdateInput): Promise<User>;
  deactivate(userId: string, adminId: string): Promise<User>;
  list(userId: string, options?: UserListOptions): Promise<User[]>;
}

export function createUserService(db: PostgresJsDatabase): UserService {
  async function checkInviteCode(code: string): Promise<void> {
    const [found] = await db.select().from(inviteCodes)
      .where(eq(inviteCodes.code, code)).limit(1);
    if (!found) throw new ConflictError("Invalid invite code");
    if (found.used) throw new ConflictError("Invite code already used");
    if (found.expiresAt && found.expiresAt < new Date())
      throw new ConflictError("Invite code expired");
  }

  async function create(email: string, name: string, inviteCode?: string): Promise<User> {
    if (!email?.trim()) throw new ValidationError("Email is required");
    if (!name?.trim()) throw new ValidationError("Name is required");
    if (inviteCode) {
      await checkInviteCode(inviteCode);
      await db.update(inviteCodes).set({ used: true })
        .where(eq(inviteCodes.code, inviteCode));
    }
    const [user] = await db.insert(users).values({
      email: email.trim().toLowerCase(), name: name.trim(),
    }).returning();
    return user;
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
    if (input.password !== undefined) updates.passwordHash = await hashApiKey(input.password);
    const [updated] = await db.update(users).set(updates)
      .where(eq(users.id, userId)).returning();
    return updated;
  }

  async function deactivate(userId: string, _adminId: string): Promise<User> {
    const existing = await getById(userId);
    if (!existing) throw new NotFoundError("User", userId);
    const [updated] = await db.update(users).set({
      email: `${existing.email}.deactivated`, updatedAt: new Date(),
    }).where(eq(users.id, userId)).returning();
    return updated;
  }

  async function list(_userId: string, options: UserListOptions = {}): Promise<User[]> {
    const limit = options.limit ?? 50;
    return db.select().from(users).orderBy(desc(users.createdAt)).limit(limit);
  }

  return { create, getById, getCurrentUser, update, deactivate, list };
}
