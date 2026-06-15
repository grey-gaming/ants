# TODO: Database Setup Script

Create a setup/init script (`scripts/setup-db.ts` or `bun run setup`) that handles first-time database configuration:

## What it should do

1. **Check prerequisites**
   - Verify PostgreSQL is running (configurable host/port)
   - Verify DATABASE_URL is set in .env

2. **Create database and user** (if they don't exist)
   - Create the `ants` user with password from env
   - Create the `ants` database owned by that user

3. **Run all migrations**
   - Execute `drizzle-kit migrate` to apply all schema migrations

4. **Seed default data**
   - Create admin user with email and password (bcrypt hashed) (e.g., `admin@localhost`)
   - Run discovery to register built-in tools (web-search, etc.)
   - Register default agent types (orchestrator, researcher)
   - Link tools to agents (researcher → web-search)

5. **Print summary**
   - Show DB connection info
   - List registered tools and agents
   - Display the admin login credentials (first-time only)

## Usage

```bash
bun run setup
```

Or with explicit DB URL:
```bash
DATABASE_URL=postgresql://... bun run setup
```

## References
- Migration files: `drizzle/0000_elite_thunderball.sql`, `drizzle/0001_add_job_queue.sql`, `drizzle/0002_lovely_spacker_dave.sql`
- Tool registry: `packages/tools/src/registry.ts`
- Agent registry: `packages/agents/src/registry.ts`
- Discovery service: `packages/core/src/services/discovery-service.ts`
