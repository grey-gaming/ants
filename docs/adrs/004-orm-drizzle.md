# ADR-004: ORM - Drizzle

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS needs a type-safe way to interact with PostgreSQL. The ORM must handle our relational data model (Thread, Message, Run, RunStep hierarchy), JSONB columns for flexible metadata, self-referencing foreign keys (Run.parent_run_id for the sub-thread tree), and future pgvector queries for semantic memory. The primary developer is Qwen3-35B-A3B, so the ORM's API must be intuitive enough for reliable AI-generated code.

Our data model has complex relationships: self-referencing Run trees, many-to-many agent-tool relationships, JSONB metadata on multiple entities, and row-level security scoped by user_id. The ORM must handle all of this while providing compile-time type safety.

## Decision

**We choose Drizzle as the ORM.**

Drizzle provides type-safe SQL queries that look like actual SQL (not an abstract query language). Schema is defined in TypeScript files (schema-as-code), enabling type generation and migration management. Drizzle has zero runtime overhead compared to Prisma's heavy query engine. It supports PostgreSQL-specific features including JSONB and self-referencing foreign keys.

The SQL-like API is particularly beneficial for AI-generated code — Qwen3-35B-A3B can produce correct Drizzle queries because the API mirrors SQL patterns the model already knows well.

## Alternatives Considered

### Prisma
- **Pros**: Most popular TypeScript ORM. Excellent schema definition language. Visual schema editor (Prisma Studio). Great documentation.
- **Cons**: Heavy runtime (Prisma Engine is a Rust binary). Slow for complex queries. Schema-first, not code-first — can't use TypeScript patterns in schema. No native SQL escape hatch without raw queries. JSONB support is limited. Self-referencing relations require workarounds. Poor performance for our query patterns.

### TypeORM
- **Pros**: Mature, widely used. Decorator-based (familiar to Java/C# developers). Supports all PostgreSQL features.
- **Cons**: Decorator-heavy pattern is less type-safe than Drizzle's approach. Runtime behavior can be surprising (lazy relations, entity subscribers). Performance concerns with complex queries. Less intuitive for AI code generation.

### Kysely
- **Pros**: Pure query builder with excellent TypeScript types. SQL-like API. No runtime overhead. Full PostgreSQL feature support.
- **Cons**: No schema definition or migration management — would need a separate tool. More verbose than Drizzle for schema definitions. Two separate concerns (schema + queries) with different APIs.

### Raw SQL (pg or postgres.js)
- **Pros**: Full control, maximum performance, no ORM overhead.
- **Cons**: No type safety without manual effort. Maintenance burden increases with codebase size. SQL injection risk without disciplined parameterization. Harder for AI code generation to produce consistently correct SQL.

## Consequences

**Positive:**
- SQL-like API is intuitive and produces correct AI-generated code.
- Schema-as-code in TypeScript enables type generation and migration management.
- Zero runtime overhead — no heavy query engine.
- Full PostgreSQL feature support (JSONB, self-referencing FKs, pgvector).
- Lightweight migration system with Drizzle Kit.
- Excellent TypeScript types throughout.

**Negative:**
- Less mature than Prisma — fewer features, smaller community.
- No visual schema editor or GUI tool like Prisma Studio.
- Documentation is good but less extensive than Prisma's.
- Some advanced Prisma features (like Prisma Client extensions) have no Drizzle equivalent.
- Community is growing but smaller than Prisma's.