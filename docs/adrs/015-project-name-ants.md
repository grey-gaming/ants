# ADR-015: Project Name - ANTS (Autonomous Networked Task System)

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

The project needs a name that reflects its purpose as a multi-agent orchestration and task management system. The system coordinates multiple AI agents (autonomous entities) that work together (networked) to accomplish goals (task system). The name should be memorable, meaningful, and distinguish the system from the AI assistant (ANT) that runs on it.

The name "ANTS" was chosen by Johnathan, the project owner. The acronym must accurately reflect what the system does. The name also establishes a naming relationship: ANTS is the orchestration engine, ANT is the AI assistant persona built on ANTS.

## Decision

**The project name is ANTS — Autonomous Networked Task System.**

- **Autonomous**: Agents operate independently within their delegation scope. The T1 Orchestrator routes, the T2 Specialist reasons, the T3 Task Agent executes — each with autonomy within its defined role.
- **Networked**: Agents communicate and collaborate through the conversational hub-and-spoke model. They are not isolated workers but a connected network that engages in multi-turn dialogue.
- **Task System**: The system orchestrates tasks — routing, coordinating, delegating, monitoring, and completing work. It is a task management system powered by AI agents.

The name ANTS also carries a metaphorical resonance: ant colonies are organized systems where specialized workers collaborate through structured communication, with roles (queen/worker/soldier) that mirror our T1/T2/T3 tier structure.

The distinction between ANTS (the orchestration engine) and ANT (the AI assistant persona) is intentional and important:
- **ANTS** is the platform — the runtime, API, agents, and infrastructure.
- **ANT** is a persona — an AI assistant built on the ANTS platform.

## Alternatives Considered

### Agent Network Task System
- **Pros**: Similar acronym, "Agent" is a common AI term.
- **Cons**: "Agent" doesn't capture the autonomy aspect. "Network" suggests a passive network of agents rather than autonomous collaboration. Less evocative than "Autonomous." Not preferred by the project owner.

### Multi-Agent Orchestrator (MAO)
- **Pros**: Descriptive, clear about what it does.
- **Cons**: Less memorable. No acronym that works as a project name. Doesn't capture the "task system" aspect.

### Swarm
- **Pros**: Evocative of collective intelligence, emergent behavior.
- **Cons**: Conflicts with existing projects (OpenAI Swarm, Swarm framework). Implies emergent/uncontrolled behavior rather than structured hierarchy. Doesn't reflect the hub-and-spoke model with clear tiers.

### Nexus
- **Pros**: Implies connection and coordination. Clean, modern name.
- **Cons**: Vague — doesn't specify what's being connected. Many existing projects named Nexus. Doesn't capture the "task system" or "autonomous" aspects.

## Consequences

**Positive:**
- Clear, meaningful acronym that describes what the system does.
- Memorable name that works as both acronym and word.
- Metaphorical resonance with ant colony organization (hierarchical, specialized roles).
- Clear distinction between ANTS (platform) and ANT (assistant persona).
- Short, easy to type, easy to remember.

**Negative:**
- "ANTS" may conflict with other projects in search results.
- May be confused with ant/ant colony optimization algorithms.
- The acronym requires explanation on first use ("ANTS stands for Autonomous Networked Task System").
- Less unique than a coined name (like "Kubernetes").