# ADR-024: Session-Based Cookie Authentication

- **Status**: Accepted
- **Date**: 2026-06-15
- **Supersedes**: ADR-014 (Multi-user Auth with API Keys), ADR-022 (User Model and Authentication)

## Context

ADR-014 established API key authentication. ADR-022 added email/password login with JWT sessions alongside API keys. Two auth mechanisms proved unnecessary for a local-first system with a browser UI. This ADR simplifies to a single auth mechanism: HTTP-only cookie sessions.

The ANTS UI is now a web application (React/Vite) served alongside the API. Browser-based authentication benefits from cookie-based sessions — no need for manual token management, localStorage, or Bearer headers.

## Decision

### 1. Email/password login with bcrypt hashing

Users authenticate with email and password. Passwords hashed with bcrypt at cost factor 12. Email is the unique identifier.

### 2. HTTP-only cookie sessions (7-day expiry)

On successful login, a random 32-byte hex session token is created and stored in the `sessions` DB table. It's returned as an HttpOnly cookie named `ants_session`. The browser automatically sends the cookie with every request to the same origin.

Cookie configuration: `ants_session=<token>; Path=/; HttpOnly; SameSite=Lax; Max-Age=604800`

### 3. Server-side session validation

On every authenticated request, the middleware reads the cookie, looks up the session in the DB, verifies expiry, and sets userId on the Hono context. Expired sessions are cleaned up.

### 4. No API keys, no JWT

API keys removed — all auth is via cookie sessions. Programmatic API consumers can login via POST /v1/auth/login and store the returned cookie.

JWT removed — server-side sessions enable instant revocation, no clock skew issues, simpler implementation.

### 5. Auth endpoints

- POST /v1/auth/register — Register with email/password/invite code
- POST /v1/auth/login — Login, returns session cookie
- POST /v1/auth/logout — Destroy session, clear cookie
- GET /v1/auth/me — Return current user info

### 6. First user bootstrap

scripts/setup-first-user.ts creates the first admin user when the DB is empty. Accepts env vars SETUP_EMAIL, SETUP_NAME, SETUP_PASSWORD.

### 7. Row-level security unchanged

Every query scoped by user_id at the Drizzle layer. Consistent with ADR-014.

## Alternatives Considered

### API Keys + Cookies (previous approach)
- **Cons**: Two auth code paths to maintain. API keys unnecessary for browser UI. Programmatic access can use the same login endpoint.

### JWT Stateless Sessions (ADR-022)
- **Cons**: Cannot revoke tokens before expiry. Clock skew issues. Larger payloads. No advantage for a local-first system.

## Consequences

**Positive:**
- Single auth mechanism — simpler to implement, test, and maintain.
- Browser-native cookie flow — no localStorage, no manual token passing.
- Instant session revocation on logout or password change.
- HttpOnly cookie — immune to XSS theft.
- SameSite=Lax — CSRF protection for same-origin requests.

**Negative:**
- Server-side session storage — requires DB lookup on every request (negligible for local deployment).
- No stateless auth — programmatic consumers must store cookies instead of tokens.
- Session table grows — no automatic cleanup yet (acceptable for local use).
