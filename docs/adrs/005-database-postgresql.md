# ADR-005: Database - PostgreSQL

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS needs a primary database for all persistent storage: threads, messages, runs, run steps, agent types, tools, users, and API keys. The database must support ACID transactions (our Thread/Message/Run hierarchy requires consistency), JSONB columns for flexible metadata, self-referencing foreign keys for the Run tree, and future vector similarity search for semantic memory.

Our deployment target is a single Mac Studio M5 with 128GB unified memory running locally and offline. The database must run entirely on this machine with no cloud dependency. Operational simplicity is critical — we can't afford a complex multi-system deployment on a single machine that must be maintained by a small team (or one person with AI assistance).

## Decision

**We choose PostgreSQL as the sole database.**

PostgreSQL provides ACID compliance for our relational data, JSONB for flexible metadata (Thread, Message, Run all have metadata fields), self-referencing foreign keys for the Run tree (parent_run_id), and the pgvector extension for future vector similarity search. It runs excellently on Apple Silicon via Homebrew or Docker, requires minimal operational overhead, and is the most battle-tested open-source database available.

Using PostgreSQL as the single database means all state — relational data, metadata, queueing, and future vector search — lives in one system. This simplifies deployment, backup, monitoring, and operations.

## Alternatives Considered

### MySQL / MariaDB
- **Pros**: Popular, well-supported, good performance.
- **Cons**: Less feature-rich than PostgreSQL (no native vector extension equivalent to pgvector, weaker JSONB support, no array types). Our data model uses features PostgreSQL handles better.

### SQLite
- **Pros**: Zero configuration, embedded, no separate process, excellent for single-machine deployment.
- **Cons**: No concurrent writes (single writer lock). No native vector search extension equivalent. No advanced PostgreSQL features (JSONB operators, array types, CTEs with performance). Doesn't scale to multi-user concurrent access patterns. No row-level security.

### MongoDB
- **Pros**: Flexible document model, good for unstructured data, built-in horizontal scaling.
- **Cons**: Our data is inherently relational (Thread → Message → Run → RunStep). Document model doesn't fit naturally. No ACID guarantees for multi-document transactions in older versions. No vector search equivalent to pgvector. Operational overhead for single-machine deployment.

### CockroachDB
- **Pros**: Distributed SQL, strong consistency, PostgreSQL-compatible.
- **Cons**: Massively overkill for single-machine deployment. Operational complexity. Resource-intensive. Designed for distributed deployments, not single-machine.

## Consequences

**Positive:**
- ACID compliance ensures data consistency for our complex relational model.
- JSONB provides schema flexibility without migration overhead for metadata fields.
- pgvector future-proofs for semantic memory (installed from v1, actively queried later).
- Single database simplifies deployment, backup, and operations.
- Excellent Apple Silicon support via Homebrew or Docker.
- Most battle-tested open-source database — extensive documentation and tooling.

**Negative:**
- PostgreSQL requires a separate process (not embedded like SQLite).
- PostgreSQL's resource usage on a single machine competing with LLM inference for unified memory.
- pgvector's vector search performance may not match dedicated vector databases at scale (acceptable for v1).
- Database administration requires PostgreSQL knowledge (mitigated by good tooling).