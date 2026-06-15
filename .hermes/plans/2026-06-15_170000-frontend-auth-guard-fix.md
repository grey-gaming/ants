# Frontend Auth Guard Fix

> **For Hermes:** Use subagent-driven-development skill to implement this plan task-by-task.

**Goal:** Ensure unauthenticated users are always redirected to `/login` — fix the missing auth check in the UI router.

**Architecture:** Add a `beforeLoad` hook to the layout route to block all authenticated routes at the TanStack Router level. Fix the existing `AuthGuard` HOC (wrong `useState` → `useEffect`) for use as a defensive component wrapper.

**Tech Stack:** React 19, TanStack Router, Bun.

---

## Problem

The `routes.tsx` renders `AppShell` → `Outlet` for all authenticated routes (`/`, `/threads`, `/agents/$agentId`, `/settings`) with **zero authentication checks**. The `AuthGuard` HOC in `auth-guard.tsx` exists but is:
1. Never applied to any route
2. Bug: uses `useState(() => { checkAuth() })` instead of `useEffect` — fires on every render instead of mount

## Files Affected

- `packages/ui/src/routes.tsx` — add `beforeLoad` hook to layout route
- `packages/ui/src/components/layout/auth-guard.tsx` — fix `useState` → `useEffect`, suppress return-type errors
- (No new files needed)

---

### Task 1: Add `beforeLoad` hook to layout route

**Objective:** Block unauthenticated navigation at the router level before any component renders.

**Files:**
- Modify: `packages/ui/src/routes.tsx`

**Step 1: Add `beforeLoad` to layout route**

After the layout route definition (after line 28), add an auth check function and attach it to the layout route:

```typescript
// Auth check function used by beforeLoad
async function checkAuth(): Promise<void> {
  try {
    const API_BASE = '/v1'
    const response = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'same-origin',
    })
    if (!response.ok) {
      throw new Error('Not authenticated')
    }
  } catch {
    throw new RedirectException('/login')
  }
}
```

Wait — TanStack Router doesn't export `RedirectException` directly. The standard approach is to use `createFileRoute` or the `beforeLoad` return value. Let me use the simpler approach:

Since the layout route is defined with `createRoute` (not `createFileRoute`), we need to use the `beforeLoad` property. TanStack Router throws a `Redirect` object internally. The cleanest pattern:

```typescript
// Create route tree
const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    // ... routes
  ]),
  loginRoute.withOptions({
    beforeLoad: () => {
      // Already on login — nothing to check
    },
  }),
])
```

But `beforeLoad` on the layout needs to reject unauthenticated users. The TanStack Router way to redirect from `beforeLoad` on a route created with `createRoute`:

```typescript
import { redirect } from '@tanstack/react-router'

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: Layout,
  beforeLoad: async () => {
    try {
      const response = await fetch('/v1/auth/me', {
        credentials: 'same-origin',
      })
      if (!response.ok) {
        throw redirect({ to: '/login' })
      }
    } catch (err) {
      if (err instanceof Error && (err as any)?.redirect) {
        throw err
      }
      throw redirect({ to: '/login' })
    }
  },
})
```

Actually, let me look at how TanStack Router v1 handles this more carefully. The `redirect` export works with `createRoute` via `beforeLoad`. Here's the correct pattern:

**Complete Step 1: Update routes.tsx**

Add import for `redirect`:

```typescript
import { createRouter, createRootRouteWithContext, createRoute, Outlet, redirect } from '@tanstack/react-router'
```

Add `beforeLoad` to the layout route:

```typescript
const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: Layout,
  beforeLoad: async () => {
    try {
      const res = await fetch('/v1/auth/me', { credentials: 'same-origin' })
      if (!res.ok) {
        throw new Error('unauthenticated')
      }
    } catch {
      throw redirect({ to: '/login' })
    }
  },
})
```

**Step 2: Run typecheck**

```bash
cd /Users/ishmael/Projects/ants && bun run typecheck
```

**Step 3: Commit**

```bash
git add packages/ui/src/routes.tsx
git commit -m "fix(ui): add beforeLoad auth check to layout route"
```

---

### Task 2: Fix AuthGuard HOC (useState → useEffect)

**Objective:** Fix the AuthGuard HOC so it properly runs the auth check on mount instead of every render.

**Files:**
- Modify: `packages/ui/src/components/layout/auth-guard.tsx`

**Step 1: Replace useState with useEffect**

Change line 10-12 from:

```typescript
useState(() => {
  checkAuth()
})
```

To:

```typescript
useEffect(() => {
  checkAuth()
}, [])
```

And add `useEffect` to the import (line 1):

```typescript
import { useState, useEffect } from 'react'
```

**Step 2: Suppress type errors from incorrect AuthGuard usage**

The `AuthGuard` HOC returns a component that includes `checking` state, but the original definition has typing issues when used with React Router. The `useState` call on line 8 creates state inside the returned component, but React's rules of hooks complain because it's inside a function. The fix above makes it work correctly with `useEffect`.

Additionally, the `LoginPage` export on line 37 has typing issues because `useNavigate` may not resolve. These were pre-existing issues — the fix in this task focuses on the `useState` → `useEffect` change.

**Step 3: Run typecheck**

```bash
cd /Users/ishmael/Projects/ants && bun run typecheck
```

**Step 4: Commit**

```bash
git add packages/ui/src/components/layout/auth-guard.tsx
git commit -m "fix(ui): fix AuthGuard HOC — use useEffect instead of useState initializer"
```

---

## Risks and Tradeoffs

1. **`beforeLoad` fires on every navigation through layout** — this is desired behavior. It catches: direct URL entry, browser refresh, and SPA navigation. Each check is a lightweight `GET /v1/auth/me` request.

2. **Network dependency** — if the backend is unreachable, users get redirected to `/login`. This is acceptable behavior (can't verify auth → assume unauthenticated).

3. **Duplicate auth checks** — the `beforeLoad` checks auth, and the `AuthGuard` HOC also checks auth. The `AuthGuard` is kept as a defensive wrapper for component-level auth (e.g., if someone uses `AuthGuard(SomeComponent)` directly). It's acceptable to have both for defense-in-depth.

4. **`redirect` import** — TanStack Router's `redirect` is the canonical way to redirect from `beforeLoad`. If the project uses a specific TanStack Router version that handles this differently, the implementer should verify.

## Verification

1. **Open browser to `/` without being logged in** — should redirect to `/login`
2. **Open browser to `/threads` without being logged in** — should redirect to `/login`
3. **Open browser to `/settings` without being logged in** — should redirect to `/login`
4. **Log in, then navigate to `/`** — should show the dashboard
5. **Log out, then try to access `/` directly** — should redirect to `/login`
6. **`bun run typecheck`** — should pass with no errors
