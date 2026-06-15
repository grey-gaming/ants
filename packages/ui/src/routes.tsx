import { createRouter, createRootRouteWithContext, createRoute, Outlet } from '@tanstack/react-router'
import type { QueryClient } from '@tanstack/react-query'
import { queryClient } from '@/lib/query-client'
import { AppShell } from '@/components/layout/app-shell'
import { LoginPage } from '@/components/layout/auth-guard'
import { DashboardPage } from '@/routes/index'
import { ThreadsPage } from '@/routes/threads/index'
import { ThreadDetailPage } from '@/routes/threads/$threadId'
import { AgentsPage } from '@/routes/agents/index'
import { AgentDetailPage } from '@/routes/agents/$agentId'
import { SettingsPage } from '@/routes/settings'

// Root route with query client context
const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()()

// Layout route that wraps all authenticated pages
function Layout() {
  return (
    <AppShell>
      <Outlet />
    </AppShell>
  )
}

const layoutRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'layout',
  component: Layout,
})

// Dashboard route
const indexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/',
  component: DashboardPage,
})

// Threads index route
const threadsIndexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/threads',
  component: ThreadsPage,
})

// Thread detail route
const threadDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/threads/$threadId',
  component: ThreadDetailPage,
})

// Agents index route
const agentsIndexRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/agents',
  component: AgentsPage,
})

// Agent detail route
const agentDetailRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/agents/$agentId',
  component: AgentDetailPage,
})

// Settings route
const settingsRoute = createRoute({
  getParentRoute: () => layoutRoute,
  path: '/settings',
  component: SettingsPage,
})

// Login route (outside layout)
const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

// Create route tree
const routeTree = rootRoute.addChildren([
  layoutRoute.addChildren([
    indexRoute,
    threadsIndexRoute,
    threadDetailRoute,
    agentsIndexRoute,
    agentDetailRoute,
    settingsRoute,
  ]),
  loginRoute,
])

// Create router
export const router = createRouter({
  routeTree,
  context: {
    queryClient,
  },
  defaultPreload: 'intent',
})

// Type registration
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
