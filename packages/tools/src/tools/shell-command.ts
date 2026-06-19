import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

const execAsync = promisify(exec);

const DANGEROUS_COMMANDS = [
	"rm -rf /",
	"mkfs",
	"dd if=",
	"sudo ",
	"su ",
	"chmod -R 777 /",
	"fdisk",
	"dd of=",
	"> /dev/",
	">> /dev/",
];

export class ShellCommand extends BaseTool<typeof ShellCommand.parameters> {
	name = "shell-command";
	description =
		"Execute a shell command and return stdout/stderr. Commands run in a sandboxed subprocess with a timeout. Destructive commands are blocked.";
	static parameters = z.object({
		command: z.string().min(1).max(500),
		timeout: z.number().int().min(1).max(120).optional(),
	});
	parameters = ShellCommand.parameters;

	protected async _execute(
		input: z.infer<typeof ShellCommand.parameters>,
	): Promise<ToolResult> {
		const { command, timeout = 30 } = input;

		// Block dangerous commands
		const cmd = command.toLowerCase();
		for (const dangerous of DANGEROUS_COMMANDS) {
			if (cmd.includes(dangerous.toLowerCase())) {
				return {
					success: false,
					error: `Command blocked for safety: contains '${dangerous}'`,
				};
			}
		}

		try {
			const { stdout, stderr } = await execAsync(command, {
				timeout: timeout * 1000,
				maxBuffer: 1024 * 1024, // 1MB output limit
				shell: "/bin/bash",
			});

			const output: Record<string, string> = {};
			if (stdout) output.stdout = stdout.trim();
			if (stderr) output.stderr = stderr.trim();

			return { success: true, data: { command, output, exitCode: 0 } };
		} catch (err: any) {
			return {
				success: false,
				error: err.signal
					? `Command timed out after ${timeout}s`
					: `Command failed (exit ${err.code ?? "?"}): ${err.message}`,
			};
		}
	}
}
