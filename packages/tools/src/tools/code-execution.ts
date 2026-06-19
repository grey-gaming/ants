import { exec } from "node:child_process";
import { rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { promisify } from "node:util";
import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

const execAsync = promisify(exec);

const DANGEROUS_IMPORTS = [
	"import os",
	"import subprocess",
	"import shutil",
	"import socket",
	"import http",
	"import requests",
	"import urllib",
	"import ftp",
	"from os",
	"from subprocess",
	"from shutil",
	"from socket",
	"from http",
	"from requests",
	"from urllib",
	"from ftp",
];

export class CodeExecution extends BaseTool<typeof CodeExecution.parameters> {
	name = "code-execution";
	description =
		"Execute Python code in a sandboxed subprocess. The code should print its output to stdout. Has a 30-second timeout. Cannot install packages or access the network.";
	static parameters = z.object({
		code: z.string().min(1).max(10000),
		timeout: z.number().int().min(1).max(60).optional(),
	});
	parameters = CodeExecution.parameters;

	protected async _execute(
		input: z.infer<typeof CodeExecution.parameters>,
	): Promise<ToolResult> {
		const { code, timeout = 30 } = input;

		// Block dangerous imports
		const lines = code.split("\n");
		for (const line of lines) {
			const trimmed = line.trim().toLowerCase();
			for (const dangerous of DANGEROUS_IMPORTS) {
				if (trimmed.includes(dangerous)) {
					return {
						success: false,
						error: `Code blocked for safety: disallows '${dangerous}'`,
					};
				}
			}
		}

		try {
			// Write code to temp file to handle multi-line properly
			const tmpFile = join(
				tmpdir(),
				`ants-code-${Date.now()}-${Math.random().toString(36).slice(2)}.py`,
			);
			writeFileSync(tmpFile, code, "utf-8");

			const { stdout, stderr } = await execAsync(`python3 "${tmpFile}"`, {
				timeout: timeout * 1000,
				maxBuffer: 1024 * 1024,
			});

			rmSync(tmpFile, { force: true });

			const output: Record<string, string> = {};
			if (stdout) output.stdout = stdout.trim();
			if (stderr) output.stderr = stderr.trim();

			return { success: true, data: { output, exitCode: 0 } };
		} catch (err: any) {
			return {
				success: false,
				error: err.signal
					? `Code execution timed out after ${timeout}s`
					: `Execution error: ${err.stderr || err.message}`,
			};
		}
	}
}
