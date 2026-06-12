import { describe, test, expect } from "bun:test";
import { countTokens } from "./utils/token-counter";
import { sseFormat, createSSEStream } from "./utils/stream-utils";

describe("countTokens", () => {
  test("empty string returns 0", () => {
    expect(countTokens("")).toBe(0);
  });

  test("4 chars returns 1 token", () => {
    expect(countTokens("abcd")).toBe(1);
  });

  test("5 chars returns 2 tokens", () => {
    expect(countTokens("abcde")).toBe(2);
  });

  test("100 chars returns 25 tokens", () => {
    expect(countTokens("a".repeat(100))).toBe(25);
  });

  test("deterministic for same input", () => {
    const input = "hello world";
    expect(countTokens(input)).toBe(countTokens(input));
  });
});

describe("sseFormat", () => {
  test("formats object data", () => {
    const result = sseFormat({ content: "hello", done: false });
    expect(result).toBe('event:\ndata: {"content":"hello","done":false}\n\n');
  });

  test("formats simple string data", () => {
    const result = sseFormat("plain text");
    expect(result).toBe('event:\ndata: "plain text"\n\n');
  });

  test("formats end marker", () => {
    const result = sseFormat({ done: true });
    expect(result).toBe("event:\ndata: {\"done\":true}\n\n");
  });

  test("escapes special characters in string content", () => {
    const result = sseFormat({ content: 'hello\nworld' });
    expect(result).toBe('event:\ndata: {"content":"hello\\nworld"}\n\n');
  });
});

describe("createSSEStream", () => {
  test("transforms async iterable items into SSE strings", async () => {
    const chunks = [{ content: "a" }, { content: "b" }];
    const items: string[] = [];

    async function* source() {
      for (const chunk of chunks) {
        yield chunk;
      }
    }

    for await (const sse of createSSEStream(source())) {
      items.push(sse);
    }

    expect(items).toHaveLength(2);
    expect(items[0]).toBe('event:\ndata: {"content":"a"}\n\n');
    expect(items[1]).toBe('event:\ndata: {"content":"b"}\n\n');
  });

  test("handles empty async iterable", async () => {
    async function* emptySource() {
      return;
    }

    const items: string[] = [];
    for await (const sse of createSSEStream(emptySource())) {
      items.push(sse);
    }
    expect(items).toHaveLength(0);
  });
});
