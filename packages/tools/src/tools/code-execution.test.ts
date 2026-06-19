import { describe, expect, test } from "bun:test";
import { CodeExecution } from "./code-execution";

describe("CodeExecution", () => {
	const tool = new CodeExecution();

	test("run simple Python code", async () => {
		const result = await tool.execute({ code: "print('hello')" });
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.output.stdout).toBe("hello");
	});

	test("run Python math", async () => {
		const result = await tool.execute({ code: "print(2 ** 10)" });
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.output.stdout).toBe("1024");
	});

	test("run Python with imports", async () => {
		const result = await tool.execute({
			code: "import math\nprint(math.sqrt(144))",
		});
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.output.stdout).toBe("12.0");
	});

	test("blocked dangerous import", async () => {
		const result = await tool.execute({ code: "import os\nprint('hi')" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("blocked");
	});

	test("blocked network import", async () => {
		const result = await tool.execute({ code: "import requests\nprint('hi')" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("blocked");
	});

	test("empty code rejected", async () => {
		const result = await tool.execute({ code: "" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("syntax error in code", async () => {
		const result = await tool.execute({ code: "print(" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Execution error");
	});
});
