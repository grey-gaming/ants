import { Link, useParams } from "@tanstack/react-router";
import { ArrowLeft, Edit, Loader2, Trash2, Wrench } from "lucide-react";
import { AgentAvatar } from "@/components/ants/agent-avatar";
import { AgentStatusIndicator } from "@/components/ants/agent-status";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mapAgentStatus, useAgent } from "@/hooks/api";

export function AgentDetailPage() {
	const { agentId } = useParams({ from: "/layout/agents/$agentId" });
	const { data: agent, isLoading } = useAgent(agentId);

	if (isLoading) {
		return (
			<div className="flex items-center justify-center py-20">
				<Loader2 className="h-8 w-8 animate-spin text-accent" />
			</div>
		);
	}

	if (!agent) {
		return (
			<div className="flex flex-col items-center justify-center py-20">
				<p className="text-text-tertiary">Agent not found</p>
				<Link to="/settings">
					<Button variant="ghost" className="mt-4">
						Back to Settings
					</Button>
				</Link>
			</div>
		);
	}

	return (
		<div className="space-y-6">
			<div className="flex items-center justify-between">
				<div className="flex items-center gap-4">
					<Link to="/settings">
						<Button variant="ghost" size="icon">
							<ArrowLeft className="h-5 w-5" />
						</Button>
					</Link>
					<div className="flex items-center gap-3">
						<AgentAvatar
							name={agent.name}
							tier={agent.tier}
							status={mapAgentStatus(agent.status)}
							size="lg"
						/>
						<div>
							<h1 className="text-heading-lg text-text-primary">
								{agent.name}
							</h1>
							<div className="flex items-center gap-2 mt-1">
								<Badge variant="secondary">
									{agent.tier.toUpperCase()} Specialist
								</Badge>
								<AgentStatusIndicator
									status={mapAgentStatus(agent.status)}
									label={agent.status}
								/>
							</div>
						</div>
					</div>
				</div>
				<div className="flex items-center gap-2">
					<Button variant="outline" size="sm" disabled>
						<Edit className="mr-2 h-4 w-4" />
						Edit
					</Button>
					<Button variant="outline" size="sm" disabled>
						<Trash2 className="mr-2 h-4 w-4" />
						Delete
					</Button>
				</div>
			</div>

			<Tabs defaultValue="overview" className="space-y-4">
				<TabsList>
					<TabsTrigger value="overview">Overview</TabsTrigger>
					<TabsTrigger value="config">Configuration</TabsTrigger>
					<TabsTrigger value="tools">Tools</TabsTrigger>
					<TabsTrigger value="runs">Recent Runs</TabsTrigger>
				</TabsList>

				<TabsContent value="overview">
					<Card>
						<CardHeader>
							<CardTitle className="text-heading-md">Description</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-body text-text-secondary">
								{agent.description}
							</p>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="config">
					<Card>
						<CardHeader>
							<CardTitle className="text-heading-md">Configuration</CardTitle>
						</CardHeader>
						<CardContent className="space-y-4">
							<div>
								<label className="mb-2 block text-body-sm font-medium text-text-secondary">
									Model
								</label>
								<p className="text-sm text-text-primary">{agent.model}</p>
							</div>
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="tools">
					<Card>
						<CardHeader>
							<CardTitle className="text-heading-md">Enabled Tools</CardTitle>
						</CardHeader>
						<CardContent className="space-y-3">
							{agent.tools.length === 0 && (
								<p className="text-sm text-text-tertiary">No tools assigned.</p>
							)}
							{agent.tools.map((tool) => (
								<div
									key={tool}
									className="flex items-center justify-between rounded-md border border-border p-3"
								>
									<div className="flex items-center gap-3">
										<Wrench className="h-4 w-4 text-text-tertiary" />
										<span className="text-sm text-text-primary capitalize">
											{tool.replace("_", " ")}
										</span>
									</div>
									<Badge variant="secondary">Active</Badge>
								</div>
							))}
						</CardContent>
					</Card>
				</TabsContent>

				<TabsContent value="runs">
					<Card>
						<CardHeader>
							<CardTitle className="text-heading-md">Recent Runs</CardTitle>
						</CardHeader>
						<CardContent>
							<p className="text-sm text-text-tertiary">
								Run history will appear here when runs are completed.
							</p>
						</CardContent>
					</Card>
				</TabsContent>
			</Tabs>
		</div>
	);
}
