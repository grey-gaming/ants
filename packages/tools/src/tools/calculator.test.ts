import { describe, expect, test } from "bun:test";
import { Calculator } from "./calculator";

describe("Calculator", () => {
	const calc = new Calculator();

	test("basic addition", async () => {
		const result = await calc.execute({ expression: "2 + 2" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(4);
	});

	test("subtraction", async () => {
		const result = await calc.execute({ expression: "10 - 3" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(7);
	});

	test("multiplication", async () => {
		const result = await calc.execute({ expression: "6 * 7" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(42);
	});

	test("division", async () => {
		const result = await calc.execute({ expression: "20 / 4" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(5);
	});

	test("exponentiation via caret", async () => {
		const result = await calc.execute({ expression: "2 ^ 10" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(1024);
	});

	test("modulo", async () => {
		const result = await calc.execute({ expression: "17 % 5" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(2);
	});

	test("parentheses and precedence", async () => {
		const result = await calc.execute({ expression: "(2 + 3) * 4" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(20);
	});

	test("math function sqrt", async () => {
		const result = await calc.execute({ expression: "sqrt(144)" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(12);
	});

	test("math function sin(pi / 2)", async () => {
		const result = await calc.execute({ expression: "sin(pi / 2)" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBeCloseTo(1, 10);
	});

	test("math function abs", async () => {
		const result = await calc.execute({ expression: "abs(-42)" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(42);
	});

	test("math function round", async () => {
		const result = await calc.execute({ expression: "round(3.7)" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(4);
	});

	test("math function floor", async () => {
		const result = await calc.execute({ expression: "floor(3.9)" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(3);
	});

	test("math function ceil", async () => {
		const result = await calc.execute({ expression: "ceil(3.1)" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(4);
	});

	test("math constants pi", async () => {
		const result = await calc.execute({ expression: "pi * 2" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBeCloseTo(Math.PI * 2, 10);
	});

	test("math constants e", async () => {
		const result = await calc.execute({ expression: "e ^ 2" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBeCloseTo(Math.E ** 2, 10);
	});

	test("log and ln", async () => {
		const result = await calc.execute({ expression: "ln(e)" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBeCloseTo(1, 10);
	});

	test("max and min", async () => {
		const result = await calc.execute({ expression: "max(1, 5, 3)" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(5);
	});

	test("floating point precision", async () => {
		const result = await calc.execute({ expression: "3.14159 * 100" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBeCloseTo(314.159, 5);
	});

	test("rejects empty expression", async () => {
		const result = await calc.execute({ expression: "" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("rejects code injection", async () => {
		const result = await calc.execute({ expression: "__import__('os')" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Calculation error");
	});

	test("rejects semicolons and chained statements", async () => {
		const result = await calc.execute({ expression: "2 + 2; rm -rf /" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Calculation error");
	});

	test("nested function calls", async () => {
		const result = await calc.execute({ expression: "sqrt(16) * 2" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(8);
	});

	test("pow function", async () => {
		const result = await calc.execute({ expression: "pow(3, 4)" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(81);
	});

	test("negative numbers", async () => {
		const result = await calc.execute({ expression: "-5 + 3" });
		expect(result.success).toBe(true);
		expect((result.data as any).result).toBe(-2);
	});
});
