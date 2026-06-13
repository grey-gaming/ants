import { eq, desc } from "drizzle-orm";
import { apiKeys, users } from "@ants/store";
import type { ApiKey, User } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { generateApiKey, hashApiKey, validateApiKey } from "../auth/api-key";
import { NotFoundError, AuthError } from "../lib/errors";

interface ApiKeyListResult {
  id: string;
  name: string;
  key: string;
  lastUsedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
}

interface ApiKeyGenerateOptions { name?: string; expiresAt?: Date; }

export interface ApiKeyService {
  generate(userId: string, options?: ApiKeyGenerateOptions): Promise<{ key: string; apiKey: ApiKey }>;
  list(userId: string): Promise<ApiKeyListResult[]>;
  revoke(userId: string, keyId: string): Promise<void>;
  getAll(): Promise<ApiKey[]>;
  login(rawKey: string): Promise<{ user: User; key: string }>;
}

export function createApiKeyService(db: PostgresJsDatabase): ApiKeyService {
  async function maskKey(key: string): Promise<string> {
    if (key.length <= 8) return key;
    return `${key.slice(0, 4)}****${key.slice(-4)}`;
  }

  async function generate(userId: string, options?: ApiKeyGenerateOptions): Promise<{ key: string; apiKey: ApiKey }> {
    const rawKey = generateApiKey();
    const hashed = await hashApiKey(rawKey);
    const [apiKey] = await db.insert(apiKeys).values({
      userId,
      keyHash: hashed,
      name: options?.name ?? "",
      expiresAt: options?.expiresAt ?? null,
    }).returning();
    return { key: rawKey, apiKey };
  }

  async function list(userId: string): Promise<ApiKeyListResult[]> {
    const keys = await db.select().from(apiKeys)
      .where(eq(apiKeys.userId, userId)).orderBy(desc(apiKeys.createdAt));
    return Promise.all(keys.map(async (k) => ({
      id: k.id, name: k.name, key: await maskKey(k.keyHash),
      lastUsedAt: k.lastUsedAt, expiresAt: k.expiresAt,
      createdAt: k.createdAt,
    })));
  }

  async function revoke(userId: string, keyId: string): Promise<void> {
    const [found] = await db.select().from(apiKeys)
      .where(eq(apiKeys.id, keyId)).limit(1);
    if (!found) throw new NotFoundError("ApiKey", keyId);
    if (found.userId !== userId) throw new NotFoundError("ApiKey", keyId);
    await db.delete(apiKeys).where(eq(apiKeys.id, keyId));
  }

  async function getAll(): Promise<ApiKey[]> {
    return db.select().from(apiKeys).orderBy(desc(apiKeys.createdAt));
  }

  async function login(rawKey: string): Promise<{ user: User; key: string }> {
    const hashed = await hashApiKey(rawKey);
    const isValid = await validateApiKey(rawKey, hashed);
    if (!isValid) throw new AuthError("Invalid API key");
    const [keyRecord] = await db.select().from(apiKeys)
      .where(eq(apiKeys.keyHash, hashed)).limit(1);
    if (!keyRecord) throw new AuthError("Invalid API key");
    const [user] = await db.select().from(users)
      .where(eq(users.id, keyRecord.userId)).limit(1);
    if (!user) throw new AuthError("User not found for API key");
    return { user, key: rawKey };
  }

  return { generate, list, revoke, getAll, login };
}
