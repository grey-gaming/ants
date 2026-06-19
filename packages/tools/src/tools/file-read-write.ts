import {
	existsSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { isAbsolute, resolve } from "node:path";
import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

const MAX_FILE_SIZE = 1024 * 1024; // 1MB

export class FileReadWrite extends BaseTool<typeof FileReadWrite.parameters> {
	name = "file-read-write";
	description =
		"Read files, write files, and list directories. Actions: 'read' (read file content), 'write' (write/overwrite file), 'list' (list directory contents). Paths should be absolute.";
	static parameters = z.object({
		action: z.enum(["read", "write", "list"]),
		path: z.string().min(1),
		content: z.string().optional(),
		recursive: z.boolean().optional(),
	});
	parameters = FileReadWrite.parameters;

	protected async _execute(
		input: z.infer<typeof FileReadWrite.parameters>,
	): Promise<ToolResult> {
		const { action, path: filePath } = input;

		try {
			const resolved = this.resolvePath(filePath);
			this.validatePath(resolved);

			switch (action) {
				case "read":
					return this.readFile(resolved);
				case "write":
					return this.writeFile(resolved, input.content ?? "");
				case "list":
					return this.listDirectory(resolved, input.recursive ?? false);
			}
		} catch (err) {
			return {
				success: false,
				error: err instanceof Error ? err.message : String(err),
			};
		}
	}

	private readFile(path: string): ToolResult {
		if (!existsSync(path)) {
			return { success: false, error: `File not found: ${path}` };
		}
		const stat = statSync(path);
		if (!stat.isFile()) {
			return { success: false, error: `Path is not a file: ${path}` };
		}
		if (stat.size > MAX_FILE_SIZE) {
			return {
				success: false,
				error: `File too large (${stat.size} bytes, max ${MAX_FILE_SIZE})`,
			};
		}
		const content = readFileSync(path, "utf-8");
		return { success: true, data: { path, size: stat.size, content } };
	}

	private writeFile(path: string, content: string): ToolResult {
		try {
			writeFileSync(path, content, "utf-8");
			return { success: true, data: { path, written: content.length } };
		} catch (err) {
			return {
				success: false,
				error: `Write failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}

	private listDirectory(path: string, recursive: boolean): ToolResult {
		if (!existsSync(path)) {
			return { success: false, error: `Directory not found: ${path}` };
		}
		if (!statSync(path).isDirectory()) {
			return { success: false, error: `Path is not a directory: ${path}` };
		}
		const entries = readdirSync(path, { withFileTypes: true });
		const items = entries.map((e) => ({
			name: e.name,
			type: e.isDirectory() ? "directory" : e.isFile() ? "file" : "other",
			path: resolve(path, e.name),
		}));

		if (recursive) {
			const results: typeof items = [];
			const traverse = (dir: string) => {
				const subEntries = readdirSync(dir, { withFileTypes: true });
				for (const entry of subEntries) {
					const entryPath = resolve(dir, entry.name);
					results.push({
						name: entry.name,
						type: entry.isDirectory()
							? "directory"
							: entry.isFile()
								? "file"
								: "other",
						path: entryPath,
					});
					if (entry.isDirectory()) {
						traverse(entryPath);
					}
				}
			};
			const dirs = items.filter((i) => i.type === "directory");
			for (const dir of dirs) {
				traverse(dir.path as string);
			}
			items.push(...results);
		}

		return { success: true, data: { path, items } };
	}

	private resolvePath(filePath: string): string {
		if (isAbsolute(filePath)) {
			return resolve(filePath);
		}
		return resolve(process.cwd(), filePath);
	}

	private validatePath(path: string): void {
		const restricted = ["/etc/passwd", "/etc/shadow", "/proc", "/sys", "/dev"];
		for (const r of restricted) {
			if (path.startsWith(r)) {
				throw new Error(`Access denied to restricted path: ${r}`);
			}
		}
	}
}
