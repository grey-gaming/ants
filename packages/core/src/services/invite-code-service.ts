import { eq, desc } from "drizzle-orm";
import { inviteCodes } from "@ants/store";
import type { InviteCode, NewInviteCode } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { generateId } from "../lib/utils";
import { NotFoundError, ConflictError } from "../lib/errors";

interface InviteCodeListOptions { limit?: number; used?: boolean; }

export interface InviteCodeService {
  generate(count: number, expiresAt?: Date): Promise<InviteCode[]>;
  validate(code: string): Promise<boolean>;
  use(code: string): Promise<boolean>;
  list(options?: InviteCodeListOptions): Promise<InviteCode[]>;
}

export function createInviteCodeService(db: PostgresJsDatabase): InviteCodeService {
  async function generate(count: number, expiresAt?: Date): Promise<InviteCode[]> {
    const codes: NewInviteCode[] = Array.from({ length: count }, () => ({
      id: generateId(),
      code: generateId().replace(/-/g, "").slice(0, 64),
      used: false,
      expiresAt: expiresAt ?? null,
    }));
    const inserted = await db.insert(inviteCodes).values(codes).returning();
    return inserted;
  }

  async function validate(code: string): Promise<boolean> {
    const [found] = await db.select().from(inviteCodes)
      .where(eq(inviteCodes.code, code)).limit(1);
    if (!found) return false;
    if (found.used) return false;
    if (found.expiresAt && found.expiresAt < new Date()) return false;
    return true;
  }

  async function use(code: string): Promise<boolean> {
    const [found] = await db.select().from(inviteCodes)
      .where(eq(inviteCodes.code, code)).limit(1);
    if (!found) throw new NotFoundError("InviteCode", code);
    if (found.used) throw new ConflictError("Code already used");
    if (found.expiresAt && found.expiresAt < new Date())
      throw new ConflictError("Code expired");
    await db.update(inviteCodes).set({ used: true })
      .where(eq(inviteCodes.code, code));
    return true;
  }

  async function list(options: InviteCodeListOptions = {}): Promise<InviteCode[]> {
    const limit = options.limit ?? 50;
    const query = db.select().from(inviteCodes)
      .orderBy(desc(inviteCodes.createdAt)).limit(limit);
    if (options.used !== undefined) {
      return query.where(eq(inviteCodes.used, options.used));
    }
    return query;
  }

  return { generate, validate, use, list };
}
