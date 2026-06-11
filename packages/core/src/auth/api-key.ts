import { eq, and } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { apiKeys, users } from '@ants/store';

const SALT_ROUNDS = 10;
const API_KEY_PREFIX = 'sk_';
const API_KEY_LENGTH = 32;
const KEY_LOOKUP_PREFIX_LEN = 8;

type SafeApiKey = {
  id: typeof apiKeys.$inferSelect['id'];
  userId: typeof apiKeys.$inferSelect['userId'];
  name: typeof apiKeys.$inferSelect['name'];
  keyPrefix: typeof apiKeys.$inferSelect['keyPrefix'];
  lastUsedAt: typeof apiKeys.$inferSelect['lastUsedAt'];
  expiresAt: typeof apiKeys.$inferSelect['expiresAt'];
  createdAt: typeof apiKeys.$inferSelect['createdAt'];
};

function generateRawKey(): string {
  const bytes = new Uint8Array(API_KEY_LENGTH);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${API_KEY_PREFIX}${hex}`;
}

export function extractKeyPrefix(rawKey: string): string {
  const hexPart = rawKey.slice(API_KEY_PREFIX.length);
  return hexPart.slice(0, KEY_LOOKUP_PREFIX_LEN);
}

export async function generateApiKey(
  userId: string,
  name: string,
): Promise<{ apiKey: string; id: string }> {
  const { $db } = await import('@ants/store');
  if (!$db) throw new Error('Database not initialized');

  const rawKey = generateRawKey();
  const prefix = extractKeyPrefix(rawKey);
  const hash = await bcrypt.hash(rawKey, SALT_ROUNDS);

  const [record] = await $db.insert(apiKeys).values({
    userId,
    keyPrefix: prefix,
    keyHash: hash,
    name,
  }).returning();

  return { apiKey: rawKey, id: record.id };
}

export async function validateApiKey(key: string): Promise<{
  user: typeof users.$inferSelect;
  apiKeyId: string;
} | null> {
  const { $db } = await import('@ants/store');
  if (!$db) throw new Error('Database not initialized');

  if (!key.startsWith(API_KEY_PREFIX)) return null;

  const prefix = extractKeyPrefix(key);

  const candidates = await $db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.keyPrefix, prefix));

  for (const record of candidates) {
    const match = await bcrypt.compare(key, record.keyHash);
    if (match) {
      await $db
        .update(apiKeys)
        .set({ lastUsedAt: new Date() })
        .where(eq(apiKeys.id, record.id));

      const [user] = await $db
        .select()
        .from(users)
        .where(eq(users.id, record.userId));

      if (!user) return null;

      return { user, apiKeyId: record.id };
    }
  }

  return null;
}

export async function deleteApiKey(userId: string, id: string): Promise<void> {
  const { $db } = await import('@ants/store');
  if (!$db) throw new Error('Database not initialized');

  await $db
    .delete(apiKeys)
    .where(and(eq(apiKeys.id, id), eq(apiKeys.userId, userId)));
}

export async function listApiKeys(userId: string): Promise<SafeApiKey[]> {
  const { $db } = await import('@ants/store');
  if (!$db) throw new Error('Database not initialized');

  return $db
    .select({
      id: apiKeys.id,
      userId: apiKeys.userId,
      name: apiKeys.name,
      keyPrefix: apiKeys.keyPrefix,
      lastUsedAt: apiKeys.lastUsedAt,
      expiresAt: apiKeys.expiresAt,
      createdAt: apiKeys.createdAt,
    })
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
}