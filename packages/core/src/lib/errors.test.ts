import { describe, expect, test } from "bun:test";
import {
	AntsError,
	AuthError,
	ConflictError,
	InternalError,
	NotFoundError,
	RateLimitError,
	ServiceShutdownError,
	ValidationError,
} from "./errors";

describe("AntsError base class", () => {
	test("extends Error and sets name, code, statusCode", () => {
		const err = new NotFoundError("User", "abc-123");
		expect(err).toBeInstanceOf(Error);
		expect(err).toBeInstanceOf(AntsError);
		expect(err.name).toBe("NotFoundError");
		expect(err.code).toBe("NOT_FOUND");
		expect(err.statusCode).toBe(404);
		expect(err.message).toBe("User with id abc-123 not found");
	});
});

describe("NotFoundError", () => {
	test("has correct status code and error code", () => {
		const err = new NotFoundError("Thread", "t-1");
		expect(err.statusCode).toBe(404);
		expect(err.code).toBe("NOT_FOUND");
	});
});

describe("ValidationError", () => {
	test("passes message through and supports optional details", () => {
		const err = new ValidationError("Title must not be empty", {
			field: "title",
		});
		expect(err.statusCode).toBe(422);
		expect(err.code).toBe("VALIDATION_ERROR");
		expect(err.message).toBe("Title must not be empty");
		expect(err.details).toEqual({ field: "title" });
	});

	test("works without details", () => {
		const err = new ValidationError("bad input");
		expect(err.details).toBeUndefined();
	});
});

describe("AuthError", () => {
	test("defaults to Unauthorized message", () => {
		const err = new AuthError();
		expect(err.statusCode).toBe(401);
		expect(err.code).toBe("UNAUTHORIZED");
		expect(err.message).toBe("Unauthorized");
	});

	test("accepts custom message", () => {
		const err = new AuthError("Token expired");
		expect(err.message).toBe("Token expired");
	});
});

describe("ConflictError", () => {
	test("has correct status code and error code", () => {
		const err = new ConflictError("Resource already exists");
		expect(err.statusCode).toBe(409);
		expect(err.code).toBe("CONFLICT");
		expect(err.message).toBe("Resource already exists");
	});
});

describe("RateLimitError", () => {
	test("defaults to Rate limit exceeded message", () => {
		const err = new RateLimitError();
		expect(err.statusCode).toBe(429);
		expect(err.code).toBe("RATE_LIMIT_EXCEEDED");
		expect(err.message).toBe("Rate limit exceeded");
	});
});

describe("InternalError", () => {
	test("defaults to Internal server error message", () => {
		const err = new InternalError();
		expect(err.statusCode).toBe(500);
		expect(err.code).toBe("INTERNAL_ERROR");
		expect(err.message).toBe("Internal server error");
	});

	test("accepts custom message and details", () => {
		const err = new InternalError("db failure", { reason: "connection lost" });
		expect(err.message).toBe("db failure");
		expect(err.details).toEqual({ reason: "connection lost" });
	});
});

describe("ServiceShutdownError", () => {
	test("has correct status code and error code", () => {
		const err = new ServiceShutdownError();
		expect(err.statusCode).toBe(503);
		expect(err.code).toBe("SERVICE_SHUTTING_DOWN");
		expect(err.message).toBe("Service is shutting down");
	});
});
