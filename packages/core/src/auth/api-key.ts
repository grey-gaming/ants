import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { apiKeys, users } from '@ants/store';
import type { ApiKey } from '@ants/store';

const SALT_ROUNDS = 10;
const API_KEY_PREFIX = 'sk_';
const API_KEY_LENGTH = 32;

function generateRawKey(): string {
  const bytes = new Uint8Array(API_KEY_LENGTH);
  crypto.getRandomValues(bytes);
  const hex = Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `${API_KEY_PREFIX}${hex}`;
}

/**
 * Generate a new API key for a user.
 * Returns the raw key (shown once) and the hashed record id.
 */
export async function generateApiKey(
  userId: string,
  name: string,
): Promise<{ apiKey: string; id: string }> {
  const { $db } = await import('@ants/store');
  if (!$db) throw new Error('Database not initialized');

  const rawKey = generateRawKey();
  const hash = await bcrypt.hash(rawKey, SALT_ROUNDS);

  const [record] = await $db.insert(apiKeys).values({
    userId,
    keyHash: hash,
    name,
  }).returning();

  return { apiKey: rawKey, id: record.id };
}

/**
 * Validate an API key and return the associated user.
 */
export async function validateApiKey(key: string): Promise<{
  user: typeof users.$inferSelect;
  apiKeyId: string;
} | null> {
  const { $db } = await import('@ants/store');
  if (!$db) throw new Error('Database not initialized');

  if (!key.startsWith(API_KEY_PREFIX)) return null;

  const keyRecords = await $db.select().from(apiKeys);

  for (const record of keyRecords) {
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

/**
 * Delete an API key by its ID.
 */
export async function deleteApiKey(id: string): Promise<void> {
  const { $db } = await import('@ants/store');
  if (!$db) throw new Error('Database not initialized');

  await $db.delete(apiKeys).where(eq(apiKeys.id, id));
}

/**
 * List all API keys for a user (without exposing the hash).
 */
export async function listApiKeys(userId: string): Promise<ApiKey[]> {
  const { $db } = await import('@ants/store');
  if (!$db) throw new Error('Database not initialized');

  return $db
    .select()
    .from(apiKeys)
    .where(eq(apiKeys.userId, userId));
}
