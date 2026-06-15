# AGENTS.md — Coding Agent Guide for ANTS

This file guides the Qwen3-35B-A3B coding agent working on ANTS. Follow every rule here. When in doubt, re-read this file.

---

## Project Overview

ANTS (Autonomous Networked Task System) is a **multi-agent orchestrator** with a React-based web UI and a REST/SSE API. It runs **local inference only** via Ollama — no cloud APIs, no telemetry. The architecture uses a 3-tier conversational hub-and-spoke model (T1 Orchestrator → T2 Specialists → T3 Task Agents). The API is defined by a well-defined OpenAPI 3.1 spec. The system is privacy-first and offline-first: nothing leaves the machine.

---

## Tech Stack

- **Runtime**: Bun (native TypeScript, built-in test runner)
- **Language**: TypeScript strict mode
- **Framework**: Hono (routing, middleware, SSE streaming)
- **ORM**: Drizzle (type-safe SQL, schema-as-code, migrations)
- **LLM Client**: Vercel AI SDK (streaming, tool calling, provider abstraction)
- **Validation**: Zod + openapi-typescript (spec-driven types)
- **Database**: PostgreSQL + pgvector (single DB, no Redis)
- **LLM Provider**: Ollama (local, abstracted behind provider interface)
- **API Spec**: OpenAPI 3.1 (spec-first development)
- **Auth**: HTTP-only cookie sessions + email/password login (bcrypt)
- **UI**: React 19 + Vite + Tailwind + shadcn/ui + Radix primitives + Zustand + React Router
- **UI Tooling**: Biome (lint), TypeScript, Sonner (toasts), Lucide icons, Cmdk (command palette)

---

## Commands

```bash
bun install              # Install dependencies
bun run dev              # Start development server
bun test                 # Run all tests
bun test --coverage      # Run tests with coverage report
bun run lint              # Lint code
bun run typecheck         # Type-check code
bun run db:migrate        # Run database migrations
bun run db:generate       # Generate Drizzle migrations from schema
bun run setup:db          # Set up database and create first admin user
cd packages/ui && bun run dev   # Start UI dev server (Vite)
cd packages/ui && bun run build # Build UI for production
cd packages/ui && bun run lint  # Lint UI code (Biome)
cd packages/ui && bun ui:add    # Add shadcn/ui component
```

---

## File Structure

ANTS uses a Bun workspace monorepo. See ADR-017 for full rationale.

```
packages/
  core/                    # @ants/core — depends on @ants/store
    src/
      services/            # Business logic (thread, message, run, agent, queue)
      auth/                # bcrypt password hashing utilities
      lib/                 # errors.ts, logger.ts, config.ts, utils.ts
  agents/                  # @ants/agents — depends on @ants/core only
    src/
      orchestrator.ts      # T1 orchestrator agent
      research.ts          # T3 research task agent
      base-agent.ts        # Abstract base agent
      registry.ts          # Agent type registry
  tools/                   # @ants/tools — depends on @ants/core only
    src/
      base-tool.ts         # Abstract base tool
      web-search.ts        # Web search tool implementation
      registry.ts          # Tool registry
  api/                     # @ants/api — depends on all packages
    src/
      index.ts             # Entry point
      routes/              # Thin route handlers (no logic)
      middleware/           # Auth, rate-limit, error-handler, logging
      schemas/             # Zod request/response schemas
      app.ts               # Hono app assembly + registry wiring
  llm/                     # @ants/llm — depends on @ants/core only
    src/
      provider.ts          # LLM provider interface
      ollama.ts            # Ollama provider implementation
      stream.ts            # Streaming utilities
  store/                   # @ants/store — no dependencies
    src/
      schema.ts            # Drizzle schema definitions
      migrations/          # Database migrations
  ui/                      # @ants/ui — React web frontend
    src/
      main.tsx             # React entry point
      routes.tsx           # React Router route definitions
      stores/              # Zustand state stores (theme, sidebar)
      hooks/               # Custom hooks (api.ts)
      components/
        ui/                # shadcn/ui primitives (button, card, dialog, etc.)
        ants/              # ANTS-specific components (chat-bubble, thread-card, run-tree, agent-avatar, agent-status, mobile-nav)
        layout/            # Layout components (app-shell, sidebar, topbar, command-palette, auth-guard)
tests/
  integration/             # Real Ollama + real PostgreSQL tests
  contract/                # OpenAPI spec conformance
  helpers/                 # test-db.ts, seed.ts, mock-provider.ts, fixtures.ts
```

---

## Coding Conventions

### Size Limits
- **Functions**: MAX ~30 lines. If longer, split into named helper functions.
- **Files**: MAX ~150 lines. Prefer smaller. If a file grows, split by responsibility.

### TypeScript
- **Strict mode** is always on. No `any`, no `// @ts-ignore`. Use Zod schemas for runtime types.
- Every function parameter and return type must be explicitly typed.
- Use `interface` for object shapes, `type` for unions/intersections.

### Architecture Boundaries
- **Routes call services, never contain logic.** A route validates input (Zod), calls a service, returns a response. That's it.
- **Services call models/agents/tools.** Business logic lives in services, not routes, not models.
- **LLM calls go through Vercel AI SDK only.** Never call Ollama directly. Use the provider interface in `@ants/llm/provider.ts`.
- **All DB access goes through Drizzle.** No raw SQL, no `pg` query directly. Define queries in model files.
- **All input validation uses Zod.** Every API endpoint validates request body/params with Zod schemas.
- **Structured errors from `@ants/core`.** Never throw raw `Error`. Use `NotFoundError`, `ValidationError`, `AuthError`, etc.
- **Package boundaries are strict.** `@ants/store` depends on nothing. `@ants/core` depends only on `@ants/store`. `@ants/agents`, `@ants/tools`, and `@ants/llm` depend only on `@ants/core`. `@ants/api` depends on all packages and wires them together.
- **Never reach into package internals from another package.** Import from the package's public API (`@ants/core`, `@ants/agents`), never from deep paths like `@ants/core/lib/errors`.
- **Registries are config-driven.** Agent and tool registries are populated from database tables at startup. Adding a new agent or tool requires implementing it in the correct package and inserting a database row, not modifying `@ants/api`.

### Tests + Code + Docs as a Unit
- When you change code, always consider: does this need new tests? Updated tests? Updated docs?
- A change to a route requires updating the corresponding service test and route test.
- A change to the data model requires updating the Drizzle schema AND running a migration.
- Always reference the relevant ADR when making architectural decisions.

---

## ALWAYS DO

- **Read files first** before editing. Understand context before changing code.
- **Run tests** after making changes: `bun test`
- **Write tests** for every non-trivial code path. Target 80-90% branch coverage.
- **Mock at the provider level** using `mockLanguageModel` from `ai/test`. Never mock HTTP calls.
- **Use `app.request()`** for testing HTTP endpoints. Never use supertest.
- **Use testcontainers** for integration tests requiring PostgreSQL. Never use production DB.
- **Update docs** when behavior changes. Architecture changes → update architecture.md or create ADR.
- **Reference ADRs** when making decisions that align with or deviate from documented choices.
- **Keep functions small** — MAX ~30 lines. Keep files small — MAX ~150 lines.
- **Consider tests + code + docs as one unit.** Change code → update tests → update docs.
- **Use Drizzle for all DB access.** Define schema in `@ants/store`, queries in model files.
- **Validate all inputs with Zod.** Every endpoint, every service method.
- **Use structured errors from `@ants/core`.**
- **Co-locate unit tests** with source files: `thread-service.test.ts` next to `thread-service.ts`.
- **Respect package boundaries.** `@ants/core` never imports from agents/tools/api. Agents and tools only import from `@ants/core`. `@ants/api` imports from all packages but contains no logic.
- **Use config-driven registries.** Register agents and tools via database rows, not hardcoded imports in `@ants/api`.

---

## NEVER DO

- **No complex generics** — keep types simple and readable. Small models struggle with advanced TS patterns.
- **No over-commenting** — code should be self-documenting. Comments only for "why", never "what".
- **No unnecessary abstractions** — don't create interfaces, base classes, or patterns that aren't needed yet.
- **No hallucinated APIs** — if you're unsure about an API, read the source or docs first. Never guess.
- **Never skip tests** — every non-trivial change needs test coverage.
- **No `any` type** — never. Use Zod schemas, proper interfaces, or generics (simple ones).
- **No raw SQL** — all database queries go through Drizzle. No `db.execute(sql`...`)`.
- **No direct Ollama calls** — always go through the Vercel AI SDK provider abstraction.
- **No supertest** — use Hono's `app.request()` for HTTP endpoint testing.
- **Don't test LLM quality** — test that ANTS handles LLM outputs correctly, not that outputs are "good".
- **No Redis or Qdrant** — PostgreSQL only. See ADR-013.
- **No CLI-only restriction** — ANTS includes a React web UI in `packages/ui`. ADR-009 was superseded when the UI was added.
- **No cloud APIs** — no OpenAI, Anthropic, Google. Local inference only via Ollama. See ADR-008.
- **No static-only classes** — use plain module exports instead of classes with only static methods.
- **No barrel files** — no `index.ts` files that re-export everything from a directory.
- **No deep nesting** — max 3 levels of nesting. Extract into separate functions.
- **No integration tests in `src/`** — integration tests go in `tests/integration/`, contract tests in `tests/contract/`.
- **Core never imports agents/tools** — `@ants/core` depends only on `@ants/store`. See ADR-017.
- **Never reach into package internals** — import from `@ants/core`, `@ants/agents`, never from deep paths within packages.

---

## Code Examples

### Route File — Thin Handler, No Logic

```typescript
// packages/api/src/routes/threads.ts
import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import { createThreadSchema } from "@ants/api";
import { threadService } from "@ants/core";
import { NotFoundError } from "@ants/core";

const threads = new Hono();

threads.post(
  "/",
  zValidator("json", createThreadSchema),
  async (c) => {
    const userId = c.get("userId");
    const input = c.req.valid("json");
    const thread = await threadService.create(userId, input);
    return c.json(thread, 201);
  }
);

threads.get("/:id", async (c) => {
  const userId = c.get("userId");
  const id = c.req.param("id");
  const thread = await threadService.getById(userId, id);
  if (!thread) throw new NotFoundError("Thread", id);
  return c.json(thread);
});

export { threads };
```

### Service File — Business Logic, Drizzle DB, Structured Errors

```typescript
// packages/store/src/thread-model.ts
import { db } from "@ants/store";
import { threads } from "@ants/store";
import { eq, and } from "drizzle-orm";
import { NotFoundError, ValidationError } from "@ants/core";

async function create(userId: string, input: { title: string }) {
  if (!input.title.trim()) {
    throw new ValidationError("Title must not be empty");
  }
  const [thread] = await db.insert(threads).values({
    userId,
    title: input.title,
  }).returning();
  return thread;
}

async function getById(userId: string, id: string) {
  const [thread] = await db.select().from(threads).where(
    and(eq(threads.id, id), eq(threads.userId, userId))
  );
  return thread ?? null;
}

async function list(userId: string, limit = 50) {
  return db.select().from(threads)
    .where(eq(threads.userId, userId))
    .limit(limit);
}

export const threadService = { create, getById, list };
```

### Test File — Bun Test, app.request(), focused assertions

```typescript
// packages/core/src/services/thread-service.test.ts
import { describe, test, expect, beforeEach } from "bun:test";
import { createApp } from "@ants/api";
import { createTestDb } from "../../tests/helpers/test-db";
import { seedTestData } from "../../tests/helpers/seed";

describe("POST /v1/threads", () => {
  let app: ReturnType<typeof createApp>;

  beforeEach(async () => {
    const { db } = await createTestDb();
    await seedTestData(db);
    app = createApp({ db });
  });

  // Auth via cookies — login first at POST /v1/auth/login with { email, password }
  // The session cookie (ants_session) is HTTP-only and sent automatically.
  let sessionCookie: string;
  beforeAll(async () => {
    const loginRes = await app.request("/v1/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: "test@test.com", password: "test-password" }),
    });
    expect(loginRes.status).toBe(200);
    const setCookie = loginRes.headers.get("set-cookie");
    expect(setCookie).toBeDefined();
    sessionCookie = setCookie!;
  });

  test("creates a thread and returns 201", async () => {
    const res = await app.request("/v1/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ title: "New Thread" }),
    });
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.title).toBe("New Thread");
    expect(body.id).toBeDefined();
  });

  test("returns 401 without valid session", async () => {
    const res = await app.request("/v1/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test" }),
    });
    expect(res.status).toBe(401);
  });

  test("returns 422 for empty title", async () => {
    const res = await app.request("/v1/threads", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: sessionCookie,
      },
      body: JSON.stringify({ title: "" }),
    });
    expect(res.status).toBe(422);
  });
});
```

---

## Testing Rules

- **Pragmatic test-first**: Tests must exist before merge. Write order is flexible.
- **Bun test runner**: `bun test`. No Jest, no Vitest as separate dependency.
- **Mock at provider level**: Use `mockLanguageModel` from `ai/test`. Never mock HTTP calls (nock/msw).
- **`app.request()` for HTTP tests**: Full middleware chain, no server startup.
- **testcontainers for DB tests**: Fresh PostgreSQL per test run. Never use shared or production DB.
- **80-90% branch coverage**: Minimum 80% enforced in CI. Don't chase 100%.
- **Co-located unit tests**: `thread-service.test.ts` next to `thread-service.ts`.
- **Integration tests in `tests/integration/`**: Require real Ollama + real PostgreSQL.
- **Contract tests in `tests/contract/`**: Validate OpenAPI spec conformance.
- **Never test LLM quality**: Test that ANTS handles LLM outputs correctly, not that outputs are "good".
- **Script tool call sequences** using `mockLanguageModel` `doStream` for multi-turn agent flows.
- **Never use supertest**: Use Hono `app.request()` instead.

---

## Documentation Rules

- **Update docs when behavior changes**: If you change an API endpoint, update the OpenAPI spec.
- **ADRs are immutable**: Never modify an existing ADR. Create a new one to supersede.
- **Create new ADRs for new decisions**: Any decision that affects architecture, tech choices, or patterns gets an ADR.
- **Architecture doc is canonical**: All implementation must align with `docs/architecture.md`.
- **When in doubt, document it**: A brief note in an ADR is better than an unwritten decision.

---

## ADR Reference

| # | Title | Description |
|---|-------|-------------|
| 001 | Language - TypeScript | Best AI-agent code quality, type safety, massive ecosystem |
| 002 | Runtime - Bun | Native TS execution, fast startup, built-in test runner |
| 003 | Framework - Hono | Ultra-lightweight, streaming-first, OpenAPI integration |
| 004 | ORM - Drizzle | Type-safe SQL, schema-as-code, zero runtime overhead |
| 005 | Database - PostgreSQL | ACID, JSONB, self-referencing FKs, pgvector future |
| 006 | LLM Client - Vercel AI SDK | Unified streaming, tool calling, provider-agnostic |
| 007 | Validation - Zod + openapi-typescript | Runtime validation + spec-driven types, single source of truth |
| 008 | LLM Provider - Ollama | Local inference, Metal acceleration, provider abstraction |
| 009 | API-First, No UI | Pure API system, no web interface or dashboard |
| 010 | OpenAI-Inspired Custom API | Familiar patterns, diverging where ANTS needs differ |
| 011 | 3-Tier Conversational Hub-and-Spoke | T1→T2→T3 delegation with multi-turn dialogue |
| 012 | Sub-threads via Run Tree | parent_run_id for sub-threads, not separate Thread entities |
| 013 | Single Database (PostgreSQL Only) | No Redis, no Qdrant — PostgreSQL handles everything |
| 014 | Session-Based Cookie Auth | HTTP-only cookie sessions, email/password login, bcrypt passwords |
| 015 | Project Name - ANTS | Autonomous Networked Task System — the orchestration engine |
| 016 | Testing Strategy | Pragmatic test-first, provider mocking, testcontainers, 80-90% coverage |
| 017 | Repository Structure | Bun workspace monorepo, strict dependency DAG, config-driven registries |