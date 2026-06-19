import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

export class WebSearch extends BaseTool<typeof WebSearch.parameters> {
	name = "web-search";
	description =
		"Search the web for relevant information. Uses multiple search backends for reliability. Set SEARCH_API_URL to a SearXNG instance for custom search.";
	lastError: string | undefined;
	static parameters = z.object({
		query: z.string().min(1),
		numResults: z.number().int().min(1).max(10).optional(),
	});
	parameters = WebSearch.parameters;

	protected async _execute(
		input: z.infer<typeof WebSearch.parameters>,
	): Promise<ToolResult> {
		const { query, numResults = 5 } = input;

		this.lastError = undefined;
		const allResults: Array<{ title: string; url: string; snippet: string }> =
			[];

		// 1. Try DuckDuckGo Instant Answer API
		const ddgResults = await this.searchDuckDuckGo(query, numResults);
		if (ddgResults.length > 0) {
			allResults.push(...ddgResults);
		}

		// 2. Try Wikipedia API
		const wikiResults = await this.searchWikipedia(query, numResults);
		if (wikiResults.length > 0) {
			allResults.push(...wikiResults);
		}

		// 3. Try custom SearXNG instance if configured
		if (process.env.SEARCH_API_URL && allResults.length < numResults) {
			const searxResults = await this.searchSearXNG(
				process.env.SEARCH_API_URL,
				query,
				numResults - allResults.length,
			);
			if (searxResults.length > 0) {
				allResults.push(...searxResults);
			}
		}

		// Deduplicate by URL
		const seen = new Set<string>();
		const unique: typeof allResults = [];
		for (const r of allResults) {
			if (!seen.has(r.url)) {
				seen.add(r.url);
				unique.push(r);
			}
		}

		if (unique.length === 0) {
			if (this.lastError) {
				return { success: false, error: this.lastError };
			}
			return {
				success: false,
				error:
					"No search results found. Check your internet connection or set SEARCH_API_URL to a SearXNG instance.",
			};
		}

		return { success: true, data: unique.slice(0, numResults) };
	}

	private async searchDuckDuckGo(
		query: string,
		limit: number,
	): Promise<Array<{ title: string; url: string; snippet: string }>> {
		try {
			const url = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_redirect=1&no_html=1`;
			const response = await fetch(url, {
				signal: AbortSignal.timeout(8000),
				headers: {
					"User-Agent":
						"Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36",
				},
			});

			if (!response.ok) return [];

			const data = await response.json();
			const results: Array<{ title: string; url: string; snippet: string }> =
				[];

			// Instant answer / related topics
			if (data.RelatedTopics && Array.isArray(data.RelatedTopics)) {
				for (const topic of data.RelatedTopics) {
					if (results.length >= limit) break;
					if (topic.FirstParagraphString && topic.Text && topic.FirstURL) {
						results.push({
							title: this.stripHtml(topic.Text),
							url: topic.FirstURL,
							snippet: this.stripHtml(topic.FirstParagraphString),
						});
					} else if (topic.Topics && Array.isArray(topic.Topics)) {
						for (const sub of topic.Topics) {
							if (results.length >= limit) break;
							if (sub.Text && sub.FirstURL) {
								results.push({
									title: this.stripHtml(sub.Text),
									url: sub.FirstURL,
									snippet: sub.FirstParagraphString
										? this.stripHtml(sub.FirstParagraphString)
										: "",
								});
							}
						}
					}
				}
			}

			// Abstrct (instant answer)
			if (data.AbstractURL && data.Abstract) {
				results.unshift({
					title: data.Heading || data.AbstractSource || "Instant Answer",
					url: data.AbstractURL,
					snippet: this.stripHtml(data.Abstract),
				});
			}

			return results;
		} catch {
			this.lastError =
				"Network error: Failed to reach search backend (DuckDuckGo).";
			return [];
		}
	}

	private async searchWikipedia(
		query: string,
		limit: number,
	): Promise<Array<{ title: string; url: string; snippet: string }>> {
		try {
			const url = `https://en.wikipedia.org/w/api.php?action=opensearch&search=${encodeURIComponent(query)}&limit=${limit}&format=json&origin=*`;
			const response = await fetch(url, {
				signal: AbortSignal.timeout(8000),
			});

			if (!response.ok) return [];

			const data = await response.json();
			// OpenSearch returns [query, [titles], [descriptions], [urls]]
			const titles = data[1] || [];
			const descriptions = data[2] || [];
			const urls = data[3] || [];

			const results: Array<{ title: string; url: string; snippet: string }> =
				[];
			for (let i = 0; i < titles.length && i < limit; i++) {
				results.push({
					title: titles[i],
					url: urls[i],
					snippet: descriptions[i] || "",
				});
			}

			return results;
		} catch {
			this.lastError =
				"Network error: Failed to reach search backend (Wikipedia).";
			return [];
		}
	}

	private async searchSearXNG(
		baseUrl: string,
		query: string,
		limit: number,
	): Promise<Array<{ title: string; url: string; snippet: string }>> {
		try {
			const url = `${baseUrl}/search?q=${encodeURIComponent(query)}&format=json&categories=general`;
			const response = await fetch(url, {
				signal: AbortSignal.timeout(10000),
			});

			if (!response.ok) return [];

			const data = await response.json();
			const results: Array<{ title: string; url: string; snippet: string }> =
				[];

			const resultsArr = data.results || [];
			for (const r of resultsArr.slice(0, limit)) {
				if (r.title && r.url) {
					results.push({
						title: r.title,
						url: r.url,
						snippet: r.content || "",
					});
				}
			}

			return results;
		} catch {
			this.lastError =
				"Network error: Failed to reach custom search backend (SearXNG).";
			return [];
		}
	}

	private stripHtml(html: string): string {
		return html
			.replace(/<[^>]*>/g, "")
			.replace(/&amp;/g, "&")
			.replace(/&lt;/g, "<")
			.replace(/&gt;/g, ">")
			.replace(/&quot;/g, '"')
			.trim();
	}
}
