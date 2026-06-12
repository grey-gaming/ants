import bcrypt from "bcryptjs";

const API_KEY_PREFIX = "sk_";
const BCRYPT_ROUNDS = 12;

export function generateApiKey(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  const randomPart = Array.from(bytes)
    .map((b) => b.toString(36).padStart(2, "0"))
    .join("")
    .slice(0, 48);
  return `${API_KEY_PREFIX}${randomPart}`;
}

export function hashApiKey(key: string): Promise<string> {
  return bcrypt.hash(key, BCRYPT_ROUNDS);
}

export function validateApiKey(input: string, hash: string): Promise<boolean> {
  return bcrypt.compare(input, hash);
}

export function revoke(id: string): void {
  // Placeholder for DB deletion hook.
  // Actual revocation is handled by deleting the api_keys row via Drizzle.
  if (!id) {
    throw new Error("Cannot revoke: missing API key ID");
  }
}

export function isValidPrefix(key: string): boolean {
  return key.startsWith(API_KEY_PREFIX);
}
