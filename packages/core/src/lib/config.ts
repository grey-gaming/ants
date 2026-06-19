import { z } from "zod";

const configSchema = z.object({
	databaseUrl: z.string().min(1),
	ollamaBaseUrl: z.string().min(1),
	jwtSecret: z.string().min(1),
	logLevel: z.enum(["debug", "info", "warn", "error"]).default("info"),
	shutdownTimeoutSeconds: z.coerce.number().int().positive().default(30),
	maxConcurrentRuns: z.coerce.number().int().positive().default(4),
	toolTimeoutSeconds: z.coerce.number().int().positive().default(30),
	maxOutputChars: z.coerce.number().int().positive().default(10000),
	contextWindowTokens: z.coerce.number().int().positive().default(32000),
});

const getRawValues = () => ({
	databaseUrl: process.env.DATABASE_URL,
	ollamaBaseUrl: process.env.OLLAMA_BASE_URL,
	jwtSecret: process.env.JWT_SECRET,
	logLevel: process.env.LOG_LEVEL,
	shutdownTimeoutSeconds: process.env.SHUTDOWN_TIMEOUT_SECONDS,
	maxConcurrentRuns: process.env.MAX_CONCURRENT_RUNS,
	toolTimeoutSeconds: process.env.TOOL_TIMEOUT_SECONDS,
	maxOutputChars: process.env.MAX_OUTPUT_CHARS,
	contextWindowTokens: process.env.CONTEXT_WINDOW_TOKENS,
});

let _parsed: z.infer<typeof configSchema> | undefined;

function parse(): z.infer<typeof configSchema> {
	if (_parsed) return _parsed;
	_parsed = configSchema.parse(getRawValues());
	return _parsed;
}

export const config = {
	get databaseUrl() {
		return parse().databaseUrl;
	},
	get ollamaBaseUrl() {
		return parse().ollamaBaseUrl;
	},
	get jwtSecret() {
		return parse().jwtSecret;
	},
	get logLevel() {
		return parse().logLevel;
	},
	get shutdownTimeoutSeconds() {
		return parse().shutdownTimeoutSeconds;
	},
	get maxConcurrentRuns() {
		return parse().maxConcurrentRuns;
	},
	get toolTimeoutSeconds() {
		return parse().toolTimeoutSeconds;
	},
	get maxOutputChars() {
		return parse().maxOutputChars;
	},
	get contextWindowTokens() {
		return parse().contextWindowTokens;
	},
};
