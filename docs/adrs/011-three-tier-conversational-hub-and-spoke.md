# ADR-011: 3-Tier Conversational Hub-and-Spoke Agent Model

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS orchestrates multiple AI agents to complete complex tasks. The fundamental question is how agents interact. Two models exist: fire-and-forget delegation (agent sends a message, receives a response, done) and conversational delegation (agents engage in multi-turn dialogue with tool use, clarification, and iteration).

Our experience and analysis show that fire-and-forget is insufficient for complex tasks. An agent researching a topic needs multiple search queries, evaluation of results, and synthesis — this requires multi-turn conversation, not a single function call. Similarly, a code review agent needs to discuss issues with a code writer, not just submit a one-shot review.

The model must also prevent runaway delegation — agents spawning agents spawning agents without bound. There needs to be a clear hierarchy that controls the delegation chain.

## Decision

**We adopt a 3-tier conversational hub-and-spoke model.**

The model has three tiers:
- **T1 — Orchestrator (The Hub)**: Single entry point for all user requests. Routes to specialists, coordinates multi-agent workflows, can interject mid-conversation to clarify or redirect. Stays in the loop, never delegates and forgets.
- **T2 — Specialists (The Spokes)**: Domain experts that receive delegated tasks. Can have multi-turn conversations with task agents. Can delegate subtasks to T3 agents. Can form conversational loops (e.g., code reviewer ↔ code writer).
- **T3 — Task Agents (The Leaves)**: Single-purpose workers. Cannot delegate to other agents. CAN ask clarifying questions within their conversation. Return results when their task is complete.

All agent interactions are **conversations** — multi-turn dialogues with tool use, clarification, and iteration. This is fundamentally different from fire-and-forget delegation. Each agent interaction creates a sub-thread within the parent Run.

Delegation constraints are enforced: T1 can delegate to T2 and T3. T2 can delegate to T3 only. T3 cannot delegate — it is always a leaf node.

## Alternatives Considered

### Flat Agent Swarm
- **Pros**: Simple model, no hierarchy, emergent behavior.
- **Cons**: No coordination mechanism. Agents may duplicate work or conflict. No clear authority for decision-making. Hard to prevent runaway delegation. No way to track conversation hierarchy.

### Single Super-Agent
- **Pros**: Simplest model — one agent handles everything.
- **Cons**: Doesn't scale for complex tasks. No specialization. Single point of failure. Can't leverage different model sizes for different tasks. The agent would need to be good at everything.

### DAG-Based Workflow
- **Pros**: Clear task dependency graph, parallelizable, deterministic.
- **Cons**: Too rigid for conversational agents. No feedback loops. Can't handle agents that need to clarify, iterate, or redirect. Doesn't match how LLM agents actually work.

### ReAct Loop Only
- **Pros**: Simple — single agent reasons, acts, and observes in a loop.
- **Cons**: Insufficient for complex multi-domain tasks. Can't delegate to specialized agents. No multi-agent coordination. Doesn't scale to tasks requiring different expertise.

## Consequences

**Positive:**
- Clear delegation hierarchy prevents runaway delegation.
- Conversational model enables quality through iteration and clarification.
- Hub-and-spoke gives the orchestrator visibility and control over all interactions.
- Tiers allow model routing (lighter models for T3, heavier models for T1/T2).
- Agent types are registered from v1, enabling future extension without architectural change.
- Natural organizational metaphor (like an ant colony: queen/soldiers/workers).

**Negative:**
- More complex than fire-and-forget delegation.
- Requires careful concurrency management when multiple agents converse simultaneously.
- Sub-thread tracking adds complexity to the data model.
- More complex error handling (what happens when a sub-agent fails mid-conversation?).
- Testing multi-agent conversations is harder than testing single-shot function calls.