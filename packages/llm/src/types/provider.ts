export interface Message {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface ChatResult {
  content: string;
  tokens: number;
  metadata?: Record<string, unknown>;
}

export interface StreamChunk {
  content: string;
  done: boolean;
  tokens?: number;
}

export interface LLMProvider {
  chatCompletion(messages: Message[]): Promise<ChatResult>;
  streamChatCompletion(messages: Message[]): AsyncIterable<StreamChunk>;
}
