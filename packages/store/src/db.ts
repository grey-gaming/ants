import { drizzle, type PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres, { type PostgresPool } from 'postgres';

const DATABASE_URL = process.env.DATABASE_URL;

if (!DATABASE_URL) {
  throw new Error('DATABASE_URL environment variable is required');
}

let pool: PostgresPool | null = null;

export function createPool(): PostgresPool {
  if (!pool) {
    pool = postgres(DATABASE_URL, { max: 10 });
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

// Initialize the db instance on module load
initDb();

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
