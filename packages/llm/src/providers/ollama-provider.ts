import { z } from "zod";
import { type Message, type ChatResult, type StreamChunk, type LLMProvider } from "../types/provider";
import { countTokens } from "../utils/token-counter";
import { ValidationError } from "@ants/core";

const OllamaConfigSchema = z.object({
  baseUrl: z.string(),
  modelName: z.string(),
  contextWindow: z.number().positive(),
});

export type OllamaConfig = z.infer<typeof OllamaConfigSchema>;

export class OllamaProvider implements LLMProvider {
  private readonly baseUrl: string;
  private readonly modelName: string;
  private readonly contextWindow: number;

  constructor(config: OllamaConfig) {
    const parsed = OllamaConfigSchema.parse(config);
    this.baseUrl = parsed.baseUrl.replace(/\/+$/, "");
    this.modelName = parsed.modelName;
    this.contextWindow = parsed.contextWindow;
  }

  async chatCompletion(messages: Message[]): Promise<ChatResult> {
    const inputTokens = countMessagesTokens(messages);
    if (inputTokens > this.contextWindow) {
      throw new ValidationError(
        `Input tokens (${inputTokens}) exceed context window (${this.contextWindow})`,
      );
    }

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelName,
        messages: messages,
        stream: false,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama chat error: ${res.status} ${res.statusText}`);
    }

    const body = await res.json();
    const content = body.message?.content ?? "";
    return {
      content,
      tokens: body.eval_count
        ? body.eval_count + (body.prompt_eval_count || 0)
        : 0,
      metadata: {
        model: this.modelName,
        evaluateCount: body.eval_count || 0,
        predictCount: body.prompt_eval_count || 0,
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

    const res = await fetch(`${this.baseUrl}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: this.modelName,
        messages: messages,
        stream: true,
      }),
    });

    if (!res.ok) {
      throw new Error(`Ollama stream error: ${res.status} ${res.statusText}`);
    }

    const reader = res.body?.getReader();
    if (!reader) {
      throw new Error("Ollama response body is not readable");
    }

    const decoder = new TextDecoder();
    let buffer = "";

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let parsed: any;
          try {
            parsed = JSON.parse(line);
          } catch {
            continue;
          }
          const content = parsed.message?.content ?? "";
          const isDone = parsed.done || false;
          yield {
            content,
            done: isDone,
            tokens: isDone
              ? (parsed.eval_count || 0) + (parsed.prompt_eval_count || 0)
              : undefined,
          };
        }
      }
    } finally {
      reader.releaseLock();
    }
  }
}

function countMessagesTokens(messages: Message[]): number {
  return messages.reduce((sum, msg) => sum + countTokens(msg.content), 0);
}
