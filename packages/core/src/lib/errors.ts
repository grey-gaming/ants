interface AntsErrorOptions {
  code: string;
  statusCode: number;
  details?: Record<string, unknown>;
}

export class AntsError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly details?: Record<string, unknown>;

  constructor(options: AntsErrorOptions & { message: string }) {
    super(options.message);
    this.name = this.constructor.name;
    this.code = options.code;
    this.statusCode = options.statusCode;
    this.details = options.details;
  }
}

export class NotFoundError extends AntsError {
  constructor(resource: string, id: string) {
    super({
      message: `${resource} with id ${id} not found`,
      code: "NOT_FOUND",
      statusCode: 404,
    });
  }
}

export class ValidationError extends AntsError {
  constructor(message: string, details?: Record<string, unknown>) {
    super({
      message,
      code: "VALIDATION_ERROR",
      statusCode: 422,
      details,
    });
  }
}

export class AuthError extends AntsError {
  constructor(message = "Unauthorized") {
    super({
      message,
      code: "UNAUTHORIZED",
      statusCode: 401,
    });
  }
}

export class ConflictError extends AntsError {
  constructor(message: string) {
    super({
      message,
      code: "CONFLICT",
      statusCode: 409,
    });
  }
}

export class RateLimitError extends AntsError {
  constructor(message = "Rate limit exceeded") {
    super({
      message,
      code: "RATE_LIMIT_EXCEEDED",
      statusCode: 429,
    });
  }
}

export class InternalError extends AntsError {
  constructor(message = "Internal server error", details?: Record<string, unknown>) {
    super({
      message,
      code: "INTERNAL_ERROR",
      statusCode: 500,
      details,
    });
  }
}

export class ServiceShutdownError extends AntsError {
  constructor(message = "Service is shutting down") {
    super({
      message,
      code: "SERVICE_SHUTTING_DOWN",
      statusCode: 503,
    });
  }
}
