import { Hono } from "hono";
import type { Env } from "hono/types";
import { $db } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { configureServices, type ConfiguredServices } from "./app";
import { errorHandler } from "./middleware/error";
import { createAuthMiddleware } from "./middleware/auth";
import { createThreadRoutes } from "./routes/threads";
import { createMessageRoutes } from "./routes/messages";
import { createRunRoutes } from "./routes/runs";
import { createAgentRoutes } from "./routes/agents";
import { createToolRoutes } from "./routes/tools";
import { createQueueRoutes } from "./routes/queue";

export type Services = ConfiguredServices;
type AppEnv = Env & { Variables: { userId: string } };

let sharedServices: ConfiguredServices | null = null;
let sharedDb: PostgresJsDatabase | null = null;

export function buildApp(dbOnly?: PostgresJsDatabase): Hono<AppEnv> {
  sharedDb = dbOnly || $db;
  if (!sharedDb) {
    throw new Error("Database not initialized. Set DATABASE_URL.");
  }
  if (!sharedServices) {
    sharedServices = configureServices(sharedDb);
  }
  const services = sharedServices;

  const authMiddleware = createAuthMiddleware(sharedDb);

  const app = new Hono<AppEnv>();

  app.use("*", errorHandler);
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.use("/v1/*", authMiddleware);

  app.route("/v1/threads", createThreadRoutes(services));
  app.route("/v1/messages", createMessageRoutes(services));
  app.route("/v1/runs", createRunRoutes(services));
  app.route("/v1/agents", createAgentRoutes(services));
  app.route("/v1/tools", createToolRoutes(services));
  app.route("/v1/queue", createQueueRoutes(services));

  return app;
}
