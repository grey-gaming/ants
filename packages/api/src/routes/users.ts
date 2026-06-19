import { Hono } from "hono";
import type { Env } from "hono/types";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createUserRoutes(svc: Services) {
	const app = new Hono<AppEnv>();

	app.get("/", async (c) => {
		const users = await svc.user.list("", { limit: 100 });
		return c.json(users, 200);
	});

	app.get("/:id", async (c) => {
		const id = c.req.param("id");
		if (!id) return c.json({ error: "Id required" }, 400);
		const result = await svc.user.getById(id);
		if (!result) return c.json({ error: "User not found" }, 404);
		return c.json(result, 200);
	});

	app.patch("/:id", async (c) => {
		const id = c.req.param("id");
		if (!id) return c.json({ error: "Id required" }, 400);
		const body = await c.req.json();
		const result = await svc.user.update(id, { name: body.name });
		return c.json(result, 200);
	});

	app.delete("/:id", async (c) => {
		const id = c.req.param("id");
		if (!id) return c.json({ error: "Id required" }, 400);
		const userId = c.get("userId");
		await svc.user.deactivate(id, userId);
		return c.json({ deactivated: true }, 200);
	});

	return app;
}
