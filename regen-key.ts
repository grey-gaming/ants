import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./packages/store/src/schema.ts";
import { writeFileSync } from "fs";

const client = postgres(process.env.DATABASE_URL!);
const db = drizzle(client, { schema });

const [user] = await db.select().from(schema.users).where(eq(schema.users.email, 'mirdinj@gmail.com'));

const bytes = crypto.getRandomValues(new Uint8Array(32));
const randomPart = Array.from(bytes).map((b) => b.toString(36).padStart(2, "0")).join("").slice(0, 48);
const apiKey = "sk_" + randomPart;
const keyHash = await bcrypt.hash(apiKey, 12);

await db.update(schema.apiKeys).set({ keyHash }).where(eq(schema.apiKeys.userId, user.id));

writeFileSync("/tmp/ants-api-key.txt", apiKey);
console.log("Key saved to /tmp/ants-api-key.txt");

await client.end();
