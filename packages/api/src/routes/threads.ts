import { Hono } from "hono";
import type { Env } from "hono/types";
import { createThreadRequestSchema } from "../schemas/request";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createThreadRoutes(svc: Services) {
	const app = new Hono<AppEnv>();

	app.post("/", async (c) => {
		const userId = c.get("userId");
		const raw = await c.req.json();
		const input = createThreadRequestSchema.parse(raw);
		const result = await svc.thread.create(userId, input);
		return c.json(result, 201);
	});

	app.get("/", async (c) => {
		const userId = c.get("userId");
		const result = await svc.thread.list(userId, {
			cursor: c.req.query("cursor"),
			limit: c.req.query("limit")
				? parseInt(c.req.query("limit")!, 10)
				: undefined,
		});
		return c.json(result, 200);
	});

	app.get("/:id", async (c) => {
		const userId = c.get("userId");
		const id = c.req.param("id")!;
		const result = await svc.thread.getById(userId, id);
		if (!result) return c.json({ error: "Thread not found" }, 404);
		return c.json(result, 200);
	});

	app.patch("/:id", async (c) => {
		const userId = c.get("userId");
		const id = c.req.param("id")!;
		const raw = await c.req.json();
		if (Object.keys(raw).length === 0) {
			return c.json({ error: "No fields to update" }, 422);
		}
		const result = await svc.thread.update(userId, id, {
			title: raw.title,
			isPinned: raw.isPinned,
			metadata: raw.metadata,
		});
		return c.json(result, 200);
	});

	app.delete("/:id", async (c) => {
		const userId = c.get("userId");
		const id = c.req.param("id")!;
		await svc.thread.remove(userId, id);
		return c.json({ deleted: true }, 200);
	});

	return app;
}
