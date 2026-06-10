# ADR-026: Dynamic Tool Creation Forward Compatibility

- **Status**: Accepted
- **Date**: 2026-06-10

## Context

The long-term goal for ANTS is a self-evolving system where agents can create their own tools at runtime to solve novel problems. Today, all tools are built-in and registered at deployment. When an agent encounters a task it cannot solve with existing tools, it must fail or delegate back to the user. This limits the system's autonomy and adaptability.

While full dynamic tool creation is a Phase 2 feature, we need to design forward compatibility now. Adding foundational fields to the Tool schema before any production data exists is cheap; retrofitting them later after tool records populate the database would require a migration, backfill, and potentially breaking API changes. By adding these fields now with sensible defaults, we ensure the schema is ready for dynamic tools without paying the cost of a migration later.

Existing ADRs that constrain this decision:
- ADR-019 (Tool Execution Model) — defines the tool lifecycle, execution phases, output contract, and permission enforcement

## Decision

Add `source`, `version`, `status`, and `required_permissions` to the Tool schema, and `tool_version` to the RunStep schema, now. These are foundational fields that would be expensive to retrofit later. All built-in tools get `source=builtin`, `version="1.0.0"`, `status=active`, `required_permissions=[]`. Dynamic tool creation, approval workflows, sandboxed execution, and tool change events are deferred to Phase 2.

## Fields Added Now

| Field | Schema | Type | Enum/Default | Purpose |
|-------|--------|------|--------------|---------|
| `source` | Tool, ToolCreate | string | enum: [builtin, dynamic], default: builtin | Origin of the tool. Built-in tools ship with ANTS, dynamic tools are created at runtime by agents. |
| `version` | Tool, ToolCreate | string | default: "1.0.0" | Semantic version of the tool. Built-in tools start at 1.0.0. |
| `status` | Tool, ToolCreate, ToolUpdate | string | enum: [draft, testing, approved, active, deprecated, disabled], default: active | Lifecycle status of the tool. Built-in tools are active by default. |
| `required_permissions` | Tool, ToolCreate | array of strings | default: [] | Permissions required by this tool. e.g. ['net:api.example.com', 'fs.read:/tmp']. Built-in tools have implicit full trust. |
| `tool_version` | RunStep | nullable string | — | Version of the tool used in this step. Nullable for steps that are not tool calls. |

## Fields Deferred to Later

These fields are needed for full dynamic tool support but are not added now to avoid over-engineering v1:

- **risk_level**: enum for categorising tool risk (e.g. low, medium, high). Determines which sandbox tier to use for dynamic tools.
- **code**: the actual tool implementation code for dynamic tools (JavaScript/TypeScript source that runs in a sandbox).
- **approved_by / approved_at**: who approved a dynamic tool and when. Part of the approval workflow for dynamic tools entering the `approved` or `active` status.
- **Tool change events (SSE)**: MCP-style `tools/list_changed` notifications pushed to clients when tools are created, updated, or deleted.
- **Approval workflow**: review/approve/reject actions for dynamic tools transitioning from `draft` → `testing` → `approved` → `active`.

## Architecture Vision for Dynamic Tools (Phase 2)

### ToolExecutor Abstraction

Built-in tools use an `InProcessExecutor` — they run as trusted code inside the ANTS server process, matching the current execution model (ADR-019 §3). Dynamic tools use a `SandboxedExecutor` — they never run untrusted code in-process. The `ToolExecutor` interface abstracts over both, with `source` determining which executor to use. This preserves the simplicity of built-in tool execution while adding isolation only where needed.

### Sandbox Tiers

Dynamic tools are executed in sandboxed environments based on their risk level and `required_permissions`:

- **Tier 1 (Low Risk)**: Deno subprocess with restricted permissions. Tools that only need network access to specific domains or read-only filesystem access run in a Deno subprocess with `--allow-net=api.example.com` style permission flags. Low overhead, fast startup, good isolation for simple tools.
- **Tier 2 (High Risk)**: E2B/Docker container isolation. Tools that need write access, arbitrary network access, or complex system interactions run in a full container. Higher overhead but strong isolation guarantees. Containers are ephemeral — each tool execution gets a fresh environment.

The `required_permissions` field on the Tool entity maps directly to sandbox permission flags, enabling automatic tier selection.

### Validation Pipeline

Before a dynamic tool becomes `active`, it passes through a validation pipeline:

1. **Static analysis**: Lint the tool code for unsafe patterns, banned APIs, and style violations.
2. **Compile**: Type-check and compile the TypeScript/JavaScript source.
3. **Schema check**: Validate that the tool's declared `parameters_schema` matches its actual input handling.
4. **Sandbox test**: Execute the tool in the sandbox with sample inputs to verify it produces valid output and does not exceed resource limits.
5. **Approval**: A human or the orchestrator reviews the validation results and approves or rejects the tool.

A tool that fails any step remains in `draft` or `testing` status with error details.

### Hot Reload

Dynamic tools are hot-reloaded using Bun Workers. When a tool's code or configuration changes, the system spawns a new Worker with the updated code and drains the old one. This avoids server restarts for tool updates while maintaining execution isolation. Built-in tools continue to require a server restart (they are part of the deployment), but this is acceptable since built-in tools change infrequently.

### Tool Change Events

When tools are created, updated, or deleted, the system emits MCP-style `tools/list_changed` Server-Sent Events. Clients subscribed to a thread or run receive these notifications and can re-fetch the tool list. This enables real-time tool discovery: an agent that sees a `tools/list_changed` event can immediately use the new tool without polling. The event payload includes the tool ID, name, version, and the change type (created/updated/deleted).

### Auto-Rollback

The system monitors tool error rates during execution. If a tool's error rate exceeds a configurable threshold (e.g. >50% failures over the last N invocations), the system automatically disables the tool and rolls back to the previous version if one exists. This prevents a broken dynamic tool from degrading system reliability. The rollback is logged and an alert is emitted via the tool change event stream.

### Tool Creation Agent

A dedicated agent type (`tool-creator`) can create, test, and submit tools for approval. This agent receives a specification (natural language description of the desired tool), generates the tool code and `parameters_schema`, runs it through the validation pipeline, and submits it in `draft` status. The orchestrator or a human operator then reviews and approves the tool. This closes the loop: an agent that needs a new tool can delegate to the `tool-creator` agent, which produces a ready-for-review tool definition.

### Key Principle: Never Run Untrusted Code In-Process

The architectural boundary between built-in and dynamic tools is absolute: built-in code is trusted and runs in-process; dynamic code is untrusted and runs in a sandbox. No dynamic tool code ever executes in the ANTS server process. This principle ensures that a malicious or buggy dynamic tool cannot crash the server, access other tools' state, or escalate privileges.

## Alternatives Considered

### No forward compat (retrofit later)
- **Pros**: No schema changes now, simpler v1, zero risk of unused fields.
- **Cons**: Schema changes are cheap now with zero existing data. Retrofitting later requires a migration, backfill, and potentially breaking API changes. Every month of production data increases the migration cost.
- **Rejected**: Adding foundational fields now is low-cost and high-value. The migration cost only grows over time.

### Full dynamic tool support now
- **Pros**: Complete feature from day one, no deferred work, agents can create tools immediately.
- **Cons**: Over-engineering for v1. Sandboxed execution, approval workflows, validation pipelines, and tool change events are complex subsystems with no v1 requirement. Building them now would delay the v1 release significantly.
- **Rejected**: Forward-compatible schema fields are sufficient for v1. Full dynamic tool support is a Phase 2 feature with Phase 2 complexity.

### Separate dynamic tool registry
- **Pros**: Clean separation between built-in and dynamic tools, independent schemas, no discriminator field needed.
- **Cons**: Two registries to maintain, two APIs to surface tools, two sets of CRUD operations. Agents must query both registries to see available tools. The `source` discriminator on a unified schema is simpler and more maintainable.
- **Rejected**: A unified schema with a `source` discriminator is simpler than two parallel registries. The discriminator pattern is well-established and avoids duplication.

## Consequences

**Positive:**
- Schema is forward-compatible with dynamic tools — no migration needed when Phase 2 ships.
- `version` on RunStep enables audit trails linking tool invocations to specific tool versions.
- `status` lifecycle (draft/testing/approved/active/deprecated/disabled) supports the full tool lifecycle from creation through deprecation.
- `required_permissions` establishes the permission model that maps directly to sandbox tier selection.
- `source` discriminator enables execution-path selection (in-process vs. sandboxed) without two separate registries.
- Adding fields before production data exists is zero-cost; retrofitting later would be expensive.

**Negative:**
- Fields that are not yet exercised by v1 code may confuse implementers who expect full functionality behind every schema field.
- The `status` enum includes values (`draft`, `testing`, `approved`) that have no v1 meaning — they exist only for forward compatibility.
- `required_permissions` is declared but not enforced in v1, which may create a false sense of security.
- The architecture vision section describes systems that do not exist yet; it may become stale or constrain future decisions if requirements change.