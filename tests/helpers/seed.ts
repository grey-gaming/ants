import bcrypt from "bcryptjs";
import postgres from "postgres";

const db = postgres(
	process.env.DATABASE_URL || "postgresql://ants:***@localhost:5432/ants",
	{ max: 1 },
);

export async function seedTestUser() {
	const adminUser = "00000000-0000-0000-0000-000000000001";
	const password = "admin123";
	const passwordHash = await bcrypt.hash(password, 12);

	await db`INSERT INTO users (id, email, name, password_hash, created_at, updated_at)
    VALUES (${adminUser}, 'admin@example.com', 'Admin User', ${passwordHash}, NOW(), NOW())
    ON CONFLICT (id) DO UPDATE SET password_hash = ${passwordHash}`;

	console.log("Seeded test user with id:", adminUser);
	await db.end();
}

if (import.meta.main) {
	seedTestUser().catch(console.error);
}
