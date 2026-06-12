export class AntsError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = this.constructor.name;
  }
}

export class NotFoundError extends AntsError {
  constructor(resource: string, id: string) {
    super(`${resource} not found: ${id}`, "NOT_FOUND");
  }
}

export class ValidationError extends AntsError {
  constructor(message: string) {
    super(message, "VALIDATION_ERROR");
  }
}

export class ToolError extends AntsError {
  constructor(message: string) {
    super(message, "TOOL_ERROR");
  }
}

export class AuthError extends AntsError {
  constructor(message: string) {
    super(message, "AUTH_ERROR");
  }
}

export class ConflictError extends AntsError {
  constructor(message: string) {
    super(message, "CONFLICT");
  }
}

export class RateLimitError extends AntsError {
  constructor(message: string) {
    super(message, "RATE_LIMIT");
  }
}

export class InternalError extends AntsError {
  constructor(message: string) {
    super(message, "INTERNAL_ERROR");
  }
}

export class ServiceShutdownError extends AntsError {
  constructor(message: string) {
    super(message, "SERVICE_SHUTDOWN");
  }
}
