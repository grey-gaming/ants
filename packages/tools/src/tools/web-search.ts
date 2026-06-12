import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

export class WebSearch extends BaseTool<typeof WebSearch.parameters> {
  name = "web-search";
  description = "Search the web for relevant information";
  static parameters = z.object({
    query: z.string().min(1),
    numResults: z.number().int().min(1).max(10).optional(),
  });
  parameters = WebSearch.parameters;

  protected async _execute(
    input: z.infer<typeof WebSearch.parameters>
  ): Promise<ToolResult> {
    const { query, numResults = 5 } = input;

    const baseUrl =
      process.env.SEARCH_API_URL ?? "https://html.duckduckgo.com/html/";
    const url = `${baseUrl}?q=${encodeURIComponent(query)}&count=${numResults}`;

    let response: Response;

    try {
      response = await fetch(url);
    } catch (err) {
      return {
        success: false,
        error: `Network error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    if (!response.ok) {
      return {
        success: false,
        error: `HTTP ${response.status}: ${response.statusText}`,
      };
    }

    try {
      const body = await response.text();
      const results = this.parseResponse(body, numResults);
      return { success: true, data: results };
    } catch (err) {
      return {
        success: false,
        error: `Parse error: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  private parseResponse(body: string, limit: number) {
    const results: Array<{ title: string; url: string; snippet: string }> = [];

    const articleRegex = /<a class="result__a" href="(.*?)".*?>(.*?)<\/a>.*?<a class="result__snippet"(?:.*?>(.*?)<\/a>)/gs;
    let match;

    while ((match = articleRegex.exec(body)) !== null && results.length < limit) {
      const url = match[1];
      const title = match[2];
      const snippet = match[3];

      if (title && title.trim()) {
        results.push({
          title: this.stripHtml(title),
          url,
          snippet: this.stripHtml(snippet),
        });
      }
    }

    return results;
  }

  private stripHtml(html: string) {
    return html.replace(/<[^>]*>/g, "").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').trim();
  }
}
