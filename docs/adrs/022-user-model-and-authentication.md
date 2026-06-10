# ADR-022: User Model and Authentication

- **Status**: Accepted
- **Date**: 2026-06-10

## Context

ANTS is a multi-user system running locally on a single machine, offline-first, with no cloud dependency. ADR-014 established API key authentication with row-level security at the Drizzle query layer. While API keys work well for programmatic access, they are insufficient as the sole identity mechanism — there is no concept of a "user" who can log in, change settings, or manage their own keys. The system needs a full user identity model to support interactive sessions, user-specific settings, and administrative controls.

Existing ADRs that constrain this decision:
- ADR-014 (Multi-user Auth with API Keys) — established API key auth, row-level security, bearer tokens, key hashing. This ADR supersedes and extends ADR-014.
- ADR-008 (LLM Provider - Ollama) — local inference, no cloud dependency
- ADR-011 (3-Tier Conversational Hub-and-Spoke) — multi-tier agents with independent conversations
- ADR-017 (Repository Structure) — strict package boundaries, config-driven registries

## Decision

### 1. Email/password authentication with bcrypt hashing

Users authenticate with email and password. Passwords are hashed with bcrypt (cost factor 12). Email is the unique identifier for login. This replaces the API-key-only approach from ADR-014 with a full user identity model. bcrypt at cost factor 12 provides strong resistance to brute-force attacks while remaining fast enough for local single-machine deployment.

### 2. Invite-only registration (admin creates users or generates invite codes)

No open registration. New users are created in one of two ways: (a) an admin directly creates a user account via the API, or (b) an admin generates an invite code that allows a new user to register themselves. Invite codes are single-use, optionally expire, and can be revoked. This prevents unauthorized access on a locally-deployed system.

### 3. JWT sessions (24h expiry) + API keys (sk_ prefix) for authentication

Two auth mechanisms: (1) JWT tokens for interactive/session-based access, issued on login, with 24-hour expiry and refresh via re-authentication. (2) API keys with the `sk_` prefix (e.g., `sk-ants-abc123...`) for programmatic/scripted access, persistent until revoked. Both mechanisms are bearer tokens in the Authorization header. JWT tokens identify the user and carry role claims; API keys identify the user and are looked up in the database.

### 4. Two roles: user and admin

- **user**: Can manage own data (threads, messages, runs, API keys, settings). Cannot access other users' data or system administration.
- **admin**: Can do everything a user can, plus: manage all users, create invite codes, manage all runs, manage agent/tool registries, manage global settings.

No fine-grained permissions or RBAC in v1. Two roles keep the model simple while supporting the invite-only bootstrap flow.

### 5. Per-user settings with model override and max_concurrent_runs

Each user has a settings record with: (a) `model_override` — override the default LLM model with any Ollama model name, (b) `max_concurrent_runs` — override the global default for maximum concurrent runs. NO token limits, NO per-user run limits. Users can run as many runs as system resources allow within their concurrent run limit.

### 6. Row-level security enforced at Drizzle query layer

Consistent with ADR-014, every database query is scoped by `user_id`. Users can only see their own threads, messages, runs, and settings. Admins can see all data. This is enforced at the Drizzle query layer, not just at the API level.

### 7. Bootstrap CLI command creates first admin user

A CLI command (e.g., `ants bootstrap`) creates the first admin user. This is the entry point for a fresh installation — without at least one admin, no invite codes can be generated, no users can be created. The bootstrap command prompts for email and password, creates the admin user, and outputs an initial API key for immediate API access.

## Alternatives Considered

### OAuth 2.0
- **Pros**: Industry standard, supports third-party login, token refresh, scopes.
- **Cons**: Requires an external identity provider (Google, GitHub, etc.) — violates offline-first constraint. Self-hosted OAuth server adds significant complexity.

### Session-based auth
- **Pros**: Server-side session storage, easy invalidation, familiar pattern.
- **Cons**: Requires server-side session state (database or in-memory), harder to use for API access, adds complexity for a stateless API-first system.

### Open registration
- **Pros**: Lower friction for new users, no admin bottleneck.
- **Cons**: Security risk for a locally-deployed system. Anyone with network access could create an account. Invite-only ensures only authorized users can access the system.

### Per-user rate/token limits
- **Pros**: Prevents individual users from monopolizing resources.
- **Cons**: Unnecessary complexity for v1. The system is single-machine, running local inference. `max_concurrent_runs` per user is sufficient. Token budgets and per-user run limits can be added later if needed.

## Consequences

**Positive:**
- Full user identity model enables interactive sessions, user settings, and admin controls.
- Two auth mechanisms (JWT + API keys) cover both interactive and programmatic use cases.
- Invite-only registration prevents unauthorized access on locally-deployed systems.
- Two roles (user, admin) are simple to implement, test, and reason about.
- Per-user settings (model override, max concurrent runs) give users control without global config changes.
- Row-level security at the query layer ensures complete data isolation, consistent with ADR-014.
- Bootstrap CLI provides a clear entry point for fresh installations.

**Negative:**
- Two auth mechanisms (JWT + API keys) means two code paths to implement, test, and maintain.
- Invite-only registration adds admin overhead for onboarding new users.
- No fine-grained permissions in v1 — the user/admin binary may be too coarse for some deployments.
- JWT 24-hour expiry requires re-authentication for long-running sessions.
- bcrypt hashing adds CPU cost on login (mitigated: cost factor 12 is reasonable for single-machine deployment).
- No password reset flow in v1 — admins must reset passwords directly.