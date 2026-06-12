import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Sql } from 'postgres';

let pool: Sql | null = null;

export function createPool(): Sql {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
  }
  if (!pool) {
    pool = postgres(url, { max: 10 });
   }
  return pool;
}

export let $db: PostgresJsDatabase | null = null;

export function initDb(): PostgresJsDatabase {
  if (!$db) {
    const pgPool = createPool();
    $db = drizzle(pgPool);
   }
  return $db;
}

/**
 * Connect to the database.
 * Creates a new connection pool and drizzle instance.
 * Useful for tests and serverless cold starts.
 */
export async function connect(): Promise<void> {
  await disconnect();
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL environment variable is required');
   }
  pool = postgres(url, { max: 10 });
  $db = drizzle(pool);
}

/**
 * Disconnect from the database.
 * Destroys the current connection pool.
 */
export async function disconnect(): Promise<void> {
  try {
    if (pool) {
      await pool.end();
      pool = null;
      $db = null;
    }
  } catch {
    // pool.end() may throw if connection is already closed;
    // ensure stale state is cleaned up regardless
    pool = null;
    $db = null;
  }
}
