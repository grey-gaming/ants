import type {
	LanguageModelV3,
	LanguageModelV3CallOptions,
	LanguageModelV3Content,
	LanguageModelV3FinishReason,
	LanguageModelV3GenerateResult,
	LanguageModelV3Prompt,
	LanguageModelV3StreamPart,
	LanguageModelV3StreamResult,
	LanguageModelV3Text,
	LanguageModelV3ToolCall,
	LanguageModelV3Usage,
} from "@ai-sdk/provider";

type OllamaApiMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content?: string;
	tool_calls?: OllamaToolCall[];
};

type OllamaToolCall = {
	function: {
		name: string;
		arguments: unknown;
	};
};

interface OllamaNonStreamResponse {
	model: string;
	created_at: string;
	message?: {
		role: string;
		content?: string;
		tool_calls?: OllamaToolCall[];
	};
	done: boolean;
	total_duration?: number;
	load_duration?: number;
	prompt_eval_count?: number;
	eval_count?: number;
	eval_duration?: number;
}

interface OllamaStreamChunk {
	model: string;
	created_at: string;
	message?: {
		role: string;
		content?: string;
		tool_calls?: OllamaToolCall[];
	};
	done: boolean;
	total_duration?: number;
	load_duration?: number;
	prompt_eval_count?: number;
	eval_count?: number;
	eval_duration?: number;
}

export function ollamaLanguageModel(
	baseUrl: string,
	modelName: string,
): LanguageModelV3 {
	const normalizedUrl = baseUrl.replace(/\/+$/, "");

	return {
		specificationVersion: "v3",
		provider: "ollama",
		modelId: modelName,
		supportedUrls: {},

		async doGenerate(callOptions: LanguageModelV3CallOptions) {
			const converted = convertToOllamaMessages(callOptions.prompt);
			const response = await fetch(`${normalizedUrl}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: modelName,
					messages: converted,
					stream: false,
					options: prepareOptions(callOptions),
				}),
			});

			if (!response.ok) {
				const text = await response.text().catch(() => "");
				throw new Error(
					`Ollama chat error: ${response.status} ${response.statusText} - ${text}`,
				);
			}

			const body = (await response.json()) as OllamaNonStreamResponse;
			return buildNonStreamResult(body, modelName, callOptions);
		},

		async doStream(callOptions: LanguageModelV3CallOptions) {
			const converted = convertToOllamaMessages(callOptions.prompt);
			const response = await fetch(`${normalizedUrl}/api/chat`, {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					model: modelName,
					messages: converted,
					stream: true,
					options: prepareOptions(callOptions),
				}),
			});

			if (!response.ok) {
				const text = await response.text().catch(() => "");
				throw new Error(
					`Ollama stream error: ${response.status} ${response.statusText} - ${text}`,
				);
			}

			const reader = response.body?.getReader();
			if (!reader) {
				throw new Error("Ollama response body is not readable");
			}

			const decoder = new TextDecoder();
			let buffer = "";
			let totalInput = 0;
			let totalOutput = 0;

			const readableStream = new ReadableStream<LanguageModelV3StreamPart>({
				start(controller) {
					(async () => {
						try {
							while (true) {
								const { done, value } = await reader.read();
								if (done) break;

								buffer += decoder.decode(value, { stream: true });
								const lines = buffer.split("\n");
								buffer = lines.pop() ?? "";

								for (const line of lines) {
									if (!line.trim()) continue;
									let chunk: OllamaStreamChunk;
									try {
										chunk = JSON.parse(line);
									} catch {
										continue;
									}

									if (chunk.message?.content) {
										controller.enqueue({
											type: "text-delta",
											id: "1",
											delta: chunk.message.content,
										});
									}

									if (chunk.done) {
										totalInput = chunk.prompt_eval_count ?? 0;
										totalOutput = chunk.eval_count ?? 0;
										controller.enqueue({
											type: "finish",
											finishReason: { unified: "stop", raw: undefined },
											usage: buildUsage(totalInput, totalOutput),
										});
										break;
									}
								}
							}
						} catch (error) {
							controller.error(error);
						} finally {
							reader.releaseLock();
						}
						controller.close();
					})();
				},
			});

			return {
				stream: readableStream,
				finishReason: { unified: "stop", raw: undefined },
				usage: buildUsage(totalInput, totalOutput),
				prompt: callOptions.prompt,
			};
		},
	};
}

function buildUsage(input: number, output: number): LanguageModelV3Usage {
	return {
		inputTokens: {
			total: input,
			noCache: undefined,
			cacheRead: undefined,
			cacheWrite: undefined,
		},
		outputTokens: { total: output, text: undefined, reasoning: undefined },
	};
}

function convertToOllamaMessages(
	prompt: LanguageModelV3Prompt,
): OllamaApiMessage[] {
	return prompt.map((part) => {
		if (typeof part.content === "string") {
			return { role: part.role, content: part.content };
		}

		if (part.role === "assistant") {
			const textParts = part.content.filter(
				(cp): cp is LanguageModelV3Text & { type: "text" } =>
					cp.type === "text",
			);
			const toolParts = part.content.filter(
				(cp): cp is LanguageModelV3ToolCall & { type: "tool-call" } =>
					cp.type === "tool-call",
			);

			const result: OllamaApiMessage = { role: "assistant" };
			if (textParts.length > 0) {
				result.content = textParts.map((p) => p.text).join("");
			}
			if (toolParts.length > 0) {
				result.tool_calls = toolParts.map((tc) => ({
					function: { name: tc.toolName, arguments: JSON.stringify(tc.input) },
				}));
			}
			return result;
		}

		if (part.role === "tool") {
			const toolContents = part.content.filter(
				(
					tc,
				): tc is (typeof part.content)[number] & {
					type: "tool-result";
					output: { type: "text"; value: string };
				} => tc.type === "tool-result" && tc.output.type === "text",
			);
			return {
				role: "user",
				content: toolContents.map((tc) => tc.output.value).join(""),
			};
		}

		const textParts = part.content.filter(
			(cp): cp is LanguageModelV3Text & { type: "text" } => cp.type === "text",
		);
		return { role: part.role, content: textParts.map((p) => p.text).join("") };
	});
}

function prepareOptions(
	callOptions: LanguageModelV3CallOptions,
): Record<string, unknown> {
	const opts: Record<string, unknown> = {};
	if (callOptions.temperature !== undefined)
		opts.temperature = callOptions.temperature;
	if (callOptions.maxOutputTokens !== undefined)
		opts.max_tokens = callOptions.maxOutputTokens;
	if (callOptions.topP !== undefined) opts.top_p = callOptions.topP;
	if (callOptions.stopSequences) opts.stop = callOptions.stopSequences;
	return opts;
}

function buildNonStreamResult(
	body: OllamaNonStreamResponse,
	modelId: string,
	callOptions: LanguageModelV3CallOptions,
): LanguageModelV3GenerateResult {
	const message = body.message;
	const content: LanguageModelV3Content[] = [];

	if (message?.content) {
		content.push({ type: "text", text: message.content });
	}

	if (message?.tool_calls) {
		for (const tc of message.tool_calls) {
			let parsedArgs: unknown;
			try {
				parsedArgs = JSON.parse(JSON.stringify(tc.function.arguments));
			} catch {
				parsedArgs = tc.function.arguments;
			}
			content.push({
				type: "tool-call",
				toolCallId: `toolu_${tc.function.name}`,
				toolName: tc.function.name,
				input: JSON.stringify(parsedArgs),
			});
		}
	}

	const inputTokens = body.prompt_eval_count ?? 0;
	const outputTokens = body.eval_count ?? 0;
	const hasToolCalls = message?.tool_calls && message.tool_calls.length > 0;

	return {
		content,
		finishReason: hasToolCalls
			? { unified: "tool-calls", raw: undefined }
			: { unified: "stop", raw: undefined },
		usage: buildUsage(inputTokens, outputTokens),
		warnings: [],
		response: {
			id: `ollama-${body.created_at}`,
			modelId: modelId,
			timestamp: body.created_at ? new Date(body.created_at) : undefined,
		},
	};
}
