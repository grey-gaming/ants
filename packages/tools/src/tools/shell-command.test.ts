import { describe, expect, test } from "bun:test";
import { ShellCommand } from "./shell-command";

describe("ShellCommand", () => {
	const tool = new ShellCommand();

	test("run echo command", async () => {
		const result = await tool.execute({ command: "echo hello" });
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.output.stdout).toBe("hello");
	});

	test("run ls command", async () => {
		const result = await tool.execute({ command: "ls /tmp" });
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.output.stdout).toBeDefined();
	});

	test("blocked dangerous command", async () => {
		const result = await tool.execute({ command: "rm -rf /" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("blocked");
	});

	test("blocked sudo command", async () => {
		const result = await tool.execute({ command: "sudo ls" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("blocked");
	});

	test("command timeout", async () => {
		const result = await tool.execute({ command: "sleep 10", timeout: 1 });
		expect(result.success).toBe(false);
		expect(result.error).toContain("timed out");
	});

	test("empty command rejected", async () => {
		const result = await tool.execute({ command: "" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("command with stderr", async () => {
		const result = await tool.execute({ command: "echo hello >&2; exit 0" });
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.output.stderr).toBe("hello");
	});
});
