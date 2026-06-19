import postgres from "postgres";

// Database connection for integration tests
export const testDb = postgres(
	process.env.DATABASE_URL || "postgresql://ants:***@localhost:5432/ants",
	{
		max: 1,
		max_lifetime: 1,
	},
);

export async function setupTestDb() {
	// Ensure tables exist by running migrations
	// In production tests, you'd use testcontainers
}

export async function cleanupTestDb() {
	// Truncate all tables in reverse dependency order
	await testDb`TRUNCATE TABLE messages, run_steps, runs, threads RESTART IDENTITY CASCADE`;
	await testDb.end();
}
