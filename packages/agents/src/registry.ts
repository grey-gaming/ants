// ---------------------------------------------------------------------------
// Agent registry — singleton that holds agent type metadata
// ---------------------------------------------------------------------------

// Agent tiers: T1 = orchestrator, T2 = specialist, T3 = task agent
export type AgentTier = "T1" | "T2" | "T3";

interface AgentTypeMetadata {
	name: string;
	tier: AgentTier;
	description: string;
	// Optional: default model config for this agent type
	defaultModelConfig?: Record<string, unknown>;
	// Optional: capabilities this agent supports
	defaultCapabilities?: Record<string, unknown>;
	// Tool names that this agent should have access to (resolved to UUIDs at startup)
	toolNames?: string[];
}

const agents = new Map<string, AgentTypeMetadata>();

function register(metadata: AgentTypeMetadata): void {
	if (agents.has(metadata.name)) {
		throw new Error(`Agent "${metadata.name}" is already registered`);
	}
	agents.set(metadata.name, metadata);
}

function get(name: string): AgentTypeMetadata | undefined {
	return agents.get(name);
}

function getAll(): AgentTypeMetadata[] {
	return Array.from(agents.values());
}

function has(name: string): boolean {
	return agents.has(name);
}

// ─── Auto-register known agent types on module load ───────────────────────
// Note: toolNames is resolved to toolIds by the discovery service at startup.

register({
	name: "orchestrator",
	tier: "T1",
	description: "Orchestrator agent that delegates tasks to specialist agents",
	defaultModelConfig: {},
	defaultCapabilities: { delegation: true, planning: true },
	toolNames: [],
});

register({
	name: "researcher",
	tier: "T3",
	description:
		"Research agent that performs web searches and summarizes results",
	defaultModelConfig: {},
	defaultCapabilities: { webSearch: true, summarization: true },
	toolNames: ["web-search"],
});

export const agentRegistry = {
	register,
	get,
	getAll,
	has,
};
