import { Hono } from "hono";
import type { Env } from "hono/types";
import { $db } from "@ants/store";
import { config, createRunExecutor, createQueueWorker, discoverAndRegister, logger } from "@ants/core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { configureServices, type ConfiguredServices } from "./app";
import { errorHandler, registerErrorHandler } from "./middleware/error";
import { createAuthMiddleware } from "./middleware/auth";
import { createThreadRoutes } from "./routes/threads";
import { createMessageRoutes } from "./routes/messages";
import { createRunRoutes } from "./routes/runs";
import { createAgentRoutes } from "./routes/agents";
import { createToolRoutes } from "./routes/tools";
import { createQueueRoutes } from "./routes/queue";
import { createStreamRoutes } from "./routes/stream";
import { createAuthRoutes } from "./routes/auth";
import { createUserRoutes } from "./routes/users";
import { createSettingsRoutes } from "./routes/settings";
import { createInviteCodesRoutes } from "./routes/invite-codes";
import { createThreadActivityRoutes } from "./routes/activity";
import { createRunStepsRoutes } from "./routes/run-steps";
import { createWorkerRoutes } from "./routes/worker";
import { createWorkerManager } from "./services/worker-manager";
import { MlxProvider, type LLMProvider } from "@ants/llm";
import { toolRegistry } from "@ants/tools";
import { agentRegistry } from "@ants/agents";

export type Services = ConfiguredServices;
type AppEnv = Env & { Variables: { userId: string } };

let sharedServices: ConfiguredServices | null = null;
let sharedDb: PostgresJsDatabase | null = null;
let sharedWorker: ReturnType<typeof createQueueWorker> | null = null;

export function buildApp(dbOnly?: PostgresJsDatabase): Hono<AppEnv> & { worker: ReturnType<typeof createQueueWorker>; stop: () => Promise<void> } {
  sharedDb = dbOnly || $db;
  if (!sharedDb) {
    throw new Error("Database not initialized. Set DATABASE_URL.");
  }
  if (!sharedServices) {
    sharedServices = configureServices(sharedDb);
  }
  const services = sharedServices;
  const db = sharedDb;

  // ─── Auto-discover and register tools + agents ──────────────────────────
  const toolEntries = toolRegistry.getAll().map((entry) => ({
    name: entry.definition.name,
    description: entry.definition.description,
    type: "builtin" as const,
    parametersSchema: toolRegistry.zodToJsonSchema(entry.parameters),
  }));

  const agentEntries = agentRegistry.getAll().map((agent) => ({
    name: agent.name,
    tier: agent.tier,
    description: agent.description,
    modelConfig: agent.defaultModelConfig ?? null,
    capabilities: agent.defaultCapabilities ?? null,
    toolNames: agent.toolNames ?? null,
  }));

  void discoverAndRegister(db, toolEntries, agentEntries).then((result) => {
    const toolsMsg = result.toolsRegistered.length > 0
      ? `Registered tools: ${result.toolsRegistered.join(", ")}`
      : result.toolsSkipped.length > 0
        ? `Tools already registered: ${result.toolsSkipped.join(", ")}`
        : "No tools discovered";
    const agentsMsg = result.agentsRegistered.length > 0
      ? `Registered agents: ${result.agentsRegistered.join(", ")}`
      : result.agentsSkipped.length > 0
        ? `Agents already registered: ${result.agentsSkipped.join(", ")}`
        : "No agents discovered";
    logger.info("startup", `${toolsMsg} | ${agentsMsg}`);
  }).catch((err) => {
    logger.error("startup", `Discovery failed: ${err instanceof Error ? err.message : String(err)}`);
  });

  const authMiddleware = createAuthMiddleware(sharedDb);

  // Create MLX provider
  const baseUrl = process.env.MLX_BASE_URL || config.ollamaBaseUrl;
  const llmProvider = new MlxProvider({
    baseUrl: baseUrl.replace(/\/+$/, ""),
    modelName: process.env.MLX_MODEL_NAME || "mlx-community/Llama-3.2-3B-Instruct-4bit",
    contextWindow: config.contextWindowTokens,
  });

  // Build dispatch function
  const executor = createRunExecutor(sharedDb, services.run, services.message, services.agent, services.tool);
  const dispatch = async (runId: string, userId: string, threadId: string, agentTypeId: string, llmProv: LLMProvider) => {
    await executor.execute({ runId, userId, threadId, agentTypeId, llmProvider: llmProv });
  };

  // Build queue worker
  const worker = createQueueWorker(sharedDb, llmProvider, dispatch, {
    pollIntervalMs: 2000,
    maxRetries: 3,
    retryDelayMs: 5000,
    maxConcurrentRuns: 4,
  });

  const workerManager = createWorkerManager(worker);

  const app = new Hono<AppEnv>() as Hono<AppEnv> & { worker: typeof worker; stop: () => Promise<void> };

  app.use("*", errorHandler);
  registerErrorHandler(app);
  app.get("/health", (c) => c.json({ status: "ok" }));
  app.use("/v1/*", authMiddleware);

  // Mount routes
  app.route("/v1/threads", createThreadRoutes(services));
  app.route("/v1/messages", createMessageRoutes(services));
  app.route("/v1/runs", createRunRoutes(services));
  app.route("/v1/agents", createAgentRoutes(services));
  app.route("/v1/tools", createToolRoutes(services));
  app.route("/v1/queue", createQueueRoutes(services));
  app.route("/v1/auth", createAuthRoutes(services));
  app.route("/v1/users", createUserRoutes(services, db));
  app.route("/v1/settings", createSettingsRoutes(services));
  app.route("/v1/invite-codes", createInviteCodesRoutes(services));
  app.route("/v1/worker", createWorkerRoutes(services, workerManager));
  app.route("/v1/threads/:threadId", createThreadActivityRoutes(db, services));
  app.route("/v1/threads/:threadId/runs/:runId", createRunStepsRoutes(db, services));
  app.route("/v1/runs/:runId", createRunStepsRoutes(db, services));
  app.route("/v1/threads", createStreamRoutes(services));

  app.worker = worker;
  app.stop = async () => {
    await worker.stop();
  };

  return app;
}
