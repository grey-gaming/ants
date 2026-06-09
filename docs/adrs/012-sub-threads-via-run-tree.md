# ADR-012: Sub-threads via Run Tree

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

When agents delegate to other agents in our 3-tier conversational model, they need isolated conversation contexts within the broader user thread. The T1 Orchestrator delegates to a T2 Specialist, which delegates to a T3 Task Agent. Each delegation creates a mini-conversation that must be:
1. **Isolated**: Each agent's conversation has its own context and doesn't pollute other conversations.
2. **Traceable**: We can reconstruct the full conversation hierarchy for debugging and auditing.
3. **Accessible**: All messages are in the user's thread for easy retrieval.

The challenge is providing isolation for each agent's conversation while keeping everything in the user's thread context. Creating separate Thread entities for every delegation would add complexity and make it hard to reconstruct the full conversation flow.

## Decision

**Sub-threads are represented by the Run tree via the `parent_run_id` foreign key on the Run entity.**

When a T1 orchestrator or T2 specialist delegates to another agent, a new Run is created with `parent_run_id` pointing to the delegator's Run. This creates a tree of Runs that mirrors the delegation hierarchy.

All messages share the same `thread_id` (the user's original thread) but are associated with specific Runs via RunStep. The Run tree provides isolation and hierarchy — each Run knows its parent and children — while the shared thread_id keeps all messages in the same conversation context for the user.

Example hierarchy:
```
Thread (user conversation)
└── Run (orchestrator execution) [parent_run_id: null]
    ├── RunStep: Orchestrator routes to Research Agent
    │   └── Run (research agent execution) [parent_run_id: orchestrator_run_id]
    │       ├── RunStep: Research Agent receives task
    │       ├── RunStep: Research Agent calls web_search tool
    │       ├── RunStep: Research Agent synthesizes and responds
    │       └── Run complete
    └── RunStep: Orchestrator composes final response
```

## Alternatives Considered

### Separate Thread Entities per Delegation
- **Pros**: Full isolation for each agent conversation. Each thread is independent.
- **Cons**: Explosion of Thread entities for every delegation. Hard to reconstruct conversation flow across threads. Complex foreign key relationships. Difficult to present a unified view to the user. Thread creation/deletion overhead.

### Flat Message Stream with Tags/Annotations
- **Pros**: Simplest data model — all messages in one stream.
- **Cons**: No structural hierarchy. Hard to manage state (which conversation is active, which is waiting). No clear way to track delegation boundaries. Requires complex filtering to reconstruct sub-conversations.

### External Conversation Store
- **Pros**: Separates conversation management from main data storage.
- **Cons**: Adds another system dependency (violates single-database strategy). Complex synchronization. Another component to deploy and maintain. Overkill for our needs.

### Nested Thread Objects (MongoDB-style)
- **Pros**: Natural hierarchy in document databases.
- **Cons**: PostgreSQL doesn't support nested documents natively. Would require complex JSONB queries. Loses relational integrity.

## Consequences

**Positive:**
- Clean hierarchical structure without Thread proliferation.
- Run tree mirrors the delegation hierarchy naturally.
- All messages stay in the user's thread for easy retrieval.
- `parent_run_id` foreign key enables efficient tree queries.
- Run status tracking (queued, in_progress, awaiting_response, completed, failed) per delegation.
- Simple to query: "give me all runs for this thread" or "give me all sub-runs of this run."

**Negative:**
- Complex queries needed to reconstruct sub-thread conversations (mitigated: service layer provides abstraction).
- Run tree depth must be bounded — enforced by tier constraints (max 3 levels: T1→T2→T3).
- All messages in one thread means careful filtering is needed to present sub-conversations correctly.
- Deleting a parent Run must cascade or handle orphaned sub-Runs.