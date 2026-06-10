# ADR-020: Context Compaction

- **Status**: Accepted
- **Date**: 2026-06-10

## Context

ANTS agents operate within finite LLM context windows. Conversations grow with each turn — messages, tool calls, tool results — and will eventually exceed the model's context limit. Without compaction, long conversations either fail (context overflow) or produce degraded LLM output (truncated by the provider). The system needs a strategy for managing context size that preserves conversation coherence while staying within token budgets.

Existing ADRs that constrain this decision:
- ADR-011 (3-Tier Conversational Hub-and-Spoke) — multi-tier agents, each with their own conversations
- ADR-008 (LLM Provider - Ollama) — local inference, fixed context window sizes
- ADR-019 (Tool Execution Model) — tool output size limits already reduce context pressure

## Decision

### 1. Same token budget for ALL tiers (32K context window, reserve ~8K for response)

All agent tiers — T1 orchestrator, T2 specialists, T3 task agents — share the same token budget: 32K context window with ~8K reserved for the LLM's response, leaving ~24K for input context. This simplifies the system: no tier-specific budget configuration, no special-casing in the compaction logic. The 32K window is based on the context size of the primary Ollama model. If a different model with a different context window is used, the budget adjusts accordingly.

### 2. Same compaction algorithm for ALL tiers — no tier-specific strategies

All tiers use the identical two-stage compaction algorithm. There is no "orchestrator gets more context" or "task agents use sliding window only." A single algorithm means a single code path, single set of tests, single tuning surface. Tier-specific optimisation is premature — we do not yet have data showing that different tiers benefit from different strategies.

### 3. Tiers do NOT pass context — each agent provides its own context. Orchestrator decides what to include in task prompts for sub-agents.

When a T1 orchestrator delegates to a T2 specialist or a T2 delegates to a T3 task agent, the delegator does not pass its full conversation context to the sub-agent. Each agent builds its own context from its own conversation thread. The orchestrator decides what information to include in the task prompt (the message that initiates the sub-run), but the sub-agent's context window is its own. This prevents context cascading — where a T3 agent receives the accumulated context of all parent agents — and keeps each agent's context independent and manageable.

### 4. Two-stage compaction

**Stage 1: Remove tool results older than last N turns** (N configurable, default 3). Tool results from earlier turns are replaced with a placeholder: `[Tool result for <tool_name> removed — older than 3 turns]`. This is lossy but lightweight. The LLM already acted on those results in previous turns, so the raw output is no longer needed — only the fact that a tool was called matters.

**Stage 2: If still over budget after Stage 1, LLM summarises oldest messages, replaces with single "Conversation summary" message.** The system sends the oldest messages (system prompt excluded) to the LLM with a summarisation prompt, then replaces them with a single `{"role": "system", "content": "Conversation summary: <summary>"}` message. This is more expensive (requires an LLM call) but preserves coherence. Stage 2 only fires when Stage 1 is insufficient.

### 5. Compaction trigger: when token count exceeds 80% of budget

Compaction runs before each LLM call. If the estimated token count of the current context exceeds 80% of the input budget (~19.2K tokens for a 24K input budget), compaction is triggered. The 80% threshold provides headroom for the current turn's contribution (user message + tool calls + tool results) before hitting the hard limit.

### 6. Tool result compaction: 10K char limit per result, truncate with marker

Consistent with ADR-019, each tool result is capped at 10,000 characters. Truncation appends a `[Result truncated from X characters]` marker. This is applied at tool execution time (before the result enters the conversation), not at compaction time. It is a proactive measure that reduces context pressure before compaction is needed.

### 7. Token counting: estimate using character ratio (1 token ≈ 4 chars) for v1

Token counting is estimated using a simple character-to-token ratio of approximately 4 characters per token. This is fast, requires no external library, and is sufficiently accurate for budget estimation. Exact token counting (using the model's tokenizer) is deferred to a future version. The estimate is conservative — if it overcounts, compaction runs slightly earlier, which is safe.

### 8. Compaction service runs before each LLM call, agent doesn't need to know about it

Compaction is transparent to agents. The compaction service is invoked by the run executor before each LLM call. Agents never call compaction directly, never configure it, and never see the compacted context — they see the same message list API. This keeps agent logic simple and decoupled from context management.

## Alternatives Considered

### Tier-specific budgets
- Pros: Orchestrator (T1) might benefit from a larger context window for coordinating multiple specialists. Task agents (T3) might work fine with smaller windows.
- Cons: Adds configuration complexity. No data yet to justify different budgets. Single budget simplifies implementation, testing, and debugging.

### Sliding window only (no summarisation)
- Pros: Simple, fast, no LLM call needed for compaction.
- Cons: Pure removal loses conversation coherence. The LLM may forget critical context from earlier turns with no summary to bridge the gap. Stage 2 summarisation preserves more information.

### Pruning only (remove least-important messages)
- Pros: Selective removal preserves the most relevant messages.
- Cons: Requires a relevance scoring mechanism, which is complex and unreliable without semantic understanding. No clear heuristic for "least important" that works across all conversation types.

### No compaction (let the LLM provider handle truncation)
- Pros: Zero implementation effort. The provider silently truncates.
- Cons: Silent truncation produces unpredictable LLM behavior. The model may hallucinate missing context. No control over what is preserved. Unacceptable for a system that needs reliable agent behavior.

### MemGPT-style memory architecture
- Pros: Sophisticated memory management with working memory, long-term memory, and recall operations.
- Cons: Significantly more complex. Requires vector search (pgvector, not yet active). Adds LLM calls for memory management. Overkill for v1 where conversation lengths are moderate. Can be added as a future extension.

## Consequences

**Positive:**
- Single algorithm for all tiers simplifies implementation, testing, and tuning.
- Two-stage compaction balances cost (Stage 1 is free, Stage 2 requires an LLM call) and coherence.
- Transparent compaction keeps agent logic clean — agents don't manage context.
- 80% trigger threshold provides safety margin before hitting hard limits.
- Character-ratio token estimation is fast and sufficient for v1.

**Negative:**
- Same budget for all tiers may be suboptimal. T1 orchestrators coordinating multiple specialists might benefit from more context. T3 task agents doing single tasks might waste context budget.
- Stage 2 summarisation requires an LLM call, adding latency and token cost before the actual LLM call.
- Tool result removal (Stage 1) is lossy. If the LLM references a removed tool result in a later turn, it will not have the data.
- Character-ratio token estimation is imprecise. It may trigger compaction too early (wasting context) or too late (risking overflow).
- No cross-thread memory. Each agent's context is isolated to its own conversation. Cross-thread context is a future extension.