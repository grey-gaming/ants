export class AntsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
    public readonly statusCode: number,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AntsError {
  constructor(resource: string, id: string) {
    super(`${resource} with id ${id} not found`, "NOT_FOUND", 404);
  }
}

export class ValidationError extends AntsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super(message, "VALIDATION_ERROR", 422, details);
  }
}

export class ToolError extends AntsError {
  constructor(message: string) {
    super(message, "TOOL_ERROR", 500);
  }
}

export class AuthError extends AntsError {
  constructor(message = "Unauthorized") {
    super(message, "UNAUTHORIZED", 401);
  }
}

export class ConflictError extends AntsError {
  constructor(message: string) {
    super(message, "CONFLICT", 409);
  }
}

export class RateLimitError extends AntsError {
  constructor(message = "Rate limit exceeded") {
    super(message, "RATE_LIMIT_EXCEEDED", 429);
  }
}

export class InternalError extends AntsError {
  constructor(message = "Internal server error", details?: Record<string, unknown>) {
    super(message, "INTERNAL_ERROR", 500, details);
  }
}

export class ServiceShutdownError extends AntsError {
  constructor(message = "Service is shutting down") {
    super(message, "SERVICE_SHUTTING_DOWN", 503);
  }
}
