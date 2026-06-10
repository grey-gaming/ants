# ADR-019: Tool Execution Model

- **Status**: Accepted
- **Date**: 2026-06-10

## Context

ANTS agents invoke tools to perform actions (web search, file operations, etc.). The system needs a well-defined execution model governing how tools are called, how results are returned, how errors are handled, and how safety boundaries are enforced. Without this, each tool implementation would make ad-hoc decisions about lifecycle, output format, error handling, timeouts, and permission checks — leading to inconsistent behavior and fragile agent-tool interactions.

Existing ADRs that constrain this decision:
- ADR-011 (3-Tier Conversational Hub-and-Spoke) — agents converse, tools are invoked within those conversations
- ADR-017 (Repository Structure) — tools live in `@ants/tools`, registries are config-driven
- ADR-018 (API Specification Design) — Tool and ToolCall schemas in the OpenAPI spec

## Decision

### 1. Phase-based execution lifecycle: pending → validating → executing → completed/failed/timed_out

Every tool invocation progresses through explicit phases. The `pending` state indicates the tool call has been created but not yet processed. `validating` means arguments are being checked against the tool's JSON Schema. `executing` means the tool is actively running. Terminal states are `completed` (success), `failed` (error during execution or validation), or `timed_out` (execution exceeded the configured timeout). These phases are visible in the `ToolCall.status` and `RunStep.status` fields, giving clients full observability into tool execution progress.

### 2. Synchronous execution for v1, async support later

In v1, tool execution is synchronous — when an agent calls a tool, the run blocks until the tool returns a result or times out. This simplifies the execution model and avoids the complexity of callback-based async tool results. Async tool execution (e.g., for long-running jobs) is deferred to a future version. The phase-based lifecycle is designed to accommodate async execution later without changing the status enum.

### 3. Same-process execution for v1 (no sandboxing yet)

Tool code runs in the same Bun process as the ANTS server. No subprocess isolation, no container sandboxing. This is a deliberate v1 simplification — tools are trusted code written by the system developers. Sandboxed execution (subprocess, WASM, or container isolation) is a future extension. The execution model does not preclude adding sandboxing later; it simply does not require it at v1.

### 4. Per-tool configurable timeout (default 30s)

Each tool has a `timeout_seconds` field (default 30). If a tool execution exceeds this limit, the status becomes `timed_out` and the tool result is `{ output: null, error: "Tool execution timed out after 30s" }`. This prevents runaway tools from blocking the system. The timeout is enforced at the tool execution layer, not by the LLM provider.

### 5. Tool output contract: JSON Schema input validation, standardised { output: any, error?: string } output

All tools accept input validated against a JSON Schema (the `parameters_schema` field on the Tool entity). All tools return a standardised output shape: `{ output: any, error?: string }`. On success, `output` contains the tool's result and `error` is absent. On failure, `output` is `null` and `error` contains a human-readable description. This contract is consistent across all tools and consumable by LLMs without special-casing.

### 6. Tool output size limit: 10K chars default, configurable per tool, truncate with [Result truncated from X characters] marker

Tool results are capped at a configurable `max_output_chars` (default 10,000). When output exceeds this limit, it is truncated and appended with a marker like `[Result truncated from 15234 characters]`. This prevents oversized tool outputs from consuming the LLM context window. The truncation is lossy but transparent — the LLM sees the marker and knows data was cut.

### 7. Permission enforcement: agent can only call tools in its tool_ids list

When an LLM generates a tool call, the system checks whether the requested tool is in the agent's `tool_ids` list. If the LLM hallucinates a tool outside this list, the step fails with status `failed` and the tool result is `{ output: null, error: "Permission denied: tool 'X' is not available to this agent" }`. This result is fed back to the LLM so it can self-correct. The run does not fail.

### 8. Invalid tool call args: validate against JSON Schema, return { output: null, error: "Invalid arguments: ..." } as tool result for LLM to self-correct

When tool arguments fail JSON Schema validation (during the `validating` phase), the tool does not execute. Instead, the step status becomes `failed` and the tool result is `{ output: null, error: "Invalid arguments: <details>" }`. This result is returned to the LLM as a tool result, enabling the LLM to recognise the error and retry with corrected arguments. The run continues.

### 9. Error propagation: tool errors become tool results fed back to LLM, not run failures

Tool errors — whether from timeout, permission denial, invalid arguments, or execution failure — are always returned to the LLM as tool results in the standard `{ output: null, error: "..." }` shape. The run continues. The LLM decides how to handle the error: retry with different arguments, try a different tool, or inform the user. Only catastrophic failures (e.g., the LLM itself crashes) cause a run to fail.

## Alternatives Considered

### Async-first execution
- Pros: Supports long-running tools, better resource utilisation, non-blocking.
- Cons: Adds significant complexity (callback management, result storage, polling). No v1 tools require async. Synchronous execution covers all v1 needs and is far simpler.

### Subprocess sandboxing
- Pros: Security isolation, resource limits, crash containment.
- Cons: IPC overhead, deployment complexity, no v1 requirement (tools are trusted system code). Can be added later without changing the execution model.

### Untyped output (no standardised output contract)
- Pros: Tools return whatever they want, maximum flexibility.
- Cons: LLMs cannot reliably parse arbitrary output formats. No consistent error handling. Each tool needs custom result parsing logic.

### No size limits on tool output
- Pros: No data loss, full fidelity results.
- Cons: A single oversized tool result (e.g., a full web page) can exhaust the LLM context window, causing the entire run to fail. Unbounded output is a reliability risk.

## Consequences

**Positive:**
- Phase-based lifecycle gives clients full visibility into tool execution progress.
- Standardised output contract means LLMs and clients always know how to parse tool results.
- Error-as-result pattern lets LLMs self-correct instead of failing entire runs.
- Per-tool timeouts prevent runaway tools from blocking the system.
- Output size limits protect the LLM context window from being overwhelmed.
- Permission enforcement prevents LLM hallucination from calling unavailable tools.

**Negative:**
- Synchronous execution blocks the run during tool calls. Long-running tools will need async support in a future version.
- Same-process execution means a tool crash could take down the server. Sandboxing is deferred but not precluded.
- Output truncation is lossy. The LLM may miss critical information in truncated results.
- Permission denial and invalid arguments produce tool results that consume LLM turns, potentially wasting budget on self-correction loops.