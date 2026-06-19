import { Link } from "@tanstack/react-router";
import { Loader2, Terminal } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAgents, useRuns } from "@/hooks/api";
import { formatDuration, formatTokens } from "@/lib/utils";

type StatusVariant = "default" | "secondary" | "destructive" | "outline";

const STATUS_VARIANTS: Record<string, StatusVariant> = {
	queued: "secondary",
	running: "default",
	complete: "default",
	error: "destructive",
	cancelled: "secondary",
};

const STATUS_LABELS: Record<string, string> = {
	queued: "Queued",
	running: "Running",
	complete: "Complete",
	error: "Error",
	cancelled: "Cancelled",
};

export function RunsPage() {
	const { data: runsData, isLoading } = useRuns();
	const { data: agents } = useAgents();

	const runs = runsData?.data ?? [];
	const agentsMap = new Map(agents?.map((a) => [a.id, a.name]) ?? []);

	const statusBadge = (status: string) => {
		const variant = STATUS_VARIANTS[status] ?? "secondary";
		const label = STATUS_LABELS[status] ?? status;
		return (
			<Badge variant={variant}>{label}</Badge>
		);
	};

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2 className="h-8 w-8 animate-spin text-accent" />
			</div>
		);
	}

	return (
		<div className="space-y-6">
			{/* Header */}
			<div>
				<h1 className="text-heading-lg text-text-primary">Runs History</h1>
				<p className="text-body text-text-secondary mt-1">
					View and track all agent run executions across threads.
				</p>
			</div>

			<Card>
				<CardHeader>
					<CardTitle className="text-heading-md">All Runs</CardTitle>
				</CardHeader>
				<CardContent>
					{runs.length === 0 ? (
						<div className="flex flex-col items-center justify-center py-12">
							<Terminal className="mb-3 h-10 w-10 text-text-tertiary" />
							<p className="text-sm text-text-secondary">No runs yet.</p>
							<p className="text-xs text-text-tertiary mt-1">
								Start a thread to create your first run.
							</p>
						</div>
					) : (
						<div className="overflow-x-auto">
							<table className="w-full text-left">
								<thead>
									<tr className="border-b border-border">
										<th className="pb-3 pr-4 text-xs font-medium text-text-secondary">
											Status
										</th>
										<th className="pb-3 pr-4 text-xs font-medium text-text-secondary">
											Thread
										</th>
										<th className="pb-3 pr-4 text-xs font-medium text-text-secondary">
											Agent
										</th>
										<th className="pb-3 pr-4 text-xs font-medium text-text-secondary">
											Duration
										</th>
										<th className="pb-3 pr-4 text-xs font-medium text-text-secondary">
											Tokens
										</th>
										<th className="pb-3 text-xs font-medium text-text-secondary">
											Date
										</th>
									</tr>
								</thead>
								<tbody className="divide-y divide-border">
									{runs.map((run) => (
										<tr
											key={run.id}
											className="transition-colors hover:bg-surface-2"
										>
											<td className="py-3 pr-4">
												{statusBadge(run.status)}
											</td>
											<td className="py-3 pr-4">
												<Link
													to="/threads/$threadId"
													params={{ threadId: run.threadId }}
													className="text-sm text-accent hover:underline"
												>
													{run.threadId.slice(0, 8)}...
												</Link>
											</td>
											<td className="py-3 pr-4">
												<Link
													to="/agents/$agentId"
													params={{ agentId: run.agentTypeId }}
													className="text-sm text-accent hover:underline"
												>
													{agentsMap.get(run.agentTypeId) ?? run.agentTypeId}
												</Link>
											</td>
											<td className="py-3 pr-4">
												<span className="text-sm text-text-primary">
													{formatDuration(run.duration)}
												</span>
											</td>
											<td className="py-3 pr-4">
												<span className="text-sm text-text-primary">
													{formatTokens(run.inputTokens + run.outputTokens)}
												</span>
											</td>
											<td className="py-3">
												<span className="text-sm text-text-secondary">
													{new Date(run.startedAt).toLocaleDateString()}
												</span>
											</td>
										</tr>
									))}
								</tbody>
							</table>
						</div>
					)}
				</CardContent>
			</Card>
		</div>
	);
}
