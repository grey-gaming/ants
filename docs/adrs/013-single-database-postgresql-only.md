# ADR-013: Single Database Strategy (PostgreSQL Only with pgvector later)

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS needs to store multiple types of data: relational data (threads, messages, runs, users), flexible metadata (JSONB on multiple entities), queueing state (run queue positions, priorities), and eventually vector embeddings for semantic memory. The question is whether to use a single database or multiple specialized stores.

Our deployment target is a single Mac Studio M5 with 128GB unified memory, running entirely offline. Operational simplicity is critical. Each additional system (Redis, Qdrant, Elasticsearch) adds deployment complexity, memory usage, monitoring burden, and failure points. On a single machine already running PostgreSQL and Ollama (which will consume significant memory for LLM inference), every additional system competes for resources.

## Decision

**PostgreSQL only, with pgvector extension installed from v1 but not actively queried until semantic memory is implemented.**

No Redis. No Qdrant. No Elasticsearch. PostgreSQL handles all storage needs:
- **Relational data**: Thread, Message, Run, RunStep hierarchy
- **Flexible metadata**: JSONB columns on Thread, Message, Run
- **Queueing state**: Run queue positions and priorities in PostgreSQL tables
- **Future vector search**: pgvector for semantic memory (installed now, used later)

This minimizes operational overhead, reduces memory consumption, and simplifies deployment to a single system that needs to be managed.

## Alternatives Considered

### PostgreSQL + Redis
- **Pros**: Redis excels at caching, rate limiting, session management, and queueing. Industry-standard combination.
- **Cons**: Another system to deploy, monitor, and manage on a single machine. Redis consumes memory that could be used for LLM inference. PostgreSQL is sufficient for queueing state at v1 scale. Adds operational complexity for minimal v1 benefit.

### PostgreSQL + Qdrant
- **Pros**: Qdrant is purpose-built for vector search with excellent performance, filtering, and rich query capabilities.
- **Cons**: Another system to deploy and manage. pgvector handles future vector search adequately for v1 scale. Adds memory overhead competing with LLM inference. Overkill for v1 where vector search isn't implemented yet.

### PostgreSQL + Elasticsearch
- **Pros**: Excellent full-text search, faceted search, aggregations.
- **Cons**: Heavy memory and disk usage. Overkill for v1 search needs. Another system to manage. PostgreSQL's full-text search is sufficient for v1.

### PostgreSQL + Redis + Qdrant (Full Stack)
- **Pros**: Best tool for each job. Maximum performance for each concern.
- **Cons**: Three additional systems on a single machine. Deployment complexity. Memory overhead. Monitoring burden. Overkill for v1 scale.

## Consequences

**Positive:**
- Single system to deploy, monitor, backup, and manage.
- Minimal memory overhead — more memory available for LLM inference.
- pgvector future-proofs for semantic memory without adding a new system.
- Simpler development and testing (single database to set up and manage).
- Simpler backup strategy (single database backup).
- Reduces operational burden significantly on a single-machine deployment.

**Negative:**
- PostgreSQL queueing won't match Redis performance at high scale (acceptable for v1 concurrency levels).
- pgvector's vector search performance may not match Qdrant at scale (acceptable for v1; can add Qdrant later if needed).
- No in-memory caching layer — all reads hit PostgreSQL (mitigated: PostgreSQL caching, connection pooling).
- Queueing in PostgreSQL requires careful transaction design to prevent race conditions.