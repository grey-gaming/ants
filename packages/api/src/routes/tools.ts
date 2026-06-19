import { toolRegistry } from "@ants/tools";
import { Hono } from "hono";
import type { Env } from "hono/types";
import { registerToolRequestSchema } from "../schemas/request";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createToolRoutes(svc: Services) {
	const app = new Hono<AppEnv>();

	// Register a new tool
	app.post("/", async (c) => {
		const userId = c.get("userId");
		const raw = await c.req.json();
		const body = registerToolRequestSchema.parse(raw);
		const result = await svc.tool.register(userId, body);
		return c.json(result, 201);
	});

	// List all tools
	app.get("/", async (c) => {
		const result = await svc.tool.list({ limit: 100 });
		return c.json(result, 200);
	});

	// List all available builtin tools with their schemas (must be before /:id)
	app.get("/available", async (c) => {
		const all = toolRegistry.getAll();
		const available = all.map((entry) => ({
			name: entry.definition.name,
			description: entry.definition.description,
			parameters: toolRegistry.zodToJsonSchema(entry.definition.parameters),
		}));
		return c.json({ tools: available }, 200);
	});

	// Get tool by ID
	app.get("/:id", async (c) => {
		const id = c.req.param("id")!;
		const result = await svc.tool.getById(id);
		if (!result) return c.json({ error: "Tool not found" }, 404);
		return c.json(result, 200);
	});

	// Update tool
	app.patch("/:id", async (c) => {
		const userId = c.get("userId");
		const id = c.req.param("id")!;
		const raw = await c.req.json();
		if (Object.keys(raw).length === 0) {
			return c.json({ error: "No fields to update" }, 422);
		}
		const result = await svc.tool.update(userId, id, raw);
		return c.json(result, 200);
	});

	// Execute a tool by name (e.g., POST /tools/calculator/execute)
	app.post("/:name/execute", async (c) => {
		const toolName = c.req.param("name")!;
		const raw = await c.req.json();

		if (!toolRegistry.has(toolName)) {
			return c.json({ error: `Unknown tool: ${toolName}` }, 404);
		}

		const args = raw.args ?? raw;
		const result = await toolRegistry.execute(toolName, args);
		if (!result.success) {
			return c.json({ error: result.error }, 400);
		}
		return c.json(result.data, 200);
	});

	return app;
}
