import { Hono } from "hono";
import type { Env } from "hono/types";
import { registerAgentRequestSchema } from "../schemas/request";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createAgentRoutes(svc: Services) {
	const app = new Hono<AppEnv>();

	app.post("/", async (c) => {
		const raw = await c.req.json();
		const body = registerAgentRequestSchema.parse(raw);
		const result = await svc.agent.register(body);
		return c.json(result, 201);
	});

	app.get("/", async (c) => {
		const result = await svc.agent.list({
			limit: c.req.query("limit")
				? parseInt(c.req.query("limit")!, 10)
				: undefined,
		});
		return c.json(result, 200);
	});

	app.get("/:id", async (c) => {
		const id = c.req.param("id")!;
		const result = await svc.agent.getById(id);
		if (!result) return c.json({ error: "Agent not found" }, 404);
		return c.json(result, 200);
	});

	app.patch("/:id", async (c) => {
		const id = c.req.param("id")!;
		const raw = await c.req.json();
		const body = registerAgentRequestSchema.partial().parse(raw);
		const result = await svc.agent.update(id, {
			name: body.name,
			description: body.description,
			modelConfig: body.modelConfig,
			capabilities: body.capabilities,
			toolIds: body.toolIds,
		});
		return c.json(result, 200);
	});

	return app;
}
