# ADR-021: Error Handling Model

- **Status**: Accepted
- **Date**: 2026-06-10

## Context

ANTS has multiple error-producing surfaces: the HTTP API layer, the LLM inference layer, and the tool execution layer. Each surface produces errors with different characteristics and requires different handling strategies. Without a unified error model, errors would be handled inconsistently — some might crash runs, others might be silently swallowed, and clients would have no predictable way to interpret failures.

Existing ADRs that constrain this decision:
- ADR-018 (API Specification Design) — standard `{ error: { code, message, details } }` shape for API errors
- ADR-019 (Tool Execution Model) — tool errors become tool results, not run failures
- ADR-008 (LLM Provider - Ollama) — local inference can fail (model not loaded, OOM, timeout)

## Decision

### 1. Three error tiers: API errors (HTTP status codes), LLM errors (run status: failed), tool errors (step status: failed)

ANTS distinguishes three tiers of errors, each with distinct propagation and handling:

- **API errors**: HTTP layer errors (bad request, unauthorized, not found, etc.). Returned to the client immediately with standard HTTP status codes and the `Error` schema.
- **LLM errors**: Errors from the LLM inference layer (model unavailable, inference timeout, invalid response). These affect the Run, not individual steps. The run status becomes `failed` with error detail.
- **Tool errors**: Errors from tool execution (timeout, invalid args, permission denied, execution failure). These affect the RunStep, not the Run. The step status becomes `failed` but the run continues — the error is returned to the LLM as a tool result.

### 2. API errors: 400/401/404/409/422/429/500 with standard Error schema

All API errors use the standard `{ error: { code, message, details } }` response shape defined in ADR-018. Status codes:
- `400` — Malformed request body or parameters
- `401` — Missing or invalid API key
- `404` — Resource not found
- `409` — Conflict (e.g., canceling a completed run)
- `422` — Validation error (Zod schema violation)
- `429` — Rate limit exceeded (includes `Retry-After` header)
- `500` — Internal server error

The `code` field is a machine-readable string (e.g., `TOOL_NOT_FOUND`, `RATE_LIMIT_EXCEEDED`). The `message` field is human-readable. The `details` field is optional and provides additional context.

### 3. LLM errors: don't fail the run immediately, run status becomes failed with error detail

When an LLM inference call fails (model unavailable, OOM, timeout, invalid response), the system does not immediately mark the run as irrecoverably failed. Instead, the run enters a retry sequence (see Decision 6). If all retries are exhausted, the run status becomes `failed` and the error detail is stored on the Run object. Clients see the failed status via polling or SSE events.

### 4. Tool errors: become tool results fed back to LLM, step marked failed but run continues

Consistent with ADR-019, tool errors — regardless of type (timeout, invalid arguments, permission denied, execution failure) — are returned to the LLM as tool results in the `{ output: null, error: "..." }` shape. The RunStep status becomes `failed`, but the Run status remains `in_progress`. The LLM receives the error and decides how to proceed: retry with different arguments, try another tool, or inform the user. This maximises recovery opportunities.

### 5. SSE error handling: emit run.failed event with error detail

When a run fails (LLM error exhausted retries), the SSE stream emits a `run.failed` event containing the Run object (with `status: failed`) and the Error object with details. This event already exists in the OpenAPI spec (the `RunFailedEvent` schema). Clients subscribed to the SSE stream are notified immediately without polling.

### 6. Retry strategy: LLM errors use exponential backoff (2s, 4s, 8s, max 3 retries). Tool errors: no retry, feed to LLM. API errors: no retry.

- **LLM errors**: Retry with exponential backoff: 2s, 4s, 8s (max 3 retries). If the 4th attempt fails, the run fails. Backoff applies per LLM call within a run — if the LLM fails on turn 3 of a 10-turn conversation, retries apply to that specific call, not the entire run.
- **Tool errors**: No automatic retry. The error is returned to the LLM as a tool result. The LLM may choose to retry with different arguments, but this is the LLM's decision, not the system's.
- **API errors**: No retry. The client receives the error and decides whether to retry. Rate limit errors (429) include a `Retry-After` header.

### 7. Invalid LLM response: 1 retry with modified prompt

If the LLM returns a response that cannot be parsed (malformed tool call, invalid JSON, no valid content), the system retries once with a modified prompt that includes instructions like "Your previous response was invalid. Please provide a valid response." If the retry also produces an invalid response, the run fails. This is a lightweight recovery mechanism that handles common LLM output issues without requiring full retry cycles.

### 8. Partial tool failures: each tool call is a separate step, succeed/fail independently

When an agent makes multiple tool calls in a single turn, each tool call is a separate RunStep with its own status. If tool A succeeds and tool B fails, tool A's step is `completed` and tool B's step is `failed`. The run continues. The LLM receives both results — tool A's output and tool B's error — and can decide how to proceed. There is no "all-or-nothing" tool execution semantics.

## Alternatives Considered

### All errors as HTTP errors
- Pros: Simple, consistent, familiar to HTTP clients.
- Cons: LLM errors and tool errors occur within a streaming run — they cannot be expressed as HTTP status codes. The run is already in progress when these errors occur. Forcing everything through HTTP status codes would lose the distinction between "your request was bad" and "the LLM failed while processing your valid request."

### Tool errors fail runs
- Pros: Fail-fast, simpler error propagation, client doesn't need to handle partial failures.
- Cons: A single tool timeout or permission denial would fail the entire run, wasting all prior LLM work. The LLM could have recovered by trying a different approach. Tool errors are often transient or recoverable — failing the run is too aggressive.

### No retry
- Pros: Simpler, faster failure, no backoff complexity.
- Cons: LLM inference is prone to transient failures (model loading, memory pressure). A single failure would terminate the run unnecessarily. Exponential backoff is a well-established pattern for transient failures.

### Fixed retry count without backoff
- Pros: Simpler than exponential backoff, predictable retry count.
- Cons: Immediate retries on a loaded system increase load. Exponential backoff gives the system time to recover. Fixed-interval retries can make overload worse.

## Consequences

**Positive:**
- Three-tier error model maps cleanly to ANTS' three error surfaces (API, LLM, tools).
- Tool errors as LLM results enable self-correction instead of premature run failure.
- Exponential backoff for LLM errors handles transient inference failures gracefully.
- Partial tool failures let agents recover from individual tool errors without losing the entire run.
- SSE `run.failed` event gives streaming clients immediate error notification.
- Invalid LLM response retry catches common output formatting issues with minimal cost.

**Negative:**
- Three error tiers means three different handling strategies to implement, test, and document.
- Exponential backoff adds latency to LLM error recovery (up to 14s for 3 retries).
- Tool error self-correction relies on the LLM's ability to understand and fix errors — not all LLMs are equally good at this.
- Invalid LLM response retry (1 attempt) may not be enough for persistently malformed outputs, but the run fails rather than entering an infinite retry loop.
- Partial tool failures mean clients must check each step's status individually rather than assuming all steps in a turn share the same outcome.