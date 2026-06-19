import { type Hook, zValidator as zodValidator } from "@hono/zod-validator";
import { z } from "zod";

// Wrapper that normalizes ZodError responses to 400 (matches @hono/zod-validator default)
export function zValidator(
	target: Parameters<typeof zodValidator>[0],
	schema: Parameters<typeof zodValidator>[1],
) {
	return zodValidator(target, schema, (result, c) => {
		if (!result.success) {
			const message = result.error?.message || "Validation error";
			return c.json({ error: { code: "ValidationError", message } }, 400);
		}
	}) as any;
}
