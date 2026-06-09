# ADR-016: Testing Strategy

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS needs a testing strategy that accounts for its unique architecture: a multi-agent LLM orchestration system built on Bun, Hono, Vercel AI SDK, Drizzle, and PostgreSQL, running entirely offline-first on local hardware. Testing LLM-powered systems is fundamentally different from traditional software testing — the LLM is a non-deterministic component, and testing whether it produces "good" outputs is model evaluation, not system testing. What matters is verifying that ANTS correctly handles whatever the LLM produces: valid text, tool calls, errors, and malformed responses.

Additional constraints shape this strategy: Bun's built-in test runner (aligned with ADR-002) eliminates the need for Jest or Vitest. Hono's `app.request()` method enables in-process HTTP testing without starting a server. Vercel AI SDK's `mockLanguageModel` provides provider-level mocking that lets us script deterministic LLM behavior. The offline-first privacy constraint means all testing must work locally — no cloud CI dependencies for running tests.

The testing strategy must cover three layers: unit tests (mocked, instant, deterministic), integration tests (real infrastructure, real streaming), and contract tests (OpenAPI spec conformance). It must also address the unique challenge of testing multi-turn agent conversations where the LLM makes tool call decisions across multiple turns.

## Decision

**We choose a pragmatic test-first strategy with provider-level mocking, testcontainers database isolation, and 80-90% branch coverage enforcement.**

The strategy consists of nine specific decisions:

1. **Framework: Bun test runner** — Use Bun's built-in test runner with Vitest-compatible API (`describe`, `test`, `expect`, `beforeEach`). No Jest, no separate Vitest dependency. Configuration via `bunfig.toml`. Aligned with ADR-002 (Bun runtime).

2. **Mock level: Provider interface** — Mock at the Vercel AI SDK provider level using `mockLanguageModel` from `ai/test`. This injects deterministic LLM responses without real calls. Never mock HTTP calls (nock/msw) or internal functions. Mock the provider interface, not integration boundaries.

3. **LLM decision testing: Don't test LLM quality** — Test that ANTS correctly handles LLM decisions (text responses, tool calls, errors), not whether the LLM makes good decisions. We script tool call sequences to exercise all code paths. LLM output quality is model evaluation, not system testing.

4. **Tool call testing: Scripted sequences** — Define what tool calls the "LLM" makes and in what order using `mockLanguageModel`'s `doStream` callback. This exercises multi-turn conversation flows deterministically, covering all agent code paths: tool invocation, result processing, re-prompting, and final response generation.

5. **Database: Fresh PostgreSQL per test run** — Use testcontainers to spin up a fresh PostgreSQL instance per test run. Pre-populate with seed data via factory functions. Never use production or shared development databases. Drizzle migrations run automatically against the test database. Each test suite gets clean state.

6. **Streaming: Mock provider for unit, real for integration** — Unit tests mock the provider to return complete responses (no streaming). Integration tests validate real streaming with actual Ollama, verifying SSE formatting, chunk delivery, and stream termination. Never mock the Stream API itself in unit tests.

7. **Coverage: 80-90% branch** — Minimum 80% branch coverage enforced in CI. Target 80-90% — above 90% has diminishing returns. Coverage reports generated every CI run. CI fails if coverage drops below 80%. Don't chase 100%.

8. **TDD approach: Pragmatic test-first** — Tests must exist before a feature is considered done, but we don't follow strict red-green-refactor TDD. Write code, write tests, make both pass. The important thing is comprehensive coverage, not the order of writing.

9. **Test structure: Mirror src/ with co-located files** — Unit test files sit next to their source files (`thread-service.test.ts` next to `thread-service.ts`). Integration tests in `tests/integration/`. Contract tests in `tests/contract/`. Test directory mirrors `src/` structure.

## Alternatives Considered

### Decision 1: Framework — Bun test runner

**Jest**
- Pros: Most popular JavaScript test framework. Massive ecosystem of matchers, mocks, and plugins. Excellent documentation. Snapshot testing.
- Cons: Requires transpilation for TypeScript (extra config). Slower than Bun's runner. Adds a significant dependency that contradicts ADR-002's decision to use Bun's built-in tooling. Configuration overhead (babel, ts-jest).

**Vitest (as separate dependency)**
- Pros: Vitest-compatible API (same as Bun's runner). Native TypeScript. Excellent watch mode. Good coverage.
- Cons: Redundant — Bun's built-in runner provides the same Vitest-compatible API. Adds an unnecessary dependency. Two test configurations to maintain (bunfig.toml + vitest.config.ts). No benefit over Bun's runner for our stack.

**Node.js test runner**
- Pros: Built into Node.js. No dependencies. Simple.
- Cons: Requires Node.js runtime (contradicts ADR-002). Minimal assertion API compared to Bun/Vitest. No built-in coverage. Less mature ecosystem.

### Decision 2: Mock level — Provider interface

**HTTP mocking (nock/msw)**
- Pros: Works for any HTTP-based dependency. Well-known pattern. Good for testing request/response formats.
- Cons: Couples tests to implementation details (URLs, headers, payload format). Breaks when transport layer changes. Doesn't test our handling of provider responses — tests the wire format instead. Doesn't support multi-turn conversation scripting easily.

**Integration mocking (mock services layer)**
- Pros: Clean separation between layers. Each layer tested in isolation.
- Cons: Over-engineered for our architecture. We don't have a complex service mesh — we have one LLM provider. Mocking each service individually creates maintenance burden and hides integration bugs.

**No mocking (all integration tests)**
- Pros: Tests real behavior end-to-end. No mock drift.
- Cons: Slow (requires real LLM). Non-deterministic (LLM outputs vary). Can't test error paths without controlling the LLM. Can't script specific tool call sequences. Unit tests become integration tests.

### Decision 3: LLM decision testing — Don't test LLM quality

**Test LLM output quality**
- Pros: Would validate that the system produces useful results.
- Cons: LLM outputs are non-deterministic — tests would be flaky. Quality is subjective — no objective pass/fail criteria. Model quality changes with each Ollama update. This is model evaluation, not system testing. Not the purpose of ANTS's test suite.

**Snapshot LLM responses**
- Pros: Catches unexpected output changes. Easy to write.
- Cons: Snapshots are brittle — any model update changes outputs. High maintenance burden updating snapshots. Doesn't test that our code handles responses correctly. False signal — snapshots change but code is correct.

**Skip LLM testing entirely**
- Pros: No complexity from LLM mocking. Simplest approach.
- Cons: Leaves the core of our system untested. Agent orchestration, tool call processing, multi-turn conversations — all untested. Major gap in coverage.

### Decision 4: Tool call testing — Scripted sequences

**Real LLM tool calling**
- Pros: Tests real behavior. No mock drift.
- Cons: Non-deterministic — LLM may not make the expected tool calls. Can't reliably test error paths (LLM rarely makes errors on command). Slow (requires real inference). Tests depend on model quality, not system correctness.

**Random sequences**
- Pros: Catches unexpected state combinations.
- Cons: Non-deterministic — can't reproduce failures. Doesn't exercise specific code paths deliberately. Hard to debug failures.

**Fixed fixtures (JSON files)**
- Pros: Deterministic, reproducible, easy to understand.
- Cons: Static — can't test multi-turn conversation flow where response depends on previous turns. Doesn't exercise the stream processing code path. Tight coupling to response format changes.

### Decision 5: Database — Fresh PostgreSQL per test run

**Shared test database**
- Pros: Faster (no container startup). Simpler setup.
- Cons: Test pollution — one test's data affects another. Requires careful cleanup. Non-deterministic failures under parallel execution. Race conditions between test suites.

**In-memory SQLite**
- Pros: Instant startup. No Docker dependency. Zero configuration.
- Cons: Different SQL dialect (no JSONB operators, no pgvector, different type system). Tests don't catch PostgreSQL-specific bugs. Drizzle queries may behave differently on SQLite. Violates "test what you run" principle. Our schema uses PostgreSQL features that SQLite doesn't support.

**Production DB with test schema**
- Pros: Tests against real database. No container startup.
- Cons: Risk of data corruption in production. Privacy violation (test data in production). Cannot guarantee isolation. Never acceptable under our offline-first privacy constraints.

### Decision 6: Streaming — Mock provider for unit, real for integration

**Mock streaming in unit tests**
- Pros: Full control over stream chunks. Can test partial delivery, backpressure, etc.
- Cons: High complexity — mocking ReadableStream, TextEncoder, SSE formatting. Tests the mock, not the code. Fragile to Stream API changes. The stream processing layer is thin and well-tested by integration tests.

**Only integration streaming tests**
- Pros: Tests real streaming behavior. No mock complexity.
- Cons: All streaming tests require Ollama. Slow feedback loop for streaming bugs. Can't run streaming tests on every PR (requires infrastructure). No unit-level validation of stream processing logic.

**Skip streaming tests**
- Pros: Simplest approach.
- Cons: Streaming is the primary interaction mode (per architecture). Unacceptable to skip testing it. SSE formatting bugs would reach production undetected.

### Decision 7: Coverage — 80-90% branch

**No target**
- Pros: No overhead from coverage tracking. Developers aren't incentivized to write tests just for the number.
- Cons: No enforcement mechanism. Coverage can silently degrade. Inconsistent quality across the codebase. Difficult to assess test health at a glance.

**100% coverage**
- Pros: Maximum confidence. Every line is tested.
- Cons: Diminishing returns above 90%. Chasing 100% leads to trivial tests that add no value (testing getters, type definitions). Maintenance burden for marginal benefit. Some code is genuinely not worth testing (error branches that can't occur in practice).

**70% coverage**
- Pros: Low bar, easy to achieve. Doesn't slow down development.
- Cons: 30% of branches untested — likely includes important paths. Below industry standard. Insufficient confidence for a system that handles user data and LLM orchestration.

### Decision 8: TDD — Pragmatic test-first

**Strict TDD (red-green-refactor)**
- Pros: Maximum test coverage by construction. Forces thinking about interface before implementation. Prevents untested code.
- Cons: Slows development velocity, especially for AI agent code where the implementation path isn't always predictable. Red phase can be artificial when you don't yet know the API shape. Overhead for simple changes. Not pragmatic for our development pace.

**Test-after**
- Pros: Implementation first, then add tests. Faster perceived velocity.
- Cons: "I'll add tests later" rarely happens. Coverage gaps accumulate. Tests written after implementation tend to confirm what the code does rather than verify what it should do.

**No discipline**
- Pros: Maximum development speed. No rules.
- Cons: Inconsistent test quality. Critical paths go untested. Technical debt accumulates rapidly. Not acceptable for a system handling LLM orchestration and user data.

### Decision 9: Test structure — Mirror src/ with co-located files

**Separate test directory only (tests/ at root)**
- Pros: Clean separation. No test files in source directories.
- Cons: Tests are far from the code they test. Moving source files requires manually finding and moving corresponding tests. Hard to know which tests relate to which source files. Tests become disconnected from implementation.

**__tests__ subdirectories**
- Pros: Tests next to code. Grouped in a subdirectory.
- Cons: Creates unnecessary nesting. The `__tests__` convention is a Jest remnant. Adds one more directory level to navigate. Less common in Bun/TypeScript projects.

**Mixed: co-located unit + separate integration/contract**
- Pros: Best of both worlds. Unit tests are easy to find next to their source. Integration and contract tests are in dedicated directories since they span multiple modules.
- Cons: Two patterns to remember. Slight inconsistency.

## Consequences

**Positive:**
- Bun's built-in test runner eliminates Jest/Vitest dependency, aligning with ADR-002 (Bun runtime).
- Provider-level mocking tests our code's behavior, not the LLM's quality, giving deterministic and fast unit tests.
- Scripted tool call sequences exercise all agent code paths without relying on LLM non-determinism.
- testcontainers provides real PostgreSQL isolation — tests catch JSONB, pgvector, and self-referencing FK issues that SQLite would miss.
- Split streaming strategy (mock for unit, real for integration) gives fast unit feedback and real streaming validation.
- 80-90% coverage target enforces thoroughness without diminishing-returns overhead.
- Pragmatic test-first approach maintains quality without slowing development velocity.
- Co-located test files keep tests and implementation in sync during refactoring.
- Clear separation between unit (fast, every PR), integration (real infra, merge to main), and contract (spec conformance, every PR) tests.

**Negative:**
- testcontainers requires Docker, adding a dependency to the test environment.
- Provider-level mocking creates a coupling between tests and the Vercel AI SDK's mock API — SDK updates may require test refactoring.
- Integration tests require Ollama to be running locally, which may not always be available in CI environments.
- 80-90% coverage requires discipline — developers may be tempted to skip edge cases in pursuit of the number rather than meaningful coverage.
- Pragmatic test-first lacks the rigor of strict TDD — some edge cases may be missed if developers don't write tests promptly.
- Two test locations (co-located unit + separate integration/contract) require developers to know which pattern to use for each test type.