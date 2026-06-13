import type { Context, MiddlewareHandler, Env } from "hono";

type AppEnv = Env & { Variables: { userId: string } };

const ERROR_MAP: Record<string, number> = {
  NotFoundError: 404,
  ValidationError: 422,
  AuthError: 401,
  ConflictError: 409,
  RateLimitError: 429,
  ServiceShutdownError: 503,
};

function determineStatus(err: unknown): number {
  const name = err instanceof Error ? err.name : "";
  if (name in ERROR_MAP) return ERROR_MAP[name];
  // Check for ZodError (any form)
  if (name === "ZodError") return 422;
  // Check error message for ZodError
  if (err instanceof Error && err.message.includes("ZodError")) return 422;
  // PostgreSQL unique violation → 409 (check in message and nested error)
  if (err instanceof Error && err.message.includes("23505")) return 409;
  // Drizzle may wrap the error, check for unique constraint in the message
  if (err instanceof Error && (err.message.includes("unique") || err.message.includes("duplicate key"))) return 409;
  return 500;
}

export const errorHandler: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    await next();
  } catch (err) {
    const status = determineStatus(err);
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: { code: name, message } }, status);
  }
};

export function registerErrorHandler(app: unknown) {
  const h = app as { onError: (fn: (err: unknown, c: Context<AppEnv>) => Response) => void };
  h.onError((err, c) => {
    const status = determineStatus(err);
    const name = err instanceof Error ? err.name : "Unknown";
    const message = err instanceof Error ? err.message : "Internal server error";
    return c.json({ error: { code: name, message } }, status);
  });
}
