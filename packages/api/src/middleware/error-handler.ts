import { Context, MiddlewareHandler, Next } from "hono";
import { HTTPException } from "hono/http-exception";
import { AntsError, NotFoundError, ValidationError, AuthError, ConflictError, RateLimitError, InternalError } from "@ants/core";

interface ErrorHandlerResult {
  response: Response;
}

const errorStatusCodes: Record<string, number> = {
  [NotFoundError.name]: 404,
  [ValidationError.name]: 422,
  [AuthError.name]: 401,
  [ConflictError.name]: 409,
  [RateLimitError.name]: 429,
  [InternalError.name]: 500,
};

function isErrorInstance(err: unknown): err is AntsError {
  return err instanceof AntsError;
}

function getStatusCode(err: unknown): number {
  if (err instanceof HTTPException) {
    return err.status;
  }
  if (isErrorInstance(err)) {
    return errorStatusCodes[err.constructor.name] ?? 500;
  }
  return 500;
}

export const errorHandler: MiddlewareHandler = async (c: Context, next: Next): Promise<Response | undefined> => {
  try {
    await next();
  } catch (err) {
    const status = getStatusCode(err);
    const message = isErrorInstance(err) || err instanceof HTTPException
      ? err.message
      : "Internal server error";
    const code = isErrorInstance(err) ? err.constructor.name : "UnknownError";
    return c.json({ error: { code, message } }, status);
  }
};
