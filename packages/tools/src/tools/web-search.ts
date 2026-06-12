import type { ToolResult } from "@ants/tools";
import { BaseTool } from "@ants/tools";
import { logger } from "@ants/core";
import { z } from "zod";

interface SearchResult {
  title: string;
  url: string;
  snippet: string;
}

export class WebSearch extends BaseTool {
  name = "web-search";
  description = "Search the web for information";

  static parameters = z.object({
    query: z.string().min(1),
    numResults: z.number().int().min(1).max(10).default(5),
  });

  parameters = WebSearch.parameters;

  constructor() {
    super({ name: "web-search", description: "Search the web for information" });
  }

  protected async _execute(input: unknown): Promise<ToolResult> {
    const { query, numResults } = WebSearch.parameters.parse(input);
    const baseUrl = process.env.SEARCH_API_URL ?? "https://api.duckduckgo.com/html";
    const url = `${baseUrl}?q=${encodeURIComponent(query)}&count=${numResults}`;

    logger.info("web-search", `Searching for: ${query}`);

    let response: Response;
    try {
      response = await fetch(url);
    } catch {
      return { success: false, error: "Network error: failed to reach search API" };
    }

    if (!response.ok) {
      return { success: false, error: `HTTP ${response.status}: ${response.statusText}` };
    }

    const html = await response.text();
    const results = parseSearchResults(html);
    return { success: true, data: results };
  }
}

function parseSearchResults(html: string): SearchResult[] {
  const results: SearchResult[] = [];
  const titleRegex = /class="result__a"[^>]*href="([^"]+)"[^>]*>([^<]+)<\/a>/g;
  const snippetRegex = /class="result__snippet"[^>]*>([^<]+)<\/a>/g;

  const titles: { url: string; title: string }[] = [];
  const snippets: string[] = [];

  let match: RegExpExecArray | null;
  while ((match = titleRegex.exec(html)) !== null) {
    titles.push({ url: match[1], title: match[2] });
  }
  while ((match = snippetRegex.exec(html)) !== null) {
    snippets.push(match[1]);
  }

  const count = Math.min(titles.length, snippets.length);
  for (let i = 0; i < count; i++) {
    results.push({
      title: titles[i].title,
      url: titles[i].url,
      snippet: snippets[i],
    });
  }

  return results;
}
