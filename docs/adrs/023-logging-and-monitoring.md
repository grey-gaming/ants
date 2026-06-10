# ADR-023: Logging and Monitoring

- **Status**: Accepted
- **Date**: 2026-06-10

## Context

ANTS runs as a local-first system on a single machine. Without structured logging, debugging issues — especially in multi-agent conversations with tool calls, context compaction, and LLM inference — is extremely difficult. The system needs a logging strategy that provides visibility into what is happening without adding external dependencies or infrastructure requirements.

Existing ADRs that constrain this decision:
- ADR-008 (LLM Provider - Ollama) — local inference, must log LLM call details for debugging
- ADR-011 (3-Tier Conversational Hub-and-Spoke) — multi-tier agents produce complex nested logs
- ADR-019 (Tool Execution Model) — tool calls and results must be traceable
- ADR-020 (Context Compaction) — compaction events must be observable
- ADR-021 (Error Handling Model) — errors must be logged with full context
- ADR-018 (API Specification Design) — health endpoints must exist in the API spec

## Decision

### 1. Structured JSON logging to stdout only for v1

All logs are emitted as structured JSON to stdout. No file logging, no log rotation, no external logging infrastructure. Stdout-only follows the 12-factor app pattern and integrates with container runtimes (Docker, systemd) that capture stdout. Structured JSON enables machine parsing without custom log format parsers.

### 2. Consistent log schema: timestamp, level, service, trace_id, user_id, thread_id, run_id, agent_type, message, details

Every log entry follows the same schema: `timestamp` (ISO 8601), `level` (debug/info/warn/error), `service` (which service emitted the log — e.g., "api", "llm", "tool-executor", "auth"), `trace_id` (correlates related log entries across services), `user_id` (who triggered the action), `thread_id`, `run_id` (the conversation and run context), `agent_type` (which agent tier — "orchestrator", "specialist", "task"), `message` (human-readable description), `details` (optional object with structured context). Fields that don't apply are `null` rather than omitted, ensuring consistent schema shape.

### 3. Log events: API requests, LLM calls, tool executions, context compaction, auth, errors, run state changes

Specific events that are logged: (a) API requests — method, path, status, duration, (b) LLM calls — model, prompt tokens, completion tokens, duration, (c) tool executions — tool name, duration, status, (d) context compaction — stage, tokens before/after, (e) auth — login success/failure, API key validation, invite code usage, (f) errors — all errors at error level with stack traces in details, (g) run state changes — queued, in_progress, completed, failed, paused, cancelled.

### 4. Info level default, configurable via LOG_LEVEL environment variable

Default log level is info. Override with the `LOG_LEVEL` environment variable (debug, info, warn, error). No per-service log level configuration in v1. Debug level includes all logs; error level includes only errors.

### 5. Enhanced /v1/health and /v1/health/queue endpoints

- `/v1/health` returns: status, version, uptime, database connection status, Ollama connection status, and memory usage.
- `/v1/health/queue` returns: count of queued runs, count of in-progress runs, count of paused runs, and per-user run counts (admin only).

These endpoints support monitoring without external tools.

### 6. No external dependencies for v1

No OpenTelemetry, no Prometheus exporter, no ELK stack, no file-based logging. These are future extensions. The logging infrastructure is the JSON-to-stdout approach described above. External monitoring can be added later by consuming stdout (e.g., Promtail, Fluent Bit) without changing the application.

## Alternatives Considered

### OpenTelemetry
- **Pros**: Industry standard for observability, distributed tracing, metric collection.
- **Cons**: Significant dependency, complex setup, overkill for v1 single-machine deployment. Can be added later without changing the core logging approach.

### File-based logging
- **Pros**: Logs persist across restarts, easy to inspect locally.
- **Cons**: Violates 12-factor app pattern. Adds log rotation, retention, and management burden. Stdout capture by container runtimes solves persistence.

### Prometheus metrics endpoint
- **Pros**: Standard metrics collection, alerting, dashboards.
- **Cons**: Adds a dependency, requires Prometheus server. Health endpoints provide basic observability for v1. Can be added as a future extension.

### ELK stack
- **Pros**: Full-text search, dashboards, alerting.
- **Cons**: Requires Elasticsearch, Logstash, Kibana — heavy infrastructure for a local-first system. Stdout JSON can be consumed by lighter tools (Fluent Bit, Promtail).

## Consequences

**Positive:**
- Structured JSON logging enables machine parsing, filtering, and analysis without custom parsers.
- Stdout-only follows 12-factor app principles, integrates with container runtimes and log shippers.
- Consistent schema with trace_id enables correlation across services for a single request/run.
- LOG_LEVEL environment variable provides runtime configurability without restarts.
- Health endpoints provide operational visibility without external monitoring tools.
- No external dependencies keeps the system simple and offline-first.

**Negative:**
- No persistent logs by default — stdout is ephemeral unless captured by the runtime. Users must configure log shipping if they need persistence.
- No built-in dashboards or log UI — operators must use external tools (jq, grep, log shippers) to analyze logs.
- No per-service log level configuration in v1 — debug level produces logs for all services, which may be verbose.
- Health endpoints require database and Ollama connectivity checks, adding latency to those endpoints.
- No distributed tracing in v1 — correlating logs across asynchronous operations (agent delegation) relies on trace_id alone.