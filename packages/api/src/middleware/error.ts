import type { Context, MiddlewareHandler, Env } from "hono";

type AppEnv = Env & { Variables: { userId: string } };

export const errorHandler: MiddlewareHandler<AppEnv> = async (c, next) => {
  try {
    await next();
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    const status = name === "NotFoundError" ? 404
      : name === "ValidationError" ? 422
        : name === "AuthError" ? 401
          : name === "ConflictError" ? 409
            : name === "RateLimitError" ? 429
              : name === "ServiceShutdownError" ? 503
                : 500;
    return c.json(
      { error: { code: name || "Unknown", message: err instanceof Error ? err.message : "Internal server error" } },
      status,
    );
  }
};

export function registerErrorHandler(app: unknown) {
  const h = app as { onError: (fn: (err: unknown, c: Context<AppEnv>) => Response) => void };
  h.onError((err, c) => {
    const name = err instanceof Error ? err.name : "";
    const status = name === "NotFoundError" ? 404
      : name === "ValidationError" ? 422
        : name === "AuthError" ? 401
          : name === "ConflictError" ? 409
            : name === "RateLimitError" ? 429
              : name === "ServiceShutdownError" ? 503
                : 500;
    return c.json(
      { error: { code: name || "Unknown", message: err instanceof Error ? err.message : "Internal server error" } },
      status,
    );
  });
}
