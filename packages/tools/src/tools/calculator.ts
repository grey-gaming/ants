import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

const FN_REPLACEMENTS: [string, string][] = [
	["sqrt", "Math.sqrt"],
	["sin", "Math.sin"],
	["cos", "Math.cos"],
	["tan", "Math.tan"],
	["log10", "Math.log10"],
	["log2", "Math.log2"],
	["ln", "Math.log"],
	["log", "Math.log"],
	["exp", "Math.exp"],
	["abs", "Math.abs"],
	["round", "Math.round"],
	["floor", "Math.floor"],
	["ceil", "Math.ceil"],
	["pow", "Math.pow"],
	["max", "Math.max"],
	["min", "Math.min"],
];

export class Calculator extends BaseTool<typeof Calculator.parameters> {
	name = "calculator";
	description =
		"Perform mathematical calculations. Supports basic arithmetic (+, -, *, /, %), exponentiation (^), and common math functions (sqrt, sin, cos, tan, log, ln, abs, round, floor, ceil, pi, e, pow, max, min).";
	static parameters = z.object({
		expression: z.string().min(1).max(1000),
	});
	parameters = Calculator.parameters;

	protected async _execute(
		input: z.infer<typeof Calculator.parameters>,
	): Promise<ToolResult> {
		const { expression } = input;

		try {
			const result = this.safeEvaluate(expression);
			return { success: true, data: { expression, result } };
		} catch (err) {
			return {
				success: false,
				error: `Calculation error: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}

	private safeEvaluate(expr: string): number {
		// Normalize whitespace
		let processed = expr.replace(/\s+/g, " ").trim();

		// Replace ^ with **
		processed = processed.replace(/\^/g, "**");

		// Replace function calls with Math.* equivalents
		// Use negative lookbehind to avoid matching inside Math.* (e.g. Math.log)
		for (const [name, replacement] of FN_REPLACEMENTS) {
			const regex = new RegExp("(?<!\\.)\\b" + name + "\\s*\\(", "g");
			processed = processed.replace(regex, replacement + "(");
		}

		// Replace constants
		processed = processed.replace(/\bpi\b/g, "Math.PI");
		processed = processed.replace(/\be\b/g, "Math.E");

		// Safety: remove all known safe tokens, nothing suspicious should remain
		const stripped = processed
			.replace(/Math\.\w+/g, "")
			.replace(/[0-9+\-*/().eE\s_%,]/g, "");

		if (stripped.length > 0) {
			throw new Error("Expression contains disallowed content");
		}

		// Evaluate safely with only Math namespace
		const fn = new Function("Math", `"use strict"; return (${processed})`);
		const result = fn(Math);

		if (typeof result !== "number" || !isFinite(result)) {
			throw new Error("Invalid result");
		}

		return result;
	}
}
