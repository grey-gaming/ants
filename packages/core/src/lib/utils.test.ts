import { describe, test, expect } from "bun:test";
import { generateId, estimateTokens, truncateOutput } from "./utils";

describe("generateId", () => {
  test("returns a valid UUID v4 string", () => {
    const id = generateId();
    expect(typeof id).toBe("string");
    expect(id).toMatch(
      /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
    );
   });

  test("generates unique IDs", () => {
    const ids = new Set([generateId(), generateId(), generateId()]);
    expect(ids.size).toBe(3);
   });
});

describe("estimateTokens", () => {
  test("counts 4 chars as 1 token", () => {
    expect(estimateTokens("abcd")).toBe(1);
   });

  test("counts 5 chars as 2 tokens", () => {
    expect(estimateTokens("abcde")).toBe(2);
   });

  test("empty string returns 0", () => {
    expect(estimateTokens("")).toBe(0);
   });

  test("large text", () => {
    expect(estimateTokens("a".repeat(100))).toBe(25);
   });
});

describe("truncateOutput", () => {
  test("returns original text when within limit", () => {
    expect(truncateOutput("hello", 10)).toBe("hello");
   });

  test("truncates at exact limit", () => {
    const result = truncateOutput("hello world", 5);
    expect(result).toBe("hello[TRUNCATED]");
   });

  test("does not append marker when text equals limit", () => {
    expect(truncateOutput("hello", 5)).toBe("hello");
   });
});
