import { Hono } from "hono";
import type { Env } from "hono/types";
import {
	createRunRequestSchema,
	updateRunStatusRequestSchema,
} from "../schemas/request";
import type { Services } from "../types";

type RunStatus = "queued" | "in_progress" | "completed" | "failed" | "cancelled";

type AppEnv = Env & { Variables: { userId: string } };

export function createRunRoutes(svc: Services) {
	const app = new Hono<AppEnv>();

	app.post("/", async (c) => {
		const userId = c.get("userId");
		const raw = await c.req.json();
		const input = createRunRequestSchema.parse(raw);
		const result = await svc.run.create({ ...input, userId });
		return c.json(result, 201);
	});

	app.get("/", async (c) => {
		const userId = c.get("userId");
		const result = await svc.run.listAll(userId, {
			cursor: c.req.query("cursor"),
			limit: c.req.query("limit")
				? parseInt(c.req.query("limit")!, 10)
				: undefined,
			status: c.req.query("status") as RunStatus | undefined,
		});
		return c.json(result, 200);
	});

	app.get("/:id", async (c) => {
		const id = c.req.param("id")!;
		const result = await svc.run.getById(id);
		if (!result) return c.json({ error: "Run not found" }, 404);
		return c.json(result, 200);
	});

	app.patch("/:id/status", async (c) => {
		const id = c.req.param("id")!;
		const raw = await c.req.json();
		const { status } = updateRunStatusRequestSchema.parse(raw);
		const result = await svc.run.updateStatus(id, status);
		return c.json(result, 200);
	});

	app.post("/:id/cancel", async (c) => {
		const id = c.req.param("id")!;
		const result = await svc.run.cancel(id);
		return c.json(result, 200);
	});

	app.get("/:id/steps", async (c) => {
		const id = c.req.param("id")!;
		const steps = await svc.run.getSteps(id);
		return c.json(steps, 200);
	});

	return app;
}
