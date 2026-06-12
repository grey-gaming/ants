import type { ToolResult } from "@ants/tools";
import { logger } from "@ants/core";

export class WebSearch {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  async search(query: string): Promise<ToolResult> {
    logger.info(`Web search for: ${query}`);
    return {
      success: true,
      data: [{ title: query, url: "", snippet: query }],
    };
  }
}
