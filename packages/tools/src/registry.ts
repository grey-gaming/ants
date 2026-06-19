import { BaseTool } from "./tools/base-tool";
import { Calculator } from "./tools/calculator";
import { CodeExecution } from "./tools/code-execution";
import { FileReadWrite } from "./tools/file-read-write";
import { ImageGeneration } from "./tools/image-generation";
import { MemoryVector } from "./tools/memory-vector";
import { ShellCommand } from "./tools/shell-command";
import { SqlQuery } from "./tools/sql-query";
import { TimeDate } from "./tools/time-date";
import { Weather } from "./tools/weather";
import { WebScraping } from "./tools/web-scraping";
import { WebSearch } from "./tools/web-search";
import type { Tool, ToolDefinition, ToolResult } from "./types/tool";

// ---------------------------------------------------------------------------
// Tool registry — singleton that holds all instantiated tools
// ---------------------------------------------------------------------------

interface RegistryEntry {
	instance: Tool;
	definition: ToolDefinition;
	parameters: any;
}

const tools = new Map<string, RegistryEntry>();

// Auto-register on module load
function registerTool(instance: any) {
	tools.set(instance.name, {
		instance,
		definition: {
			name: instance.name,
			description: instance.description,
			parameters: instance.parameters,
		},
		parameters: instance.parameters,
	});
}

registerTool(new WebSearch());
registerTool(new Calculator());
registerTool(new TimeDate());
registerTool(new FileReadWrite());
registerTool(new ShellCommand());
registerTool(new CodeExecution());
registerTool(new WebScraping());
registerTool(new MemoryVector());
registerTool(new SqlQuery());
registerTool(new Weather());
registerTool(new ImageGeneration());

function get(name: string): RegistryEntry | undefined {
	return tools.get(name);
}

function getAll(): RegistryEntry[] {
	return Array.from(tools.values());
}

function has(name: string): boolean {
	return tools.has(name);
}

async function execute(name: string, input: unknown): Promise<ToolResult> {
	const entry = tools.get(name);
	if (!entry) {
		return { success: false, error: `Unknown tool: ${name}` };
	}
	return entry.instance.execute(input);
}

// Zod schema → JSON Schema for DB storage
function zodToJsonSchema(schema: any): Record<string, unknown> {
	try {
		const shape = (schema as any).shape;
		if (typeof shape !== "object" || shape === null) {
			return { type: "object" };
		}
		const properties: Record<string, unknown> = {};
		const required: string[] = [];
		const keys = Object.keys(shape);
		for (const key of keys) {
			const field = shape[key];
			properties[key] = zodToJsonProperty(field);
			// In Zod v4, optional fields have _def.type === "optional" or isOptional getter
			const isOptional =
				field._def?.type === "optional" ||
				field._zod?.def?.type === "optional" ||
				field.isOptional === true;
			if (!isOptional) {
				required.push(key);
			}
		}
		return {
			type: "object",
			properties,
			required: required.length > 0 ? required : undefined,
		};
	} catch {
		return { type: "object" };
	}
}

function zodToJsonProperty(field: any): Record<string, unknown> {
	// Get the actual type from Zod v4 internal structure
	// Check _def.type first (v4), then _zod.def.type (v4 alternative)
	const typeStr = field._def?.type || field._zod?.def?.type || "string";

	// For optional/default, unwrap to inner type
	if (
		typeStr === "optional" ||
		typeStr === "default" ||
		typeStr === "nullable"
	) {
		const inner = field._def?.innerType || field._zod?.def?.innerType;
		return inner ? zodToJsonProperty(inner) : { type: "string" };
	}

	// For arrays
	if (typeStr === "array") {
		const inner = field._def?.type || field._zod?.def?.type;
		return { type: "array", items: { type: inner || "string" } };
	}

	// Map Zod v4 type strings to JSON Schema types
	const typeMap: Record<string, string> = {
		string: "string",
		number: "number",
		bigint: "integer",
		boolean: "boolean",
		date: "string",
		unknown: "string",
		any: "string",
	};

	return { type: typeMap[typeStr] || "string" };
}

export const toolRegistry = {
	get,
	getAll,
	has,
	execute,
	zodToJsonSchema,
};
