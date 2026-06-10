# ADR-024: Graceful Shutdown

- **Status**: Accepted
- **Date**: 2026-06-10

## Context

ANTS manages long-running processes: LLM inference calls, multi-turn agent conversations, tool executions, and context compaction. Abruptly terminating the process (e.g., during a deployment or system restart) would lose in-progress runs, corrupt conversation state, and leave users with failed runs. The system needs a graceful shutdown strategy that preserves run state, completes in-flight work where possible, and communicates shutdown status to clients.

Existing ADRs that constrain this decision:
- ADR-011 (3-Tier Conversational Hub-and-Spoke) — multi-tier agents may have runs in progress at any tier
- ADR-019 (Tool Execution Model) — tool executions may be in progress during shutdown
- ADR-020 (Context Compaction) — compaction state must be preserved across restarts
- ADR-021 (Error Handling Model) — run state changes must be communicated to clients

## Decision

### 1. SIGTERM/SIGINT triggers graceful shutdown

The ANTS process listens for SIGTERM and SIGINT signals. On receiving either signal, the process enters graceful shutdown mode. SIGTERM is the standard signal from container runtimes and process managers. SIGINT (Ctrl+C) is supported for local development. Both signals trigger the same shutdown sequence.

### 2. Stop accepting new requests immediately

On shutdown signal, the HTTP server stops accepting new connections and new HTTP requests. The server responds to new requests with 503 Service Unavailable and a `Retry-After` header indicating when the client should retry. Existing in-flight HTTP requests continue to be processed.

### 3. Complete in-progress HTTP requests within 30-second timeout

In-flight HTTP requests are given 30 seconds to complete. If a request does not complete within 30 seconds, it is forcibly terminated and the client receives a connection reset. For SSE streams (active runs), the stream is closed with a terminal event indicating shutdown. The 30-second timeout is configurable via `SHUTDOWN_TIMEOUT_SECONDS` env var.

### 4. Persist running runs as paused, resume on restart

Any runs that are `in_progress` when shutdown begins are persisted to the database with status `paused`. On restart, the system checks for paused runs and resumes them automatically. The paused run retains all conversation state, tool call history, and LLM context. Resumption replays from the last completed step, not from the beginning.

### 5. Persist compaction state

If a run is in the middle of context compaction (Stage 2 LLM summarisation) when shutdown begins, the compaction state (messages already summarised, summary content) is persisted. On restart, the compaction continues from where it left off rather than restarting from scratch. This avoids redundant LLM calls for summarisation.

### 6. 503 Service Unavailable during shutdown phase

While in shutdown phase, the HTTP server responds to all new requests with 503 Service Unavailable and a `Retry-After` header. The `Retry-After` value is set to the configured shutdown timeout (30 seconds by default). This signals to clients that the service is temporarily unavailable and will return shortly.

## Alternatives Considered

### Fail all running runs on shutdown
- **Pros**: Simple, no state persistence for in-progress runs, clean restart.
- **Cons**: Data loss, poor UX — users lose in-progress conversations. Runs may have significant context (multiple turns, tool calls) that would be expensive to reproduce. Unacceptable for a system managing long-running agent conversations.

### No timeout (let in-flight requests complete naturally)
- **Pros**: No requests are forcibly terminated, all work completes.
- **Cons**: In-flight requests could hang indefinitely (e.g., a stuck LLM call), preventing clean shutdown. The process would never exit if a request never completes. The timeout ensures shutdown completes in bounded time.

### External job queue (Redis, RabbitMQ)
- **Pros**: Persistent job queue, runs survive process restarts, decoupled from process lifecycle.
- **Cons**: Adds Redis or RabbitMQ infrastructure dependency. Violates ADR-013 (single database, PostgreSQL only). Overkill for single-machine deployment where pausing runs in PostgreSQL is sufficient.

## Consequences

**Positive:**
- Paused runs resume on restart, preserving conversation state and user work.
- Persisted compaction state avoids redundant LLM summarisation calls on restart.
- 503 with Retry-After gives clients a clear signal during shutdown.
- 30-second timeout (configurable) ensures shutdown completes in bounded time.
- SIGTERM/SIGINT support works with container runtimes and local development.
- Single-database solution (PostgreSQL) for persisted state, consistent with ADR-013.

**Negative:**
- Paused runs require resume logic — the system must track the last completed step and replay from that point.
- 30-second timeout may terminate long-running requests. Clients must handle connection resets and retry.
- SSE stream termination requires a shutdown event type, adding a schema change to the SSE protocol.
- Compaction state persistence adds complexity — the system must serialise partial compaction state and resume it correctly.
- Resume-on-start may create a burst of LLM calls if many runs were paused, potentially overwhelming Ollama on restart.