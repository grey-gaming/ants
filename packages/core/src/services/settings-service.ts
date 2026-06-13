import { eq, and } from "drizzle-orm";
import { settings } from "@ants/store";
import type { Setting } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { NotFoundError } from "../lib/errors";

interface UpsertInput {
  key: string;
  value: Record<string, unknown>;
  userId?: string;
  isGlobal?: boolean;
}

export interface SettingsService {
  getAll(): Promise<Setting[]>;
  getByKey(key: string): Promise<Setting | null>;
  upsert(input: UpsertInput): Promise<Setting>;
  remove(key: string): Promise<void>;
}

export function createSettingsService(db: PostgresJsDatabase): SettingsService {
  async function getAll(): Promise<Setting[]> {
    return db.select().from(settings).orderBy(settings.key);
  }

  async function getByKey(key: string): Promise<Setting | null> {
    const [setting] = await db.select().from(settings)
      .where(eq(settings.key, key)).limit(1);
    return setting ?? null;
  }

  async function upsert(input: UpsertInput): Promise<Setting> {
    const { key, value, userId, isGlobal = false } = input;

    if (isGlobal) {
      const [found] = await db.select().from(settings)
        .where(and(eq(settings.key, key), eq(settings.isGlobal, true)))
        .limit(1);
      if (found) {
        const [updated] = await db.update(settings)
          .set({ value, updatedAt: new Date() })
          .where(eq(settings.id, found.id)).returning();
        return updated;
      }
    }

    const [created] = await db.insert(settings).values({
      key, value, userId: userId ?? null, isGlobal,
    }).returning();
    return created;
  }

  async function remove(key: string): Promise<void> {
    const existing = await getByKey(key);
    if (existing) {
      await db.delete(settings).where(eq(settings.id, existing.id));
    }
  }

  return { getAll, getByKey, upsert, remove };
}
