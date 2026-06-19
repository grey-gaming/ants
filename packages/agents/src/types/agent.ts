import type { Message } from "@ants/llm";
import type { Tool } from "@ants/tools";

export interface AgentResult {
	content: string;
	metadata: Record<string, unknown>;
	tokensUsed: number;
}

export interface AgentDefinition {
	name: string;
	description: string;
}

export interface Agent {
	name: string;
	description: string;
	run(messages: Message[], tools: Tool[]): Promise<AgentResult>;
}
