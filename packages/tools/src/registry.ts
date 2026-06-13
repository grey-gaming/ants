import type { Tool, ToolResult, ToolDefinition } from "./types/tool";
import { BaseTool } from "./tools/base-tool";
import { WebSearch } from "./tools/web-search";

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
const webSearch = new WebSearch();
tools.set(webSearch.name, {
  instance: webSearch,
  definition: {
    name: webSearch.name,
    description: webSearch.description,
    parameters: webSearch.parameters,
  },
  parameters: webSearch.parameters,
});

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
    const def = (schema as any)._def;
    if (def.typeName === "ZodObject") {
      const shape = (schema as any).shape;
      const properties: Record<string, unknown> = {};
      const required: string[] = [];
      for (const [key, value] of Object.entries(shape) as [string, any][]) {
        const vDef = value._def;
        properties[key] = zodToJsonProperty(vDef);
        const isOptional = vDef.typeName === "ZodOptional" || vDef.optional;
        if (!isOptional) {
          required.push(key);
        }
      }
      return {
        type: "object",
        properties,
        required: required.length > 0 ? required : undefined,
      };
    }
    return { type: "object" };
  } catch {
    return { type: "object" };
  }
}

function zodToJsonProperty(def: any): Record<string, unknown> {
  const typeName = def.typeName;
  switch (typeName) {
    case "ZodString":
      return { type: "string" };
    case "ZodNumber":
      return { type: "number" };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray":
      return { type: "array", items: zodToJsonProperty(def.type?._def) };
    case "ZodOptional":
      return zodToJsonProperty(def.innerType?._def || def.wrappedType?._def);
    default:
      return { type: "string" };
  }
}

export const toolRegistry = {
  get,
  getAll,
  has,
  execute,
  zodToJsonSchema,
};
