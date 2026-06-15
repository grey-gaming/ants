import bcrypt from "bcryptjs";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./packages/store/src/schema.ts";
import { eq } from "drizzle-orm";
import { writeFileSync } from "fs";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

// Use our test user
const userId = "00000000-0000-0000-0000-000000000001";

const bytes = crypto.getRandomValues(new Uint8Array(32));
const randomPart = Array.from(bytes).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 48);
const apiKey = "sk_" + randomPart;
const keyHash = await bcrypt.hash(apiKey, 12);

// Insert new API key using schema
const apiKeys = schema.apiKeys;
await db.insert(apiKeys).values({
  id: crypto.randomUUID(),
  userId,
  keyHash,
  name: "E2E Test Key",
  expiresAt: null,
});

writeFileSync("/tmp/ants-e2e-api-key.txt", apiKey);
console.log("API Key for E2E tests:", apiKey);
console.log("Also saved to /tmp/ants-e2e-api-key.txt");

await client.end();
