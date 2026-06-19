import { ValidationError } from "@ants/core";
import { generateText, streamText } from "ai";
import { z } from "zod";
import type {
	ChatResult,
	LLMProvider,
	Message,
	StreamChunk,
} from "../types/provider";
import { countTokens } from "../utils/token-counter";

const MlxConfigSchema = z.object({
	baseUrl: z.string().min(1).default("http://localhost:8080"),
	modelName: z
		.string()
		.min(1)
		.default("mlx-community/Llama-3.2-3B-Instruct-4bit"),
	contextWindow: z.number().positive().default(32000),
	temperature: z.number().min(0).max(2).optional(),
	maxTokens: z.number().positive().optional(),
});

export type MlxConfig = z.infer<typeof MlxConfigSchema>;

function convertToOpenAIMessages(messages: Message[]): Array<{
	role: string;
	content: string;
}> {
	return messages.map((m) => ({
		role: m.role === "assistant" ? "assistant" : m.role,
		content: m.content,
	}));
}

export class MlxProvider implements LLMProvider {
	private readonly baseUrl: string;
	private readonly modelName: string;
	private readonly contextWindow: number;
	private readonly temperature?: number;
	private readonly maxTokens?: number;

	constructor(config: MlxConfig) {
		const parsed = MlxConfigSchema.parse(config);
		this.baseUrl = parsed.baseUrl.replace(/\/+$/, "");
		this.modelName = parsed.modelName;
		this.contextWindow = parsed.contextWindow;
		this.temperature = parsed.temperature;
		this.maxTokens = parsed.maxTokens;
	}

	async chatCompletion(messages: Message[]): Promise<ChatResult> {
		const inputTokens = countMessagesTokens(messages);
		if (inputTokens > this.contextWindow) {
			throw new ValidationError(
				`Input tokens (${inputTokens}) exceed context window (${this.contextWindow})`,
			);
		}

		const body: Record<string, unknown> = {
			model: this.modelName,
			messages: convertToOpenAIMessages(messages),
			stream: false,
		};

		if (this.temperature !== undefined) body.temperature = this.temperature;
		if (this.maxTokens !== undefined) body.max_tokens = this.maxTokens;

		const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(
				`MLX chat error: ${response.status} ${response.statusText} - ${text}`,
			);
		}

		const json = (await response.json()) as MlxChatResponse;
		const choice = json.choices?.[0];
		const content = choice?.message?.content ?? "";

		return {
			content,
			tokens: json.usage?.total_tokens ?? 0,
			metadata: {
				model: this.modelName,
				finishReason: choice?.finish_reason,
				inputTokens: json.usage?.prompt_tokens,
				outputTokens: json.usage?.completion_tokens,
			},
		};
	}

	async *streamChatCompletion(messages: Message[]): AsyncIterable<StreamChunk> {
		const inputTokens = countMessagesTokens(messages);
		if (inputTokens > this.contextWindow) {
			throw new ValidationError(
				`Input tokens (${inputTokens}) exceed context window (${this.contextWindow})`,
			);
		}

		const body: Record<string, unknown> = {
			model: this.modelName,
			messages: convertToOpenAIMessages(messages),
			stream: true,
		};

		if (this.temperature !== undefined) body.temperature = this.temperature;
		if (this.maxTokens !== undefined) body.max_tokens = this.maxTokens;

		const response = await fetch(`${this.baseUrl}/v1/chat/completions`, {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify(body),
		});

		if (!response.ok) {
			const text = await response.text().catch(() => "");
			throw new Error(
				`MLX stream error: ${response.status} ${response.statusText} - ${text}`,
			);
		}

		const reader = response.body?.getReader();
		if (!reader) throw new Error("MLX response body is not readable");

		const decoder = new TextDecoder();
		let buffer = "";
		let totalTokens = 0;

		while (true) {
			const { done, value } = await reader.read();
			if (done) break;

			buffer += decoder.decode(value, { stream: true });
			const lines = buffer.split("\n");
			buffer = lines.pop() ?? "";

			for (const line of lines) {
				if (!line.trim() || !line.startsWith("data: ")) continue;
				const data = line.slice(6);
				if (data === "[DONE]") {
					yield { content: "", done: true, tokens: totalTokens };
					return;
				}

				try {
					const chunk = JSON.parse(data) as MlxStreamChunk;
					const delta = chunk.choices?.[0]?.delta?.content;
					if (delta) {
						yield { content: delta, done: false };
						totalTokens++;
					}
				} catch {
					// Skip malformed chunks
				}
			}
		}
	}
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface MlxChatResponse {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		message: { role: string; content: string };
		finish_reason: string | null;
	}>;
	usage?: {
		prompt_tokens: number;
		completion_tokens: number;
		total_tokens: number;
	};
}

interface MlxStreamChunk {
	id: string;
	object: string;
	created: number;
	model: string;
	choices: Array<{
		index: number;
		delta: { role?: string; content?: string };
		finish_reason: string | null;
	}>;
}

function countMessagesTokens(messages: Message[]): number {
	return messages.reduce((sum, msg) => sum + countTokens(msg.content), 0);
}
