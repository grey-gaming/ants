# ADR-010: OpenAI-Inspired Custom API

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS needs an API design for its multi-agent orchestration system. The API must handle threads (conversations), messages, runs (agent executions), agent types (registered agents), tools (registered capabilities), and queueing (concurrency management). It must also support streaming (SSE) for real-time LLM responses.

The OpenAI Assistants API provides familiar patterns that developers understand: Threads, Messages, Runs, and streaming. However, ANTS has fundamentally different requirements that make direct compatibility impossible: multi-agent conversations (sub-threads), agent registries with tier hierarchies (T1/T2/T3), tool registries as separate resources, and visible queueing.

We need an API that feels familiar to developers who know OpenAI's API but serves our specific architectural needs.

## Decision

**We design an OpenAI-inspired custom API.**

We adopt familiar patterns from the OpenAI Assistants API:
- **Threads and Messages** as core conversation primitives
- **Runs** as execution units
- **Streaming** via SSE for real-time responses

But we diverge where our needs differ:
- **Sub-threads** for agent-to-agent conversations (OpenAI has no concept of this)
- **AgentType registry** as a first-class resource (OpenAI uses flat Assistants; we use tiered agents)
- **Tool registry** as a separate, queryable resource (OpenAI embeds tools in assistants)
- **Queueing and concurrency** as visible API resources (OpenAI handles this opaquely)

The API uses resource-oriented URLs (`/v1/threads`, `/v1/threads/{id}/messages`, `/v1/runs`), a consistent error model, streaming by default for LLM responses, idempotency keys, cursor-based pagination, and versioned endpoints (`/v1/...`).

## Alternatives Considered

### Fully OpenAI-Compatible API
- **Pros**: Drop-in replacement for OpenAI SDKs. Immediate ecosystem compatibility.
- **Cons**: Our multi-agent model doesn't fit OpenAI's flat assistant model. Sub-threads, agent tiers, and queue visibility have no OpenAI equivalent. Forcing compatibility would compromise our architecture.

### Purely RESTful Resource API
- **Pros**: Clean, conventional REST design. No external API influence.
- **Cons**: Loses familiarity for developers who know LLM APIs. Misses established patterns (streaming via SSE, async runs) that work well. Reinventing patterns that OpenAI has validated.

### GraphQL API
- **Pros**: Flexible queries, reduce over-fetching, strong typing.
- **Cons**: Poor SSE streaming support. Adds complexity (resolvers, schema management). Overkill for our resource-oriented API. Less familiar for LLM API consumers.

### gRPC
- **Pros**: Excellent performance, strong typing, bi-directional streaming.
- **Cons**: Poor browser/SSE support. Requires proto definitions alongside OpenAPI. Not standard for LLM APIs. More complex client setup.

## Consequences

**Positive:**
- Familiar developer experience for those who know OpenAI's API.
- Our own design decisions where they serve us better (sub-threads, agent tiers, tool registries, queue visibility).
- Clear versioning strategy (`/v1/...`) with additive changes.
- Streaming by default aligns with LLM API conventions.
- OpenAPI spec enables automatic client generation.

**Negative:**
- Developers may expect OpenAI compatibility — must clearly document that this is "inspired by, not compatible with."
- Some patterns (sub-threads, agent tiers) have no precedent — require careful API design and documentation.
- Not a drop-in replacement for OpenAI SDKs — requires custom client libraries.
- More design work than using an existing API standard.