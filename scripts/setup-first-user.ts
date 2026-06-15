import { initDb, $db } from "@ants/store";
import { createUserService } from "@ants/core";

const email = process.env.SETUP_EMAIL ?? "admin@ants.local";
const password = process.env.SETUP_PASSWORD ?? "ants-admin-123";
const name = process.env.SETUP_NAME ?? "Admin User";

async function main() {
  const db = initDb();
  const userService = createUserService(db);

  try {
    const existing = await userService.findByEmail(email);
    if (existing) {
      console.log("User already exists:", email);
      console.log("  Email:", existing.email);
      console.log("  Name:", existing.name);
      return;
    }

    const user = await userService.create(email, name, password);
    console.log("First admin user created successfully:");
    console.log("  Email:", user.email);
    console.log("  Name:", user.name);
    console.log("  Password:", password);
    console.log("\nLog in at http://localhost:3001 with these credentials.");
  } catch (err) {
    if (err instanceof Error && err.message.includes("Email already registered")) {
      console.log("User already registered:", email);
      console.log("  Password:", password);
      return;
    }
    console.error("Failed to create first user:", err);
    process.exit(1);
  }
}

main();
