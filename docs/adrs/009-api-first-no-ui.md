# ADR-009: API-First, No UI

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS is a multi-agent orchestration engine, not an end-user application. It needs to be consumable by any client — CLI tools, future web UIs, mobile apps, other services, and programmatic integrations. Building a web UI would lock us into a specific interface paradigm, increase v1 scope significantly, and distract from core orchestration functionality.

Johnathan has explicitly stated that ANTS should have no UI dependency. The system is API-only, and any UI is a separate consumer project. This is a deliberate architectural constraint that keeps the system focused on its core purpose: orchestrating AI agents through a well-defined API.

The OpenAPI 3.1 specification is the contract between ANTS and its consumers. Every feature must be accessible through the API, and the API must be self-describing through the spec.

## Decision

**ANTS is a pure API system with no web interface, dashboard, or frontend.**

All interaction with ANTS is through the OpenAPI 3.1 specification. The API is the product. Consumers (CLI tools, future UIs, other services) interact solely through HTTP endpoints defined in the spec.

This decision is reflected in the project structure: no `src/ui/`, no `src/frontend/`, no template engine. The entire codebase is API routes, middleware, services, models, agents, and tools. The OpenAPI spec is the single source of truth for what ANTS can do.

Swagger UI or similar tools can be used for development and testing, but they are development tools, not part of the ANTS product.

## Alternatives Considered

### API + Web Dashboard
- **Pros**: Visual feedback for development. Easier demo. User-friendly for non-technical users.
- **Cons**: Increases v1 scope significantly. Locks into a UI framework choice. Distracts from core API development. Dashboard becomes a maintenance burden. Requires frontend expertise that could be spent on API features.

### API + OpenWebUI Integration
- **Pros**: Existing open-source UI. Quick to set up. Supports chat interfaces.
- **Cons**: Creates coupling to an external project we don't control. OpenWebUI's API may not align with ours. Dependency on their release schedule. Doesn't support our multi-agent model naturally.

### Headless CLI + API
- **Pros**: CLI provides immediate usability. Can be used for testing and interaction.
- **Cons**: Adds CLI complexity to v1 scope. CLI is a consumer, not part of ANTS core. Better to build CLI as a separate project that consumes the API.

## Consequences

**Positive:**
- Clear separation of concerns — ANTS does one thing well: orchestrate agents via API.
- Reduces v1 scope significantly, focusing engineering effort on core functionality.
- API spec is the contract — any consumer can build on it.
- No frontend framework dependencies or maintenance burden.
- OpenAPI spec enables automatic client generation (TypeScript, Python, etc.).
- Swagger UI available for development testing without building a custom UI.

**Negative:**
- Harder to demonstrate the system without a UI.
- Development experience is more API-oriented (curl, HTTP clients, Swagger UI).
- Non-technical stakeholders can't interact without a consumer application.
- Testing multi-agent conversations requires API calls, not visual feedback.