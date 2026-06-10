# ANTS — Autonomous Networked Task System

**Multi-agent orchestration and project management — API-first, privacy-first, offline-first.**

ANTS is the core runtime for ANT, a highly private, offline-first AI assistant. It orchestrates multiple AI agents through a 3-tier conversational hub-and-spoke model, providing a pure API system (no UI) with OpenAPI 3.1 spec-first development, local-only inference via Ollama, and PostgreSQL-backed persistence with multi-user isolation.

---

## Overview

ANTS (Autonomous Networked Task System) is a multi-agent orchestration and project management system designed to serve as the core runtime for ANT, a highly private, offline-first AI assistant.

### Core Principles

- **API-First, No UI**: ANTS is a pure API system. There is no web interface, no dashboard, no frontend. All interaction is through a well-defined OpenAPI 3.1 specification.
- **Privacy-First, Offline-First**: Nothing leaves the machine. All inference runs locally on Ollama. No cloud API calls, no telemetry, no data exfiltration.
- **OpenAI-Inspired, Not Compatible**: The API takes inspiration from the OpenAI Assistants API for familiarity, but makes its own design decisions where they serve the project better.
- **Conversational Agents**: Agents converse — they engage in multi-turn dialogue, not fire-and-forget delegation. This is a foundational design choice that shapes the entire architecture.
- **Extensible from Day One**: Agent registries, tool registries, and the provider abstraction layer are present from v1, enabling future extension without architectural overhaul.

For the full architecture document, see [docs/architecture.md](docs/architecture.md).

---

## Architecture

ANTS uses a **3-tier conversational hub-and-spoke agent model**:

- **T1 — Orchestrator**: Single entry point for all user requests. Routes, coordinates, monitors. Never delegates and forgets — stays in the loop.
- **T2 — Specialists**: Domain experts that receive delegated tasks, can have multi-turn conversations with task agents, and can delegate to T3 agents.
- **T3 — Task Agents**: Single-purpose workers. Cannot delegate. Can ask clarifying questions. Always leaf nodes.

Sub-threads are represented via the Run tree (`parent_run_id`), keeping all messages in the user's thread while providing isolation and hierarchy.

For the complete architecture, data model, API design, concurrency model, and project structure, see [docs/architecture.md](docs/architecture.md).

---

## Tech Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| **Runtime** | Bun | Fast startup, native TypeScript execution, built-in test runner, built-in bundler |
| **Language** | TypeScript | AI agent writes it most effectively; type safety catches errors at compile time; massive ecosystem |
| **Framework** | Hono | Ultra-lightweight (~14KB), streaming-first, built-in OpenAPI support, multi-runtime |
| **ORM** | Drizzle | Type-safe SQL queries, schema-as-code, lightweight migrations, no runtime overhead |
| **LLM Client** | Vercel AI SDK | Unified streaming interface, tool calling abstraction, provider-agnostic, battle-tested |
| **Validation** | Zod + openapi-typescript | Runtime validation + types generated from OpenAPI spec; single source of truth |
| **Database** | PostgreSQL | ACID compliance, pgvector for future vector search, single database, no Redis dependency at v1 |
| **Vector Extension** | pgvector | Installed from v1 but not actively queried until semantic memory is implemented |
| **LLM Provider** | Ollama (local) | Qwen3-35B-A3B as primary model; abstracted behind provider interface for future model swapping |
| **API Spec** | OpenAPI 3.1 | Spec-first development; drives type generation, validation, and documentation |
| **Auth** | API Keys + Row-Level Security | Multi-user from v1; each user has API keys; row-level security ensures data isolation |

### Explicitly NOT in V1

| Excluded | Reason |
|----------|--------|
| Redis | PostgreSQL is sufficient for queueing state at v1 scale |
| Qdrant | pgvector handles future vector search |
| UI / Dashboard | API-only; any UI is a separate consumer |
| Cloud LLM APIs | Privacy constraint; everything runs locally |

---

## Prerequisites

- **[Bun](https://bun.sh/)** — Runtime and package manager
- **PostgreSQL** — With pgvector extension
- **[Ollama](https://ollama.com/)** — Local LLM inference (running and accessible)

---

## Getting Started

```bash
# Clone the repository
git clone <repo-url> ants && cd ants

# Install dependencies
bun install

# Configure environment
cp .env.example .env
# Edit .env with your PostgreSQL connection string, Ollama URL, etc.

# Run database migrations
bun run db:migrate

# Start the development server
bun run dev
```

---

## Running Tests

```bash
# All tests
bun test

# Specific test file
bun test src/services/thread-service.test.ts

# Watch mode
bun test --watch

# Coverage report
bun test --coverage
```

Tests use Bun's built-in test runner, Hono `app.request()` for HTTP testing, `mockLanguageModel` for provider-level mocking, and testcontainers for real PostgreSQL isolation. For the full testing strategy, see [docs/testing-strategy.md](docs/testing-strategy.md).

---

## Project Structure

ANTS uses a Bun workspace monorepo with scoped `@ants/` packages. See [ADR-017](docs/adrs/017-repository-structure.md) for the full rationale.

```
ants/
├── packages/
│   ├── core/         # @ants/core — services, auth, config, errors, queue logic
│   ├── api/          # @ants/api — HTTP layer, composition root
│   ├── agents/       # @ants/agents — agent implementations + registry
│   ├── tools/        # @ants/tools — tool implementations + registry
│   ├── llm/          # @ants/llm — LLM provider abstraction
│   └── store/        # @ants/store — Drizzle schema, migrations, queries
├── openapi/          # OpenAPI 3.1 specification
├── tests/            # Integration and contract tests
├── docs/             # Architecture, ADRs, testing strategy
└── drizzle/          # Database migrations
```

**Dependency flow**: `@ants/store` (no deps) ← `@ants/core` ← `{agents, tools, llm}` ← `@ants/api` (wires everything). Agents and tools are registered via database config, not hardcoded imports.

For the full project structure with package descriptions, dependency rules, and data flow diagram, see [docs/architecture.md §9](docs/architecture.md).

---

## Documentation

- [Architecture Document](docs/architecture.md) — Canonical reference for all architectural decisions
- [Testing Strategy](docs/testing-strategy.md) — Testing philosophy, framework, mocking strategy, coverage targets
- [Architecture Decision Records](docs/adrs/) — Every significant decision documented with context, alternatives, and consequences

---

## ADR Index

| # | Title | One-Line Summary |
|---|-------|-----------------|
| 001 | Language - TypeScript | TypeScript chosen for best AI-agent code generation quality, type safety, and ecosystem |
| 002 | Runtime - Bun | Bun for native TS execution, fast startup, built-in test runner and bundler |
| 003 | Framework - Hono | Hono for ultra-lightweight, streaming-first, OpenAPI-integrated HTTP framework |
| 004 | ORM - Drizzle | Drizzle for type-safe SQL-like queries, schema-as-code, zero runtime overhead |
| 005 | Database - PostgreSQL | PostgreSQL as sole database for ACID, JSONB, self-referencing FKs, future pgvector |
| 006 | LLM Client - Vercel AI SDK | Vercel AI SDK for unified streaming, tool calling, and provider-agnostic LLM interaction |
| 007 | Validation - Zod & openapi-typescript | Zod for runtime validation, openapi-typescript for spec-driven type generation |
| 008 | LLM Provider - Ollama (Initial) | Ollama for local LLM inference, abstracted behind a provider interface |
| 009 | API-First, No UI | ANTS is a pure API system with no web interface, dashboard, or frontend |
| 010 | OpenAI-Inspired Custom API | Familiar patterns from OpenAI Assistants API, diverging where ANTS needs differ |
| 011 | 3-Tier Conversational Hub-and-Spoke | T1 orchestrator, T2 specialists, T3 task agents with multi-turn dialogue |
| 012 | Sub-threads via Run Tree | Sub-threads represented by Run tree (parent_run_id), not separate Thread entities |
| 013 | Single Database (PostgreSQL Only) | No Redis, no Qdrant — PostgreSQL handles all storage including queueing and future vectors |
| 014 | Multi-user Auth with API Keys | API key auth with row-level security at the Drizzle query layer for data isolation |
| 015 | Project Name - ANTS | ANTS = Autonomous Networked Task System; the orchestration engine (distinct from ANT assistant) |
| 016 | Testing Strategy | Pragmatic test-first, Bun test runner, provider-level mocking, testcontainers, 80-90% coverage |
| 017 | Repository Structure | Bun workspace monorepo with @ants/* packages, strict dependency DAG, config-driven registries |