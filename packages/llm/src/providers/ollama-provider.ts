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
import { ollamaLanguageModel } from "./ollama-language-model";

const OllamaConfigSchema = z.object({
	baseUrl: z.string(),
	modelName: z.string(),
	contextWindow: z.number().positive(),
});

export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;

export class OllamaProvider implements LLMProvider {
	private readonly languageModel: ReturnType<typeof ollamaLanguageModel>;
	private readonly contextWindow: number;

	constructor(config: OllamaConfig) {
		const parsed = OllamaConfigSchema.parse(config);
		this.languageModel = ollamaLanguageModel(
			parsed.baseUrl.replace(/\/+$/, ""),
			parsed.modelName,
		);
		this.contextWindow = parsed.contextWindow;
	}

	async chatCompletion(messages: Message[]): Promise<ChatResult> {
		const inputTokens = countMessagesTokens(messages);
		if (inputTokens > this.contextWindow) {
			throw new ValidationError(
				`Input tokens (${inputTokens}) exceed context window (${this.contextWindow})`,
			);
		}

		const result = await generateText({
			model: this.languageModel,
			messages: messages as never[],
			maxOutputTokens: this.contextWindow - inputTokens,
		});

		return {
			content: result.text ?? "",
			tokens:
				(result.usage.inputTokens ?? 0) + (result.usage.outputTokens ?? 0),
			metadata: {
				model: this.languageModel.modelId,
				inputTokens: result.usage.inputTokens ?? 0,
				outputTokens: result.usage.outputTokens ?? 0,
				finishReason: result.finishReason,
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

		const streamResult = await streamText({
			model: this.languageModel,
			messages: messages as never[],
			maxOutputTokens: this.contextWindow - inputTokens,
		});

		for await (const text of streamResult.textStream) {
			yield {
				content: text,
				done: false,
			};
		}

		const usage = await streamResult.usage;
		yield {
			content: "",
			done: true,
			tokens: (usage.inputTokens ?? 0) + (usage.outputTokens ?? 0),
		};
	}
}

function countMessagesTokens(messages: Message[]): number {
	return messages.reduce((sum, msg) => sum + countTokens(msg.content), 0);
}
