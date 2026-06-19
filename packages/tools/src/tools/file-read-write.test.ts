import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { FileReadWrite } from "./file-read-write";

describe("FileReadWrite", () => {
	const tool = new FileReadWrite();
	const testDir = "/tmp/ants-tool-test-file-rw";
	const testFile = `${testDir}/test.txt`;

	beforeEach(() => {
		mkdirSync(testDir, { recursive: true });
		writeFileSync(testFile, "Hello, World!");
	});

	afterEach(() => {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {}
	});

	test("read file", async () => {
		const result = await tool.execute({ action: "read", path: testFile });
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.content).toBe("Hello, World!");
		expect(data.size).toBe(13);
	});

	test("read non-existent file", async () => {
		const result = await tool.execute({
			action: "read",
			path: "/tmp/nonexistent-file.txt",
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	test("write file", async () => {
		const writePath = `${testDir}/write-test.txt`;
		const result = await tool.execute({
			action: "write",
			path: writePath,
			content: "Written content",
		});
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.written).toBe(15);
	});

	test("list directory", async () => {
		const result = await tool.execute({ action: "list", path: testDir });
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.items.length).toBeGreaterThan(0);
	});

	test("list non-existent directory", async () => {
		const result = await tool.execute({
			action: "list",
			path: "/tmp/nonexistent-dir",
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("not found");
	});

	test("rejects empty path", async () => {
		const result = await tool.execute({ action: "read", path: "" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("access restricted path", async () => {
		const result = await tool.execute({ action: "read", path: "/etc/passwd" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Access denied");
	});
});
