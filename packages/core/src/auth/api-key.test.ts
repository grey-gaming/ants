import { describe, test, expect } from "bun:test";
import { extractKeyPrefix } from "./api-key";

describe("extractKeyPrefix", () => {
  test("extracts first 8 hex chars after sk_ prefix", () => {
    const key = "sk_a1b2c3d4e5f67890a1b2c3d4e5f67890";
    expect(extractKeyPrefix(key)).toBe("a1b2c3d4");
  });

  test("handles a full-length 64-hex-char key", () => {
    const hex64 = "a".repeat(64);
    const key = `sk_${hex64}`;
    expect(extractKeyPrefix(key)).toBe("aaaaaaaa");
  });

  test("returns shorter string for short keys", () => {
    expect(extractKeyPrefix("sk_abcd")).toBe("abcd");
  });

  test("returns empty string for just the prefix", () => {
    expect(extractKeyPrefix("sk_")).toBe("");
  });
});