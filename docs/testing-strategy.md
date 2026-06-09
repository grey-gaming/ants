# ANTS Testing Strategy

> **Status**: Canonical Reference
> **Last Updated**: 2026-06-09
> **Version**: 1.0

---

## Table of Contents

1. [Testing Philosophy: Pragmatic Test-First](#1-testing-philosophy-pragmatic-test-first)
2. [Test Framework: Bun Built-in Test Runner](#2-test-framework-bun-built-in-test-runner)
3. [HTTP Testing: Hono app.request()](#3-http-testing-hono-apprequest)
4. [Mocking Strategy: Provider Interface Level](#4-mocking-strategy-provider-interface-level)
5. [Test Database: Fresh PostgreSQL Per Test Run](#5-test-database-fresh-postgresql-per-test-run)
6. [Streaming Testing](#6-streaming-testing)
7. [Coverage Target: 80-90% Branch Coverage](#7-coverage-target-80-90-branch-coverage)
8. [Test Types](#8-test-types)
9. [Test Structure](#9-test-structure)
10. [CI Integration](#10-ci-integration)

---

## 1. Testing Philosophy: Pragmatic Test-First

Tests must exist before a feature is considered done, but we do not follow strict TDD red-green-refactor. The goal is **confidence that the system works**, not religious adherence to a methodology.

### Principles

- **Write tests that matter** — test behavior, not implementation. Tests that assert internal function calls or private state are brittle and provide false confidence.
- **Every code path should be tested** — happy paths, error paths, and edge cases. If a branch exists, a test should cover it.
- **Tests should be deterministic and fast** — unit tests must produce the same result every time, regardless of environment. Non-deterministic tests belong in integration tests, clearly marked.
- **Pragmatic ordering** — write code, write tests, make both pass. Don't religiously write tests first every single time. The important thing is that tests exist and are comprehensive before a feature is merged.
- **Test OUR code, not the LLM** — we do not test whether Ollama produces good outputs. We test that ANTS correctly handles whatever the LLM produces — valid responses, tool calls, errors, and malformed outputs.

### What "Done" Means

A feature is not done until:

1. Unit tests cover all non-trivial code paths (happy, error, edge).
2. Integration tests validate the feature works end-to-end with real infrastructure (where applicable).
3. Branch coverage is ≥ 80% for the changed files.
4. CI passes with no regressions.

---

## 2. Test Framework: Bun Built-in Test Runner

Use Bun's built-in test runner exclusively. It provides a Vitest-compatible API (`describe`, `test`, `expect`, `beforeEach`, `afterEach`, `mock`, etc.) and requires zero additional dependencies.

This decision aligns with [ADR-002 (Bun Runtime)](./adrs/002-runtime-bun.md) — Bun replaces Jest, Vitest, and their configuration overhead with one built-in tool.

### Configuration

Test configuration lives in `bunfig.toml` at the project root:

```toml
[test]
preload = ["./tests/setup.ts"]
coverage = true
coverageThreshold = 80
coverageReporter = ["text", "lcov"]
```

### Running Tests

```bash
# All tests
bun test

# Specific test file
bun test tests/unit/services/thread-service.test.ts

# Watch mode for development
bun test --watch

# Coverage report
bun test --coverage
```

### Why Not Jest or Vitest?

- **Jest**: Requires transpilation for TypeScript, adds significant config, and is slower than Bun's runner. Violates ADR-002 (Bun runtime) which explicitly chose Bun to eliminate Jest dependency.
- **Vitest (as separate dep)**: Vitest-compatible API is already built into Bun. Adding Vitest as a separate dependency introduces config duplication and version management for no benefit.
- **Node.js test runner**: Requires Node.js runtime. Our project runs on Bun (ADR-002).

---

## 3. HTTP Testing: Hono app.request()

Use Hono's built-in `app.request()` method for testing HTTP endpoints in-process. This eliminates the need for supertest, starting an HTTP server, or binding to a port.

### How It Works

`app.request()` sends a request through the full Hono middleware chain — routing, validation, auth, error handling — without actually starting an HTTP server. The request is processed in-memory and returns a `Response` object that you assert against.

### Example: Testing a Thread Creation Endpoint

```typescript
import { describe, test, expect, beforeEach } from "bun:test";
import { createApp } from "@/api/app";
import { createTestDb } from "../helpers/test-db";
import { seedTestData } from "../helpers/seed";

describe("POST /v1/threads", () => {
  let app: ReturnType<typeof createApp>;
  let db: ReturnType<typeof createTestDb>;

  beforeEach(async () => {
    db = await createTestDb();
    app = createApp({ db });
  });

  test("creates a thread and returns 201", async () => {
    const response = await app.request("/v1/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": "test-key" },
      body: JSON.stringify({ title: "Test Thread" }),
    });

    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body.id).toBeDefined();
    expect(body.title).toBe("Test Thread");
  });

  test("returns 401 without API key", async () => {
    const response = await app.request("/v1/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: "Test Thread" }),
    });

    expect(response.status).toBe(401);
  });

  test("returns 422 for invalid body", async () => {
    const response = await app.request("/v1/threads", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": "test-key" },
      body: JSON.stringify({}),
    });

    expect(response.status).toBe(422);
  });
});
```

### Why Not Supertest?

Supertest starts an HTTP server and sends real HTTP requests. `app.request()` achieves the same coverage in-process — full middleware chain, no port binding, no server lifecycle management. It's faster, simpler, and aligned with Hono's testing model.

---

## 4. Mocking Strategy: Provider Interface Level

Mock at the Vercel AI SDK provider level, not at the HTTP layer, not at the integration boundary, and not at the internal function level.

### Why Provider-Level Mocking?

The Vercel AI SDK's `mockLanguageModel` (from `ai/test`) injects deterministic LLM responses without making real LLM calls. This is the correct mocking level because:

1. **Tests OUR code, not the LLM** — we verify that ANTS correctly handles model outputs (text, tool calls, errors), not whether the LLM produces good outputs.
2. **Deterministic and fast** — no network calls, no model loading, no variability.
3. **Scripts tool call sequences** — define exactly what tool calls the "LLM" makes and in what order, exercising all code paths.
4. **Aligned with architecture** — the provider interface (`src/llm/provider.ts`) is already an abstraction layer. Mocking at this level respects the architecture.

### NEVER Test LLM Decision Quality

We do not test whether Ollama produces good responses, creative outputs, or "correct" reasoning. That's model evaluation, not system testing. We test:

- Our code correctly formats and sends prompts to the provider.
- Our code correctly processes text responses from the provider.
- Our code correctly processes tool call requests from the provider.
- Our code correctly handles provider errors (timeouts, rate limits, malformed responses).
- Our code correctly orchestrates multi-turn conversations.
- Our code correctly enforces constraints (max turns, token limits, timeout).

### Example: Mocking a Language Model with Tool Calls

```typescript
import { describe, test, expect } from "bun:test";
import { mockLanguageModel } from "ai/test";
import { streamText } from "ai";
import { createApp } from "@/api/app";

describe("Research Agent with web_search tool", () => {
  test("agent calls web_search and returns synthesized result", async () => {
    // Script a deterministic sequence of LLM responses
    const mockModel = mockLanguageModel({
      doStream: async ({ prompt }) => ({
        stream: new ReadableStream({
          start(controller) {
            // First call: LLM requests web_search tool
            controller.enqueue({
              type: "tool-call",
              toolName: "web_search",
              args: { query: "quantum computing 2026" },
            });
            controller.enqueue({
              type: "tool-result",
              result: [{ title: "Quantum Advances", url: "https://..." }],
            });
            // Second call: LLM synthesizes and responds
            controller.enqueue({
              type: "text",
              textDelta: "Based on my research, here are the key findings...",
            });
            controller.close();
          },
        }),
      }),
    });

    const app = createApp({ model: mockModel });
    const response = await app.request("/v1/threads/thread-123/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": "test-key" },
      body: JSON.stringify({ agent_type_id: "research-agent", messages: [...] }),
    });

    expect(response.status).toBe(200);
  });
});
```

### What NOT to Mock

- **HTTP calls to Ollama** — mock at the provider level, not with `nock` or `msw`. HTTP mocking couples tests to implementation details (URLs, headers, payload format) and breaks when we change the transport.
- **Internal functions** — don't mock `processToolCall()` or `formatPrompt()`. Test behavior through the public interface (`app.request()` or service methods).
- **Database in unit tests** — unit tests use mock providers and in-memory stubs. Real database is for integration tests.

### Scripting Tool Call Sequences

For agents that make multiple tool calls, define the full sequence:

```typescript
const mockModel = mockLanguageModel({
  doStream: async ({ prompt }) => {
    // Count invocations to return different responses on each turn
    callCount++;
    if (callCount === 1) {
      return firstTurnResponse(prompt); // LLM calls tool A
    } else if (callCount === 2) {
      return secondTurnResponse(prompt); // LLM calls tool B
    } else {
      return finalResponse(prompt); // LLM produces final text
    }
  },
});
```

This exercises every code path in the agent's multi-turn conversation loop: tool call processing, result handling, re-prompting, and final response generation.

---

## 5. Test Database: Fresh PostgreSQL Per Test Run

Integration tests that need a database use **testcontainers** to spin up a fresh PostgreSQL instance per test run. This ensures complete isolation and reproducibility.

### Why testcontainers?

- **Isolation**: Each test run gets its own PostgreSQL instance. No shared state, no test pollution, no need to clean up between tests.
- **Reproducibility**: The same Docker image produces the same database every time.
- **Real PostgreSQL**: Not SQLite. Not an in-memory mock. Full PostgreSQL with JSONB, self-referencing foreign keys, and future pgvector support. Tests run against the same engine we use in production.
- **Drizzle migrations**: Migrations run automatically against the test database, catching schema issues before production.

### Setup Pattern

```typescript
import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import { PostgreSqlContainer } from "@testcontainers/postgresql";
import { drizzle } from "drizzle-orm/node-postgres";
import { migrate } from "drizzle-orm/node-postgres/migrator";
import { Client } from "pg";
import { schema } from "@/models/schema";

let container: PostgreSqlContainer;
let db: ReturnType<typeof drizzle>;

beforeAll(async () => {
  container = await new PostgreSqlContainer().start();
  const client = new Client({ connectionString: container.getConnectionUri() });
  await client.connect();
  db = drizzle(client, { schema });

  // Run migrations against the test database
  await migrate(db, { migrationsFolder: "./drizzle/migrations" });
});

afterAll(async () => {
  await container.stop();
});
```

### Seed Data

```typescript
// tests/helpers/seed.ts
import { db } from "./test-db";

export async function seedTestData(db) {
  const user = await db.insert(users).values({
    email: "test@ants.dev",
    name: "Test User",
  }).returning();

  const apiKey = await db.insert(apiKeys).values({
    user_id: user[0].id,
    key_hash: hashApiKey("test-key"),
    name: "Test Key",
  }).returning();

  return { user: user[0], apiKey: apiKey[0] };
}
```

### NEVER Use Production Database for Tests

- Tests must never connect to a production or shared development database.
- Testcontainers manages database lifecycle — spin up, seed, test, tear down.
- Each test suite gets clean database state. Use transactions with rollback or re-seeding between tests.

---

## 6. Streaming Testing

Streaming is the primary interaction mode for ANTS (streaming by default per the architecture). Testing streaming requires a split approach.

### Unit Tests: Mock Provider to Return Complete Responses

In unit tests, **mock the provider to return a complete response** rather than mocking the stream itself. This tests that our code correctly processes streaming data without the complexity of real streaming.

```typescript
const mockModel = mockLanguageModel({
  doStream: async () => ({
    stream: new ReadableStream({
      start(controller) {
        // Return complete text immediately — no real streaming
        controller.enqueue({
          type: "text",
          textDelta: "This is the complete response.",
        });
        controller.close();
      },
    }),
  }),
});
```

### Integration Tests: Real Streaming with Actual Ollama

Integration tests validate real streaming behavior with an actual Ollama instance:

- SSE formatting is correct (`data:`, `event:` fields).
- Chunks are delivered progressively, not buffered.
- Stream terminates correctly (`data: [DONE]`).
- Error conditions (Ollama down, model not found) are handled gracefully.

```typescript
// tests/integration/streaming.test.ts
describe("Streaming responses with Ollama", () => {
  test("streams tokens progressively via SSE", async () => {
    const response = await app.request("/v1/threads/thread-123/runs", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-API-Key": "test-key" },
      body: JSON.stringify({
        agent_type_id: "research-agent",
        messages: [{ role: "user", content: "Hello" }],
        stream: true,
      }),
    });

    expect(response.status).toBe(200);
    expect(response.headers.get("Content-Type")).toBe("text/event-stream");

    const reader = response.body!.getReader();
    const decoder = new TextDecoder();
    let fullText = "";
    let chunkCount = 0;

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      const chunk = decoder.decode(value);
      fullText += chunk;
      chunkCount++;
    }

    expect(chunkCount).toBeGreaterThan(1); // Multiple chunks received
    expect(fullText).toContain("data:");
  });
});
```

### Don't Mock the Stream in Unit Tests

Mocking the Stream API or ReadableStream in unit tests adds complexity and tests the wrong thing. Instead, mock the provider to return a complete response. The stream processing code paths are exercised in integration tests with real Ollama.

---

## 7. Coverage Target: 80-90% Branch Coverage

### Target Rationale

| Coverage Range | Assessment |
|---------------|------------|
| Below 80% | Insufficient — missing important code paths |
| 80-90% | **Target zone** — comprehensive coverage without diminishing returns |
| Above 90% | Diminishing returns — time spent chasing rare edge cases that rarely matter |

### Enforcement

- **Minimum 80% branch coverage** enforced in CI. PRs that drop coverage below 80% fail.
- **Target 80-90%** for each module. Don't chase 100% — focus on meaningful paths.
- **Coverage reports** generated on every CI run and posted as a PR comment.

### Configuration

```toml
# bunfig.toml
[test]
coverage = true
coverageThreshold = 80
coverageReporter = ["text", "lcov"]
```

### What to Cover

- **API routes**: All endpoints, happy paths, error paths, validation failures.
- **Agent logic**: Multi-turn conversation flow, tool call processing, delegation, error handling.
- **Service layer**: Business logic, data transformations, constraint enforcement.
- **Database queries**: CRUD operations, complex queries, row-level security.

### What NOT to Cover

- **Trivial code**: Simple getters, setters, type definitions.
- **Third-party code**: Drizzle internals, Hono internals, AI SDK internals.
- **Dead code**: Unused exports, deprecated functions (remove them instead).

---

## 8. Test Types

### Unit Tests — Mocked Provider, Instant, Deterministic

- **What**: Individual functions, services, and API routes tested in isolation.
- **How**: Mock at the provider level using `mockLanguageModel`. Use `app.request()` for API routes. Use in-memory stubs for database-dependent services when testing logic, not data access.
- **When**: Every PR. Must be fast (sub-second per test) and completely deterministic.

### Integration Tests — Real Ollama, Streaming, Actual Flow

- **What**: End-to-end flows with real infrastructure — real PostgreSQL (testcontainers) and real Ollama (local instance).
- **How**: Spin up test database, seed data, create real Hono app, make real `app.request()` calls with an actual Ollama provider. Test streaming, multi-turn conversations, and tool execution.
- **When**: On merge to main. Require Ollama to be running locally.
- **Location**: `tests/integration/`

### Contract Tests — OpenAPI Spec Validation

- **What**: Validate that API implementations match the OpenAPI 3.1 specification. Request/response shapes, status codes, headers, and error models.
- **How**: Use `openapi-typescript` to generate types from the spec. Validate route implementations against generated types at compile time. Optionally use runtime validation with Zod schemas derived from the spec.
- **When**: Every PR alongside unit tests. Contract drift is caught at compile time.
- **Location**: `tests/contract/`

### Test Type Comparison

| Aspect | Unit Tests | Integration Tests | Contract Tests |
|--------|-----------|-------------------|----------------|
| Provider | Mocked (mockLanguageModel) | Real Ollama | N/A (type-level) |
| Database | In-memory / stubbed | Real PostgreSQL (testcontainers) | N/A |
| Speed | Sub-second | Seconds to minutes | Sub-second |
| Determinism | Fully deterministic | Mostly deterministic (Ollama can vary) | Fully deterministic |
| When | Every PR | Merge to main | Every PR |
| What they catch | Logic errors, validation bugs | End-to-end flow bugs, integration issues | Spec-implementation drift |

---

## 9. Test Structure

### Directory Layout

Test directories mirror the `src/` structure. Co-located test files sit next to their source files:

```
ants/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   ├── threads.ts
│   │   │   └── threads.test.ts      ← Co-located unit test
│   │   └── middleware/
│   │       ├── auth.ts
│   │       └── auth.test.ts          ← Co-located unit test
│   ├── services/
│   │   ├── thread-service.ts
│   │   └── thread-service.test.ts   ← Co-located unit test
│   ├── agents/
│   │   ├── orchestrator.ts
│   │   └── orchestrator.test.ts      ← Co-located unit test
│   └── ...
├── tests/
│   ├── integration/                  ← Integration tests (real Ollama)
│   │   ├── streaming.test.ts
│   │   ├── agent-conversation.test.ts
│   │   └── database-queries.test.ts
│   ├── contract/                     ← Contract tests (OpenAPI spec)
│   │   └── api-spec-conformance.test.ts
│   ├── helpers/                      ← Test utilities
│   │   ├── test-db.ts               ← testcontainers setup
│   │   ├── seed.ts                   ← Seed data factories
│   │   ├── mock-provider.ts          ← mockLanguageModel wrappers
│   │   └── fixtures.ts               ← Shared test fixtures
│   └── setup.ts                      ← Global test setup
```

### Co-location Rule

- **Unit tests**: `thread-service.ts` → `thread-service.test.ts` (same directory)
- **Why co-location**: Tests next to code make it easy to find related tests and keep them in sync during refactoring. When you move a source file, its test file moves with it.

### Integration and Contract Tests

- **Integration tests**: `tests/integration/` — these need real infrastructure and don't belong in `src/`.
- **Contract tests**: `tests/contract/` — these validate spec conformance and are cross-cutting.

### Layered Testing

Tests are organized by architectural layer:

| Layer | What to Test | Test Strategy |
|-------|-------------|---------------|
| **API (routes, middleware)** | Request routing, validation, auth, error handling | `app.request()` with mock provider |
| **Domain (agents, services)** | Business logic, conversation flow, orchestration | Service-level tests with mock provider and stubbed DB |
| **Services (thread-service, message-service)** | CRUD logic, data transformations, constraints | Testcontainers for real DB tests |
| **Infrastructure (database, LLM client)** | Connection handling, migrations, provider interface | Integration tests with real infra |

---

## 10. CI Integration

### Pull Request Pipeline

```
PR opened
  ├── Unit tests (bun test) — must pass
  ├── Contract tests (bun test tests/contract/) — must pass
  ├── Coverage report — must be ≥ 80% branch coverage
  └── Lint / Type check — must pass
```

### Merge to Main Pipeline

```
PR merged to main
  ├── Unit tests (bun test)
  ├── Contract tests (bun test tests/contract/)
  ├── Coverage report — must be ≥ 80%
  ├── Integration tests (bun test tests/integration/) — requires Ollama
  └── Full coverage report published
```

### CI Configuration

```yaml
# Example GitHub Actions (adapt to your CI)
unit-tests:
  run: bun test
  coverage-threshold: 80

integration-tests:
  run: bun test tests/integration/
  requires: ollama-running
  on: merge-to-main

contract-tests:
  run: bun test tests/contract/
  on: every-PR
```

### Coverage Enforcement

- CI fails if branch coverage drops below 80%.
- Coverage reports are generated every run and compared against the main branch.
- PRs that decrease coverage are blocked from merging.

---

## Appendix: Quick Reference

### Running Tests

```bash
bun test                                    # All tests
bun test src/api/routes/                    # Specific directory
bun test src/services/thread-service.test.ts # Specific file
bun test --watch                            # Watch mode
bun test --coverage                         # Coverage report
```

### Test Checklist for New Features

- [ ] Unit tests for all non-trivial code paths (happy, error, edge)
- [ ] `app.request()` tests for API endpoints
- [ ] Provider-level mocks for LLM-dependent code
- [ ] Tool call sequences scripted for agent multi-turn flows
- [ ] Testcontainers-based DB tests for data access logic
- [ ] Branch coverage ≥ 80% for changed files
- [ ] Integration test for streaming (if feature involves SSE)

### Key Principles Summary

| Principle | Practical Rule |
|-----------|---------------|
| Pragmatic test-first | Tests must exist before merge, write order is flexible |
| Mock at provider level | Use `mockLanguageModel`, never mock HTTP calls |
| Test behavior, not implementation | Assert on outputs and side effects, not internal function calls |
| Fresh DB per test run | testcontainers, never shared or production DB |
| Mock provider for unit, real for integration | Unit: complete response. Integration: real streaming |
| 80-90% branch coverage | Enforce 80% minimum, don't chase 100% |
| Co-located test files | `thread-service.test.ts` next to `thread-service.ts` |
| Never test LLM quality | Test that ANTS handles LLM decisions correctly |