# ADR-017: Repository Structure

- **Status**: Accepted
- **Date**: 2026-06-10

## Context

ANTS needs a repository structure that supports pluggable agents and tools via a configuration-driven registry pattern, clear package boundaries enforced at build time, and a path to scale from the initial 2-3 agents to 10+ without restructuring. The current repo contains only documentation and ADRs — no source code yet — making this the ideal time to establish the structure before implementation begins.

Bun workspaces provide native monorepo support without external tooling. Each package gets its own `package.json` with a scoped `@ants/` name, enabling explicit dependency declarations that enforce the architectural layering at install time. TypeScript path aliases in `tsconfig.json` map `@ants/*` imports to package source directories.

The configuration-driven registry pattern — where `AgentType` and `Tool` database tables drive which agents/tools are active and how they're wired — requires a clear separation between interface contracts (in `@ants/core`) and implementations (in `@ants/agents`/`@ants/tools`). The composition root (`@ants/api`) reads the registry at startup and wires implementations to their interface contracts.

## Decision

**We adopt a Bun workspace monorepo with six packages under `packages/`, enforcing a strict dependency DAG. The registry pattern is configuration-driven: database tables determine which agents and tools are active, and the composition root wires them at startup.**

### Package Layout

| Package | Name | Depends On | Contains |
|---------|------|-----------|----------|
| `packages/core` | `@ants/core` | `@ants/store` | Shared types, interfaces, errors, config, auth, queue logic, services. Core never imports from agents/tools. Interface contracts only. |
| `packages/api` | `@ants/api` | All packages | HTTP layer (Hono routes, middleware, schemas). Composition root that wires everything at startup. |
| `packages/agents` | `@ants/agents` | `@ants/core` | Agent implementations (T1 orchestrator, T3 research, base-agent, registry). Grouped now; split to individual packages when 10+ agents. |
| `packages/tools` | `@ants/tools` | `@ants/core` | Tool implementations + registry. Same grouping strategy as agents. |
| `packages/llm` | `@ants/llm` | `@ants/core` | LLM provider abstraction (Vercel AI SDK interface, Ollama provider, stream utilities). |
| `packages/store` | `@ants/store` | — | Drizzle schema, model query helpers, migrations. Drizzle config lives here. |

### Dependency DAG

```
@ants/store (no deps) ← @ants/core ← {agents, tools, llm} ← @ants/api (wires everything)
```

1. **`@ants/store` depends on nothing.** It is the data foundation — schema, models, migrations.
2. **`@ants/core` depends only on `@ants/store`.** It contains services, auth, queue logic, and interface contracts for agents/tools/LLM.
3. **`@ants/agents`, `@ants/tools`, `@ants/llm` depend only on `@ants/core`.** They never import from each other or from `@ants/api`.
4. **`@ants/api` depends on all other packages.** It is the composition root that wires agents, tools, and LLM into the HTTP server.
5. **No circular dependencies.** The DAG is acyclic by construction.

### Configuration-Driven Registry

Agent and tool registries are populated from database configuration (the `agent_types` and `tools` tables), not from hardcoded imports. At startup, `@ants/api` reads the registry tables, matches each entry to its implementation in `@ants/agents` or `@ants/tools`, and wires them into the system. Adding a new agent or tool requires: (1) implementing it in the correct package, (2) inserting a row in the corresponding database table. No changes to `@ants/api` are needed.

### Key Rules

- **Core never imports from agents/tools.** Interface contracts only — agents and tools implement interfaces defined in `@ants/core`.
- **`@ants/api` is the composition root.** It reads the registry and wires everything together.
- **Grouped packages now, split later.** Agents share one package until 10+ agents, then split to individual packages.
- **Integration/contract tests at root level.** Unit tests co-located within packages.
- **Drizzle config lives in `@ants/store`.** Migration output goes to root `drizzle/` directory.
- **`openapi/` directory for OpenAPI 3.1 spec.** Format name, not OpenAI-inspired naming.

### Workspace Configuration

The root `package.json` declares Bun workspaces:
```json
{
  "workspaces": ["packages/*"]
}
```

Each package has its own `package.json` with a `name` field using the `@ants/` scope.

## Alternatives Considered

### Single package (src/ directory)

- **Pros**: Simplest structure. No workspace configuration. Familiar to all developers.
- **Cons**: No enforced boundaries — any file can import from any other. Doesn't scale as agents/tools grow. No compile-time isolation. Violates the core-never-imports-agents/tools rule by default.

### Monorepo with individual agent packages

- **Pros**: Maximum isolation per agent. Clean boundaries.
- **Cons**: Too many packages for 2-3 agents. Premature optimization. High overhead for a small project. More package.json files than source files initially.

### Plugin directory pattern (plugins/agents/, plugins/tools/)

- **Pros**: Convention-based discovery. Easy to add new agents by dropping in a directory.
- **Cons**: Discovery is implicit, not database-driven. No compile-time boundary enforcement. Harder to reason about wiring. Doesn't support the configuration-driven registry pattern.

## Consequences

**Positive:**
- Compile-time dependency enforcement — invalid imports fail at build time.
- Configuration-driven registries mean no code changes to add/remove agents or tools.
- Composition root pattern makes dependency flow explicit and auditable.
- Grouped packages balance simplicity with structure — split when needed, not before.
- `@ants/store` as the data foundation means schema is independent of business logic.
- `@ants/llm` as a separate package keeps provider abstraction clean and swappable.

**Negative:**
- Bun workspaces add minor configuration complexity (multiple package.json files).
- Moving code between packages requires updating dependencies in multiple places.
- Registry pattern requires database to be available at startup for wiring.
- Grouped packages mean agents share a package until the split threshold is reached.
- Developers must understand the dependency DAG to place new code correctly.