import type { QueryClient } from "@tanstack/react-query";
import {
	createRootRouteWithContext,
	createRoute,
	createRouter,
	Outlet,
	redirect,
} from "@tanstack/react-router";
import { AppShell } from "@/components/layout/app-shell";
import { LoginPage } from "@/components/layout/auth-guard";
import { queryClient } from "@/lib/query-client";
import { AgentDetailPage } from "@/routes/agents/$agentId";
import { DashboardPage } from "@/routes/index";
import { SettingsPage } from "@/routes/settings";
import { RunsPage } from "@/routes/runs";
import { ThreadDetailPage } from "@/routes/threads/$threadId";
import { ThreadsPage } from "@/routes/threads/index";

// Root route with query client context
const rootRoute = createRootRouteWithContext<{ queryClient: QueryClient }>()();

// Layout route that wraps all authenticated pages
function Layout() {
	return (
		<AppShell>
			<Outlet />
		</AppShell>
	);
}

const layoutRoute = createRoute({
	getParentRoute: () => rootRoute,
	id: "layout",
	component: Layout,
	beforeLoad: async () => {
		try {
			const res = await fetch("/v1/auth/me", { credentials: "same-origin" });
			if (!res.ok) {
				throw new Error("unauthenticated");
			}
		} catch {
			console.error("Auth check failed, redirecting to login");
			throw redirect({ to: "/login" });
		}
	},
});

// Dashboard route
const indexRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/",
	component: DashboardPage,
});

// Threads index route
const threadsIndexRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/threads",
	component: ThreadsPage,
});

// Thread detail route
const threadDetailRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/threads/$threadId",
	component: ThreadDetailPage,
});

// Agent detail route
const agentDetailRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/agents/$agentId",
	component: AgentDetailPage,
});

// Settings route
const settingsRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/settings",
	component: SettingsPage,
});

// Runs route
const runsRoute = createRoute({
	getParentRoute: () => layoutRoute,
	path: "/runs",
	component: RunsPage,
});

// Login route (outside layout)
const loginRoute = createRoute({
	getParentRoute: () => rootRoute,
	path: "/login",
	component: LoginPage,
});

// Create route tree
const routeTree = rootRoute.addChildren([
	layoutRoute.addChildren([
		indexRoute,
		threadsIndexRoute,
		threadDetailRoute,
		runsRoute,
		agentDetailRoute,
		settingsRoute,
	]),
	loginRoute,
]);

// Create router
export const router = createRouter({
	routeTree,
	context: {
		queryClient,
	},
	defaultPreload: "intent",
});

// Type registration
declare module "@tanstack/react-router" {
	interface Register {
		router: typeof router;
	}
}
