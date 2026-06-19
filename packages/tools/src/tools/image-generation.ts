import { exec } from "node:child_process";
import { promisify } from "node:util";
import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

const execAsync = promisify(exec);

export class ImageGeneration extends BaseTool<
	typeof ImageGeneration.parameters
> {
	name = "image-generation";
	description =
		"Generate images from text descriptions. Uses draw-things-cli for local generation on macOS. Falls back to a helpful error if not available. Set IMAGE_GEN_MODEL env var for model selection.";
	static parameters = z.object({
		prompt: z.string().min(1).max(1000),
		width: z.number().int().min(64).max(2048).optional(),
		height: z.number().int().min(64).max(2048).optional(),
		steps: z.number().int().min(1).max(100).optional(),
		seed: z.number().int().optional(),
		model: z.string().optional(),
	});
	parameters = ImageGeneration.parameters;

	protected async _execute(
		input: z.infer<typeof ImageGeneration.parameters>,
	): Promise<ToolResult> {
		const {
			prompt,
			width = 1024,
			height = 1024,
			steps = 20,
			seed = 42,
			model = process.env.IMAGE_GEN_MODEL || "flux_2_klein_4b_q6p.ckpt",
		} = input;

		const outputDir = "/tmp/ants-image-gen";
		const outputPath = `${outputDir}/${Date.now()}.png`;

		try {
			// Check if draw-things-cli is available
			await execAsync("which draw-things-cli");

			const escapedPrompt = prompt.replace(/"/g, '\\"');
			const cmd = `draw-things-cli generate --model "${model}" --prompt "${escapedPrompt}" --width ${width} --height ${height} --steps ${steps} --seed ${seed} -o "${outputPath}"`;

			await execAsync(cmd, { timeout: 300000, maxBuffer: 10 * 1024 * 1024 });

			return {
				success: true,
				data: { prompt, outputPath, width, height, model },
			};
		} catch (err: any) {
			if (
				err.code === 127 ||
				(err.message && err.message.includes("not found"))
			) {
				return {
					success: false,
					error:
						"Image generation not available. Install draw-things-cli: brew install liuliu/draw-things-cli/draw-things-cli",
				};
			}
			return {
				success: false,
				error: `Image generation failed: ${err.message || String(err)}`,
			};
		}
	}
}
