# ADR-018: API Specification Design

- **Status**: Accepted
- **Date**: 2026-06-10

## Context

ANTS requires a complete, authoritative API specification that serves as the single source of truth for all 31 endpoints, their request/response schemas, security model, streaming behavior, pagination, and error handling. The spec must support spec-first development: types generated from the spec, implementation validated against the spec, contract tests confirming conformance.

This ADR documents the ten key design decisions embedded in the OpenAPI 3.1 specification at `openapi/spec.yaml`. Each decision reflects trade-offs between simplicity, extensibility, and alignment with ANTS' multi-agent architecture.

Existing ADRs that constrain this specification:
- ADR-007 (Zod + openapi-typescript) — spec drives type generation
- ADR-009 (API-first, no UI) — spec is the primary interface
- ADR-010 (OpenAI-inspired custom API) — familiar patterns, custom where needed
- ADR-012 (Sub-threads via run tree) — parent_run_id, not separate Thread entities
- ADR-014 (Multi-user auth with API keys) — Bearer token + row-level security

## Decision

### 1. OpenAPI 3.1 as spec format (spec-first, not code-first)

The API is defined in a hand-written OpenAPI 3.1 YAML file. TypeScript types are generated from the spec using `openapi-typescript`. Zod schemas validate runtime conformance. The spec is the source of truth; implementation follows.

### 2. OpenAI-inspired but custom (not strictly compatible)

We adopt familiar patterns — Threads, Messages, Runs, SSE streaming — from the OpenAI Assistants API. We diverge where ANTS' multi-agent model requires it: agent tiers (T1/T2/T3), sub-threads via run tree, tool registries as separate resources, activity traces for delegation observability.

### 3. Activity trace endpoint for observability

A single `GET /threads/{id}/activity` endpoint returns the complete delegation tree for a thread, including all runs with parent_run_id relationships, agent names and tiers, step IDs, and sub-run IDs. This is a convenience endpoint that pre-assembles the tree so clients can inspect any conversation session without multiple round-trips.

### 4. Key-value settings model

Settings are stored as simple key-value pairs accessed via `/v1/settings` and `/v1/settings/{key}`. Partial updates are supported via PATCH. No typed config sections, no schema per setting — just flat key-value pairs.

### 5. Separate steps endpoint (not embedded in run response)

Run steps are accessed via `/threads/{id}/runs/{rid}/steps`, not embedded in the Run object. The Run resource contains status and metadata; steps are fetched separately when needed.

### 6. Agent↔Tool assignment via PATCH with tool_ids

Tool assignment is managed through `PATCH /agents/{id}` with a `tool_ids` array in the request body. Replacing the full array reassigns tools atomically. No separate assignment endpoint, no dedicated join-table endpoint.

### 7. Cursor-based pagination

All list endpoints use cursor-based pagination with `after`, `before`, and `limit` query parameters. Responses include a `pagination` object with cursors for next and previous pages.

### 8. SSE streaming for run events

Run execution events are streamed via `GET /threads/{id}/runs/{rid}/stream` using Server-Sent Events (SSE). Event types include run lifecycle events (created, completed, failed), step events (created, completed), and message events (created, delta, completed).

### 9. Idempotency keys

All mutation endpoints accept an `Idempotency-Key` header. If a request with the same key is received within a configurable window, the original response is returned without re-executing the mutation.

### 10. Standard error model

All error responses use a consistent `{ error: { code, message, details } }` shape. `code` is machine-readable, `message` is human-readable, and `details` is an optional object for additional context.

## Alternatives Considered

### 1. OpenAPI 3.1 as spec format

**Swagger/OpenAPI code-first (tsoa, nestjs-swagger):**
- Pros: Spec auto-generated from code; never out of sync with implementation.
- Cons: Spec reflects implementation, not design intent. Refactoring can silently change the API contract. Generated specs are often verbose and poorly organized. Limited control over spec structure, descriptions, and examples. Does not support spec-first workflow where design precedes implementation.

**GraphQL Schema:**
- Pros: Strong typing, introspection, flexible queries. Single endpoint.
- Cons: Poor SSE streaming support. No standard for cursor pagination in GraphQL for our use case. Adds resolver complexity. Over-fetching/under-fetching problems require careful schema design. Less familiar for LLM API consumers.

**gRPC/protobuf:**
- Pros: Excellent performance, bi-directional streaming, strong typing, code generation.
- Cons: Poor browser/SSE compatibility. Requires proto definitions alongside or instead of OpenAPI. Not standard for LLM APIs. Complex client setup. No native support for the resource-oriented REST patterns ANTS follows.

### 2. OpenAI-inspired but custom

**Full OpenAI compatibility:**
- Pros: Drop-in replacement for OpenAI SDKs. Immediate ecosystem compatibility.
- Cons: ANTS' multi-agent model (agent tiers, sub-threads, delegation trees) has no OpenAI equivalent. Forcing compatibility would compromise core architecture. OpenAI's flat assistant model cannot express T1→T2→T3 delegation.

**Pure REST, no OpenAI inspiration:**
- Pros: Clean, unconstrained design. No baggage from another API's conventions.
- Cons: Loses familiarity for developers who know LLM APIs. Reinvents validated patterns (async runs, SSE streaming, thread/message model). Higher learning curve.

**GraphQL:**
- Pros: Flexible queries, reduce over-fetching, strong typing.
- Cons: Poor SSE streaming. Adds resolver complexity. Overkill for resource-oriented CRUD + streaming. Less familiar for LLM API consumers. See ADR-010 for full analysis.

### 3. Activity trace endpoint

**Granular endpoints only (query runs, steps separately):**
- Pros: Smaller responses, simpler caching, follows REST orthodoxy.
- Cons: Clients must issue N+1 requests to assemble the delegation tree. No single view of which agent called which. Complex client-side tree reconstruction from flat run/step lists.

**Embedded steps in run response:**
- Pros: Fewer requests. Run response includes all steps inline.
- Cons: Large responses for runs with many steps. Inefficient when only run metadata is needed. Breaks the separation between Run (status/metadata) and RunStep (execution detail).

**Webhook/event subscription model:**
- Pros: Push-based, real-time. No polling needed.
- Cons: Significantly more infrastructure (subscription management, delivery guarantees, retry logic). Out of v1 scope (see ADR-009). Requires persistent event store. Overkill for a local-first system.

### 4. Key-value settings model

**Typed config sections:**
- Pros: Type safety, validation per section, self-documenting structure.
- Cons: Requires schema definition for every setting. Inflexible — adding a new setting means a schema change and migration. Over-engineered for what is essentially a bag of configuration values.

**Environment variables only:**
- Pros: Standard, no database needed, 12-factor compliance.
- Cons: No API visibility into configuration. No per-user settings. Requires restart to change. No audit trail.

**Separate config service:**
- Pros: Dedicated service with versioning, validation, audit trail.
- Cons: Adds a microservice for v1 scale. Over-engineered. PostgreSQL key-value table is sufficient and already available.

### 5. Separate steps endpoint

**Embedded steps array in Run:**
- Pros: Single request returns run + all steps. Simpler client for simple cases.
- Cons: Large responses for runs with many steps. Inefficient when only run metadata is needed (polling status). Run object becomes unbounded in size. Violates separation of concerns — Run is status/metadata, Steps are execution detail.

**Steps as top-level resource (/steps, not nested under runs):**
- Pros: Flatter URL structure. Steps queryable independently of thread/run context.
- Cons: Loses hierarchical context. Steps are meaningless without their run and thread. Requires filtering by run_id in every query. URL does not convey the ownership relationship.

### 6. Agent↔Tool assignment via PATCH with tool_ids

**Separate assignment endpoint (POST /agents/{id}/tools, DELETE /agents/{id}/tools/{tool_id}):**
- Pros: Fine-grained add/remove operations. No need to send full tool list.
- Cons: More endpoints to maintain. Non-atomic — partial failures leave assignment in inconsistent state. Race conditions between add and remove operations.

**Embedded tools in agent (tools defined inline in agent create/update):**
- Pros: Single request creates agent with tools. Fewer round-trips.
- Cons: Tool definitions duplicated across agents. Cannot share tool definitions. Updating a tool requires updating every agent that references it.

**Many-to-many join table endpoint (CRUD on /agent-tools):**
- Pros: Full CRUD on the join table. Maximum flexibility.
- Cons: Exposes implementation detail (join table). Overkill for what is fundamentally "assign these tools to this agent." Extra endpoints with no added value over PATCH with tool_ids.

### 7. Cursor-based pagination

**Offset pagination (page, per_page, offset):**
- Pros: Simple to implement. Jump to any page. Standard in many APIs.
- Cons: Unreliable results when items are inserted or deleted between pages. Offset-based queries degrade performance on large tables (O(offset) skip cost). No stable reference point between pages.

**Page-based pagination (page=1, page=2):**
- Pros: Intuitive for humans. Simple implementation.
- Cons: Same instability issues as offset pagination. No cursor stability between requests. Not suitable for real-time data where new items appear during iteration.

**Relay cursor connections (edges/nodes/pageInfo from GraphQL Relay spec):**
- Pros: Well-specified. Rich metadata (hasNextPage, hasPreviousPage). Cursor opacity.
- Cons: Verbose response structure. Designed for GraphQL, not REST. Over-engineered for our needs. Adds complexity without proportional benefit for a REST API.

### 8. SSE streaming for run events

**WebSockets:**
- Pros: Bi-directional. Lower overhead for high-frequency messages. Binary frame support.
- Cons: Requires persistent connection management. More complex infrastructure (connection pooling, load balancing). Not cacheable. Overkill for unidirectional event streams. Breaks HTTP request/response model that Hono is built around.

**Long polling:**
- Pros: Works with standard HTTP. Simple client implementation.
- Cons: High overhead (repeated HTTP handshakes). Latency between events. Server must hold connections open. Not suitable for high-frequency streaming (token-by-token LLM output).

**Webhooks:**
- Pros: Push-based. No persistent client connection needed.
- Cons: Requires clients to expose an HTTP endpoint. Not suitable for local-first CLI clients. Delivery guarantees add complexity. Out of v1 scope. See ADR-009.

### 9. Idempotency keys

**No idempotency (duplicate requests create duplicate resources):**
- Pros: Simpler implementation. No key storage or lookup.
- Cons: Network retries create duplicates. Clients must implement deduplication. Unreliable in practice — mobile and flaky networks cause duplicate requests.

**Request deduplication by content hash:**
- Pros: No client cooperation needed. Automatic deduplication.
- Cons: Cannot distinguish intentional duplicate requests from accidental retries. Same content submitted twice at different times is incorrectly deduplicated. No client control over idempotency window.

**Conditional headers (If-None-Match, If-Match):**
- Pros: Standard HTTP mechanism. Works with ETags.
- Cons: Requires resource to already exist (ETag-based). Not applicable to creation endpoints. More complex client implementation. Doesn't prevent duplicate creation.

### 10. Standard error model

**Problem Details (RFC 7807):**
- Pros: IETF standard. Extensible with extensions and type URIs. Machine-readable type field.
- Cons: More verbose. Requires type URI resolution. Over-engineered for our error model which is simple by design. The `type` URI field adds indirection without value for a local-first system.

**Flat error strings:**
- Pros: Simple. Easy to implement.
- Cons: Not machine-readable. Clients must parse messages. No structured error codes. Cannot programmatically handle errors.

**Per-endpoint error shapes:**
- Pros: Tailored error information per endpoint. Maximum specificity.
- Cons: Inconsistent client error handling. Every endpoint requires custom error parsing. No shared error handling logic. Hard to document and maintain.

## Consequences

**Positive:**
- Spec-first development ensures implementation matches the API contract by construction (ADR-007).
- OpenAPI 3.1 enables type generation, validation, and contract testing from a single source of truth.
- OpenAI-inspired patterns reduce learning curve for developers familiar with LLM APIs (ADR-010).
- Activity trace endpoint provides one-request observability into the delegation tree (ADR-012).
- Key-value settings are simple to implement, query, and extend without schema changes.
- Separate steps endpoint keeps Run responses small and focused on status/metadata.
- PATCH with tool_ids provides atomic assignment without extra endpoints.
- Cursor-based pagination is stable, efficient, and works well with PostgreSQL keyset pagination.
- SSE streaming is HTTP-native, works with Hono's streaming support, and aligns with LLM API conventions.
- Idempotency keys prevent duplicate mutations from network retries.
- Standard error model enables consistent client-side error handling across all endpoints.
- All ten decisions align with ANTS' core principles: API-first (ADR-009), privacy-first, and extensible from day one.

**Negative:**
- Spec-first requires discipline: implementation must not drift from spec. Contract tests mitigate this but add maintenance burden.
- Not OpenAI-compatible: developers may expect compatibility. Clear documentation ("inspired by, not compatible with") is required (ADR-010).
- Activity trace endpoint can return large responses for threads with many runs. Clients should use it judiciously.
- Key-value settings lack type safety at the API level. Clients must know expected value types.
- Separate steps endpoint requires an extra request when both run and step data are needed.
- PATCH with tool_ids replaces the entire tool list — clients must send the full list, not just additions/removals.
- Cursor-based pagination does not support random page access (jump to page N).
- SSE is unidirectional; clients cannot send messages over the event stream (WebSockets can).
- Idempotency keys require server-side storage with TTL management and cleanup.
- Standard error model may lack specificity for complex error scenarios compared to per-endpoint error shapes.