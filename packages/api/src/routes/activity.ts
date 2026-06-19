import { NotFoundError } from "@ants/core";
import { runs } from "@ants/store";
import { eq } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { Hono } from "hono";
import type { Env } from "hono/types";
import type { Services } from "../types";

type AppEnv = Env & { Variables: { userId: string } };

export function createThreadActivityRoutes(
	db: PostgresJsDatabase,
	svc: Services,
) {
	const app = new Hono<AppEnv>();

	app.get("/activity", async (c) => {
		const threadId = c.req.param("threadId")!;
		const userId = c.get("userId");

		const thread = await svc.thread.getById(userId, threadId);
		if (!thread) throw new NotFoundError("Thread", threadId);

		const allRuns = await db
			.select()
			.from(runs)
			.where(eq(runs.threadId, threadId))
			.orderBy(runs.createdAt);

		const runMap = new Map<
			string,
			{ run: (typeof allRuns)[number]; children: string[] }
		>();
		const rootRuns: string[] = [];

		for (const run of allRuns) {
			runMap.set(run.id, { run, children: [] });
			if (run.parentRunId) {
				const parent = runMap.get(run.parentRunId);
				if (parent) parent.children.push(run.id);
			} else {
				rootRuns.push(run.id);
			}
		}

		function collectTree(runId: string): unknown {
			const entry = runMap.get(runId);
			if (!entry) return null;
			return {
				run: entry.run,
				children: entry.children.map(collectTree),
			};
		}

		return c.json(
			{
				threadId,
				runs: rootRuns.map(collectTree),
				totalRuns: allRuns.length,
			},
			200,
		);
	});

	return app;
}
