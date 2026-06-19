import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

export class WebScraping extends BaseTool<typeof WebScraping.parameters> {
	name = "web-scraping";
	description =
		"Fetch and extract content from a web URL. Returns the page content as cleaned text. Supports HTML and plain text pages. Has a 15-second timeout.";
	static parameters = z.object({
		url: z.string().url(),
		maxChars: z.number().int().min(100).max(50000).optional(),
	});
	parameters = WebScraping.parameters;

	protected async _execute(
		input: z.infer<typeof WebScraping.parameters>,
	): Promise<ToolResult> {
		const { url, maxChars = 10000 } = input;

		try {
			const response = await fetch(url, {
				headers: { "User-Agent": "ANTs-Agent/1.0" },
				signal: AbortSignal.timeout(15000),
			});

			if (!response.ok) {
				return {
					success: false,
					error: `HTTP ${response.status}: ${response.statusText}`,
				};
			}

			const contentType = response.headers.get("content-type") || "";
			let content: string;

			if (contentType.includes("text/html")) {
				const html = await response.text();
				content = this.htmlToText(html);
			} else {
				content = await response.text();
			}

			if (content.length > maxChars) {
				content = content.slice(0, maxChars) + "\n\n... [truncated]";
			}

			return {
				success: true,
				data: { url, content, charCount: content.length },
			};
		} catch (err) {
			return {
				success: false,
				error: `Fetch failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}

	private htmlToText(html: string): string {
		return html
			.replace(/<script[\s\S]*?<\/script>/gi, "")
			.replace(/<style[\s\S]*?<\/style>/gi, "")
			.replace(/<br\s*\/?>/gi, "\n")
			.replace(/<\/?(p|div|h[1-6]|li|tr)>/gi, "\n")
			.replace(/<\/?[^>]+>/g, "")
			.replace(/&nbsp;/g, " ")
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/\n{3,}/g, "\n\n")
			.trim();
	}
}
