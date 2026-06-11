import { z } from "zod";

const configSchema = z.object({
  databaseUrl: z.string().min(1),
  ollamaBaseUrl: z.string().min(1),
  apiKeySecret: z.string().min(1),
  jwtSecret: z.string().min(1),
  logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
  shutdownTimeoutSeconds: z.coerce.number().int().positive().default(30),
  maxConcurrentRuns: z.coerce.number().int().positive().default(4),
  toolTimeoutSeconds: z.coerce.number().int().positive().default(30),
  maxOutputChars: z.coerce.number().int().positive().default(10000),
  contextWindowTokens: z.coerce.number().int().positive().default(32000),
});

export const config = configSchema.parse({
  databaseUrl: process.env.DATABASE_URL,
  ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
  apiKeySecret: process.env.API_KEY_SECRET,
  jwtSecret: process.env.JWT_SECRET,
  logLevel: process.env.LOG_LEVEL,
  shutdownTimeoutSeconds: process.env.SHUTDOWN_TIMEOUT_SECONDS,
  maxConcurrentRuns: process.env.MAX_CONCURRENT_RUNS,
  toolTimeoutSeconds: process.env.TOOL_TIMEOUT_SECONDS,
  maxOutputChars: process.env.MAX_OUTPUT_CHARS,
  contextWindowTokens: process.env.CONTEXT_WINDOW_TOKENS,
});
