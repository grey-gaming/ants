# ADR-014: Multi-user Auth with API Keys

- **Status**: Accepted
- **Date**: 2026-06-09

## Context

ANTS is a multi-user system from v1. Multiple users need isolated access to their own threads, messages, and runs. Data isolation is a core requirement — one user must never see another user's data.

The system runs locally on a single machine, offline-first, with no cloud dependency. Authentication must work entirely offline without external identity providers. It must be simple to implement, simple to use (for API consumers), and support row-level data isolation.

Users interact with ANTS through API calls. There is no UI where users log in with a browser. Authentication must be API-native.

## Decision

**We use API key authentication with row-level security enforced at the Drizzle query layer.**

Each user has API keys. API keys are bearer tokens sent in the `Authorization: Bearer <key>` header. Keys are hashed before storage (like passwords, using a secure hashing algorithm). Keys support naming (for identification), expiration, and last-used tracking.

Row-level security ensures complete data isolation. Every database query is scoped by `user_id`. A user can only see their own threads, messages, runs, and resources. This is enforced at the Drizzle query layer, not just at the API level — there is no way to bypass the scoping through the codebase.

API endpoints:
- `POST /v1/api-keys` — Create a new API key
- `GET /v1/api-keys` — List user's API keys
- `DELETE /v1/api-keys/{id}` — Revoke an API key

## Alternatives Considered

### OAuth 2.0
- **Pros**: Industry standard, supports third-party login, token refresh, scopes.
- **Cons**: Requires an external identity provider (Google, GitHub, etc.) — violates offline-first constraint. Self-hosted OAuth server adds significant complexity. Overkill for API-only system with local users.

### JWT with Username/Password
- **Pros**: Stateless authentication, no server-side session storage, widely understood.
- **Cons**: Adds user management complexity (registration, login, password reset). Requires JWT secret management. Session invalidation is complex with stateless tokens. More complex than API keys for a local-only system.

### No Authentication
- **Pros**: Simplest implementation, no overhead.
- **Cons**: Unacceptable for multi-user system. No data isolation — any user can see all data. No accountability. No way to track usage per user.

### Mutual TLS (mTLS)
- **Pros**: Strong authentication, no token management, works offline.
- **Cons**: Complex client certificate management. Not user-friendly for API access. Requires PKI infrastructure. Overkill for local deployment.

## Consequences

**Positive:**
- Simple offline-compatible authentication — no external dependencies.
- API keys are the standard for API authentication — familiar to developers.
- Row-level security at the query layer ensures complete data isolation.
- Key naming helps users manage multiple keys (e.g., "development", "production").
- Key expiration and last-used tracking support security hygiene.
- Easy to implement and test.

**Negative:**
- API keys are bearer tokens — if leaked, full access is granted (mitigated: HTTPS enforcement, key rotation, key expiration).
- No fine-grained permissions in v1 — all keys have full access. Scope restrictions are a future extension.
- Key management is manual — users must store keys securely.
- No password-based login flow — users must manage keys programmatically.
- Revoked keys cannot be reactivated (mitigated: users can create new keys).