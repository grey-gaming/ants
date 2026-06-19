import { Link } from "@tanstack/react-router";
import {
	Activity,
	AlertCircle,
	ArrowUpRight,
	Bot,
	Loader2,
	MessageSquare,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgents, useCreateThread, useThreads } from "@/hooks/api";

export function DashboardPage() {
	const { data: threads, isLoading: threadsLoading } = useThreads();
	const { data: agents, isLoading: agentsLoading } = useAgents();
	const createThread = useCreateThread();

	const loading = threadsLoading || agentsLoading;

	// Compute stats from real data
	const threadCount = threads?.length ?? 0;
	const agentsOnline = agents?.filter((a) => a.status === "active").length ?? 0;
	const agentsTotal = agents?.length ?? 0;
	const activeRuns = threads?.filter((t) => t.activeRunId).length ?? 0;
	const errors = 0; // Error count would come from run status data

	// Recent threads sorted by updatedAt
	const recentThreads = [...(threads ?? [])]
		.sort(
			(a, b) =>
				new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime(),
		)
		.slice(0, 5);

	const formatTime = (dateStr: string) => {
		const diff = Date.now() - new Date(dateStr).getTime();
		const mins = Math.floor(diff / 60000);
		if (mins < 1) return "just now";
		if (mins < 60) return `${mins}m ago`;
		const hours = Math.floor(mins / 60);
		return `${hours}h ago`;
	};

	return (
		<div className="space-y-6">
			{/* Header */}
			<div className="flex items-center justify-between">
				<h1 className="text-heading-lg text-text-primary">Dashboard</h1>
				<Button size="sm" onClick={() => createThread.mutate(undefined)}>
					<ArrowUpRight className="mr-2 h-4 w-4" />
					New Thread
				</Button>
			</div>

			{loading ? (
				<div className="flex items-center justify-center py-20">
					<Loader2 className="h-6 w-6 animate-spin text-accent" />
				</div>
			) : (
				<>
					{/* Stats grid */}
					<div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
						<StatCard
							label="Active Runs"
							value={activeRuns}
							icon={Activity}
							color="text-info"
						/>
						<StatCard
							label="Threads"
							value={threadCount}
							icon={MessageSquare}
							color="text-accent"
						/>
						<StatCard
							label="Agents Online"
							value={`${agentsOnline}/${agentsTotal}`}
							icon={Bot}
							color="text-success"
						/>
						<StatCard
							label="Errors"
							value={errors}
							icon={AlertCircle}
							color="text-error"
						/>
					</div>

					{/* Recent activity */}
					<div className="grid gap-6 lg:grid-cols-2">
						<Card>
							<CardHeader>
								<CardTitle className="text-heading-md">
									Recent Activity
								</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{recentThreads.length === 0 && (
									<p className="text-sm text-text-tertiary">
										No threads yet. Create one to get started.
									</p>
								)}
								{recentThreads.map((thread) => (
									<Link
										key={thread.id}
										to="/threads/$threadId"
										params={{ threadId: thread.id }}
										className="flex items-center gap-3 rounded-md p-3 transition-colors hover:bg-surface-2"
									>
										<div
											className={cn(
												"h-2 w-2 rounded-full",
												thread.activeRunId
													? "bg-warning animate-pulse"
													: "bg-text-tertiary",
											)}
										/>
										<div className="flex-1 min-w-0">
											<p className="text-sm font-medium text-text-primary truncate">
												{thread.title}
											</p>
											<p className="text-xs text-text-tertiary">
												{formatTime(thread.updatedAt)}
											</p>
										</div>
										<Badge
											variant={thread.activeRunId ? "default" : "secondary"}
										>
											{thread.activeRunId ? "Running" : "Idle"}
										</Badge>
									</Link>
								))}
							</CardContent>
						</Card>

						<Card>
							<CardHeader>
								<CardTitle className="text-heading-md">Agent Fleet</CardTitle>
							</CardHeader>
							<CardContent className="space-y-3">
								{agents?.map((agent) => (
									<AgentStatusCard
										key={agent.id}
										name={agent.name}
										tier={agent.tier}
										status={agent.status}
									/>
								))}
								{!agents?.length && (
									<p className="text-sm text-text-tertiary">
										No agents registered.
									</p>
								)}
							</CardContent>
						</Card>
					</div>
				</>
			)}
		</div>
	);
}

function StatCard({
	label,
	value,
	icon: Icon,
	color,
}: {
	label: string;
	value: string | number;
	icon: React.ElementType;
	color: string;
}) {
	return (
		<Card>
			<CardContent className="p-4">
				<div className="flex items-center gap-3">
					<Icon className={cn("h-5 w-5", color)} />
					<div>
						<p className="text-2xl font-bold text-text-primary">{value}</p>
						<p className="text-xs text-text-secondary">{label}</p>
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function AgentStatusCard({
	name,
	tier,
	status,
}: {
	name: string;
	tier: "t1" | "t2" | "t3";
	status: string;
}) {
	return (
		<div className="flex items-center gap-3 rounded-md border border-border p-3">
			<div
				className={cn(
					"h-3 w-3 rounded-full",
					tier === "t1" && "bg-agent-t1",
					tier === "t2" && "bg-agent-t2",
					tier === "t3" && "bg-agent-t3",
				)}
			/>
			<div className="flex-1">
				<p className="text-sm font-medium text-text-primary">{name}</p>
				<p className="text-xs text-text-tertiary capitalize">{status}</p>
			</div>
		</div>
	);
}

function cn(...classes: (string | boolean | undefined)[]) {
	return classes.filter(Boolean).join(" ");
}
