/**
 * ANTS database setup script.
 *
 * Handles first-time initialization:
 *  1. Check prerequisites (Docker, DATABASE_URL)
 *  2. Start PostgreSQL container via docker compose
 *  3. Run all Drizzle migrations
 *  4. Seed admin user + register built-in tools/agents
 *  5. Print summary
 *
 * Usage:
 *   bun run setup:db
 *
 * Environment (override in .env or pass inline):
 *   DATABASE_URL     — required, PostgreSQL connection string
 *   SETUP_EMAIL      — admin email (default: admin@ants.local)
 *   SETUP_PASSWORD   — admin password (default: ants-admin-123)
 *   SETUP_NAME       — admin display name (default: Admin User)
 */

import { agentRegistry } from "@ants/agents";
import {
	config,
	createUserService,
	discoverAndRegister,
} from "@ants/core";
import { toolRegistry } from "@ants/tools";
import { connect, disconnect } from "@ants/store";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import { spawn } from "node:child_process";
import { promisify } from "node:util";

// Node polyfills for child_process
const execFile = promisify(spawn);

// ─── Helpers ────────────────────────────────────────────────────────────────

function logStep(label: string): void {
	console.log(`\n${"=".repeat(60)}`);
	console.log(`  ${label}`);
	console.log("=".repeat(60));
}

function logOk(msg: string): void {
	console.log(`  ✓ ${msg}`);
}

function logWarn(msg: string): void {
	console.log(`  ⚠ ${msg}`);
}

function fatal(msg: string): never {
	console.error(`\n  ✗ ${msg}`);
	process.exit(1);
}

async function runCommand(
	cmd: string,
	args: string[],
	{ timeout = 60_000 }: { timeout?: number } = {},
): Promise<void> {
	console.log(`  $ ${cmd} ${args.join(" ")}`);

	const proc = spawn(cmd, args, { stdio: "inherit" });

	const exitCode = await Promise.race<number | undefined>([
		new Promise<number | undefined>((resolve) => {
			proc.on("close", (code) => resolve(code ?? 1));
			proc.on("error", () => resolve(1));
		}),
		new Promise<number>((_, reject) =>
			setTimeout(() => {
				proc.kill();
				reject(new Error(`${cmd} timed out (${timeout}ms)`));
			}, timeout),
		),
	]);

	if (exitCode !== 0) {
		throw new Error(`Command exited with code ${exitCode}: ${cmd} ${args.join(" ")}`);
	}
}

// ─── Step 1: Check prerequisites ───────────────────────────────────────────

async function checkPrerequisites(): Promise<void> {
	logStep("Step 1: Checking prerequisites");

	// Bun auto-loads .env for scripts started via bun run
	if (!process.env.DATABASE_URL) {
		fatal(
			"DATABASE_URL not set. Copy .env.example to .env and configure it.\n" +
				"  Docker default: postgresql://ants:ants-dev-password@localhost:5432/ants",
		);
	}
	logOk("DATABASE_URL is set");

	// Check Docker is running
	try {
		await runCommand("docker", ["info"], { timeout: 10_000 });
		logOk("Docker Desktop is running");
	} catch {
		fatal(
			"Docker is not running or not installed.\n" +
				"  Install Docker Desktop from https://www.docker.com/products/docker-desktop",
		);
	}
}

// ─── Step 2: Start PostgreSQL container ─────────────────────────────────────

async function ensureDatabase(): Promise<void> {
	logStep("Step 2: Starting PostgreSQL container");

	try {
		await runCommand("docker", [
			"compose",
			"up",
			"-d",
			"--wait",
			"postgres",
		], { timeout: 120_000 });
		logOk("PostgreSQL container is running");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		throw new Error(`Failed to start PostgreSQL container:\n${msg}`);
	}
}

// ─── Step 3: Run migrations ────────────────────────────────────────────────

async function runMigrations(): Promise<void> {
	logStep("Step 3: Running database migrations");

	try {
		await runCommand("bun", ["run", "db:migrate"], { timeout: 60_000 });
		logOk("All migrations applied");
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		fatal(`Migration failed:\n${msg}`);
	}
}

// ─── Step 4: Seed data ──────────────────────────────────────────────────────

async function seedData(): Promise<void> {
	logStep("Step 4: Seeding data");

	// Connect to database
	await connect();
	const db = drizzle(postgres(config.databaseUrl, { max: 1 }));
	const userService = createUserService(db);

	// --- Admin user ---
	const email = process.env.SETUP_EMAIL || "admin@ants.local";
	const password = process.env.SETUP_PASSWORD || "ants-admin-123";
	const name = process.env.SETUP_NAME || "Admin User";

	try {
		const existing = await userService.findByEmail(email);
		if (existing) {
			logWarn(`User "${email}" already exists — skipping`);
		} else {
			const user = await userService.create(email, name, password);
			logOk(`Admin user created: ${user.email}`);
		}
	} catch (err) {
		if (
			err instanceof Error &&
			err.message.includes("Email already registered")
		) {
			logWarn(`User "${email}" already exists — skipping`);
		} else {
			throw err;
		}
	}

	// --- Discover and register tools + agents ---
	const toolEntries = toolRegistry.getAll().map((entry) => ({
		name: entry.definition.name,
		description: entry.definition.description,
		type: "builtin" as const,
		parametersSchema: toolRegistry.zodToJsonSchema(entry.parameters),
	}));

	const agentEntries = agentRegistry.getAll().map((agent) => ({
		name: agent.name,
		tier: agent.tier,
		description: agent.description,
		modelConfig: agent.defaultModelConfig ?? null,
		capabilities: agent.defaultCapabilities ?? null,
		toolNames: agent.toolNames ?? null,
	}));

	const discovery = await discoverAndRegister(db, toolEntries, agentEntries);

	if (discovery.toolsRegistered.length > 0) {
		logOk(`Registered tools: ${discovery.toolsRegistered.join(", ")}`);
	} else if (discovery.toolsSkipped.length > 0) {
		logWarn(`Tools already registered: ${discovery.toolsSkipped.join(", ")}`);
	} else {
		logWarn("No tools discovered");
	}

	if (discovery.agentsRegistered.length > 0) {
		logOk(`Registered agents: ${discovery.agentsRegistered.join(", ")}`);
	} else if (discovery.agentsSkipped.length > 0) {
		logWarn(`Agents already registered: ${discovery.agentsSkipped.join(", ")}`);
	} else {
		logWarn("No agents discovered");
	}
}

// ─── Step 5: Print summary ─────────────────────────────────────────────────

function printSummary(
	email: string,
	password: string,
	name: string,
): void {
	logStep("Setup Complete");

	console.log(`\n  Database: ${process.env.DATABASE_URL}`);
	console.log(`  Container: ants-db (port 5432)\n`);
	console.log("  Admin credentials:");
	console.log(`    Email:    ${email}`);
	console.log(`    Name:     ${name}`);
	console.log(`    Password: ${password}`);
	console.log(`\n  Next steps:`);
	console.log(`    bun run dev                   — start API server`);
	console.log(`    cd packages/ui && bun run dev  — start UI dev server`);
	console.log(`\n  Manage the database:`);
	console.log(`    bun run docker:up               — start`);
	console.log(`    bun run docker:down             — stop`);
	console.log(`    bun run docker:logs             — logs`);
	console.log();
}

// ─── Main ───────────────────────────────────────────────────────────────────

async function main() {
	console.log("\n  🐜 ANTS Database Setup");

	const email = process.env.SETUP_EMAIL || "admin@ants.local";
	const password = process.env.SETUP_PASSWORD || "ants-admin-123";
	const name = process.env.SETUP_NAME || "Admin User";

	try {
		await checkPrerequisites();
		await ensureDatabase();
		await runMigrations();
		await seedData();
		printSummary(email, password, name);
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		fatal(msg);
	} finally {
		await disconnect();
	}
}

main();
