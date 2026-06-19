import { agentTypes, tools } from "@ants/store";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { logger } from "../index";

// ---------------------------------------------------------------------------
// Discovery service — auto-registers tools and agents from code registries
// into the database on startup. Uses INSERT ... ON CONFLICT DO NOTHING so
// it's idempotent: running again is safe and skips already-registered entries.
// ---------------------------------------------------------------------------

interface DiscoveryResult {
	toolsRegistered: string[];
	toolsSkipped: string[];
	agentsRegistered: string[];
	agentsSkipped: string[];
}

interface ToolDiscoveryEntry {
	name: string;
	description: string;
	type: "function" | "builtin";
	parametersSchema?: Record<string, unknown> | null;
}

interface AgentDiscoveryEntry {
	name: string;
	tier: "T1" | "T2" | "T3";
	description: string;
	modelConfig?: Record<string, unknown> | null;
	capabilities?: Record<string, unknown> | null;
	// Tool names to resolve to UUIDs after tools are registered
	toolNames?: string[] | null;
}

export async function discoverAndRegister(
	db: PostgresJsDatabase,
	toolEntries: ToolDiscoveryEntry[],
	agentEntries: AgentDiscoveryEntry[],
): Promise<DiscoveryResult> {
	const result: DiscoveryResult = {
		toolsRegistered: [],
		toolsSkipped: [],
		agentsRegistered: [],
		agentsSkipped: [],
	};

	// ─── Tools ──────────────────────────────────────────────────────────────
	for (const entry of toolEntries) {
		const existing = await db
			.select({ id: tools.id })
			.from(tools)
			.where(eq(tools.name, entry.name))
			.limit(1);

		if (existing.length > 0) {
			logger.info(
				"discovery",
				`Tool "${entry.name}" already registered — skipping`,
			);
			result.toolsSkipped.push(entry.name);
			continue;
		}

		try {
			await db.insert(tools).values({
				name: entry.name,
				description: entry.description,
				type: entry.type,
				parametersSchema: entry.parametersSchema ?? null,
				active: true,
			});
			logger.info("discovery", `Registered tool: ${entry.name}`);
			result.toolsRegistered.push(entry.name);
		} catch (err) {
			logger.warn(
				"discovery",
				`Failed to register tool "${entry.name}": ${err instanceof Error ? err.message : String(err)}`,
			);
			result.toolsSkipped.push(entry.name);
		}
	}

	// ─── Agents ─────────────────────────────────────────────────────────────
	for (const entry of agentEntries) {
		const existing = await db
			.select({ id: agentTypes.id })
			.from(agentTypes)
			.where(eq(agentTypes.name, entry.name))
			.limit(1);

		if (existing.length > 0) {
			logger.info(
				"discovery",
				`Agent "${entry.name}" already registered — skipping`,
			);
			result.agentsSkipped.push(entry.name);
			continue;
		}

		// Resolve tool names to UUIDs
		let toolIds: string[] | null = null;
		if (entry.toolNames && entry.toolNames.length > 0) {
			const toolRows = await db
				.select({ id: tools.id, name: tools.name })
				.from(tools)
				.where(eq(tools.active, true));

			toolIds = entry.toolNames
				.map((name) => toolRows.find((t) => t.name === name)?.id)
				.filter((id): id is string => id !== undefined);

			if (toolIds.length < entry.toolNames.length) {
				const missing = entry.toolNames.filter(
					(n) => !toolRows.some((t) => t.name === n),
				);
				logger.warn(
					"discovery",
					`Agent "${entry.name}" references missing tools: ${missing.join(", ")}`,
				);
			}
		}

		try {
			await db.insert(agentTypes).values({
				name: entry.name,
				tier: entry.tier,
				description: entry.description,
				modelConfig: entry.modelConfig ?? null,
				capabilities: entry.capabilities ?? null,
				toolIds,
				active: true,
			});
			logger.info(
				"discovery",
				`Registered agent: ${entry.name} (${entry.tier})`,
			);
			result.agentsRegistered.push(entry.name);
		} catch (err) {
			logger.warn(
				"discovery",
				`Failed to register agent "${entry.name}": ${err instanceof Error ? err.message : String(err)}`,
			);
			result.agentsSkipped.push(entry.name);
		}
	}

	return result;
}
