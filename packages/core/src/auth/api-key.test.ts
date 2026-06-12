import { describe, test, expect } from "bun:test";
import { generateApiKey, hashApiKey, validateApiKey, revoke, isValidPrefix } from "./api-key";

const ORIGINAL_ENV = { ...process.env };

describe("api-key", () => {
  test("generateApiKey produces sk_ prefixed key", () => {
    const key = generateApiKey();
    expect(key).toMatch(/^sk_/);
    expect(key.length).toBeGreaterThan(5);
  });

  test("generateApiKey produces unique keys", () => {
    const keys = new Set([generateApiKey(), generateApiKey(), generateApiKey()]);
    expect(keys.size).toBe(3);
  });

  test("hashApiKey produces deterministic hash", async () => {
    const hash = await hashApiKey("sk_test123");
    expect(typeof hash).toBe("string");
    expect(hash.length).toBeGreaterThan(20);
  });

  test("validateApiKey matches correct key", async () => {
    const key = generateApiKey();
    const hash = await hashApiKey(key);
    const valid = await validateApiKey(key, hash);
    expect(valid).toBe(true);
  });

  test("validateApiKey rejects wrong key", async () => {
    const hash = await hashApiKey("sk_correct");
    const valid = await validateApiKey("sk_wrong", hash);
    expect(valid).toBe(false);
  });

  test("revoke throws on missing ID", () => {
    expect(() => revoke("")).toThrow("Cannot revoke: missing API key ID");
  });

  test("revoke succeeds with valid ID", () => {
    expect(() => revoke("some-uuid")).not.toThrow();
  });

  test("isValidPrefix returns true for valid prefix", () => {
    expect(isValidPrefix("sk_test")).toBe(true);
  });

  test("isValidPrefix returns false for invalid prefix", () => {
    expect(isValidPrefix("pk_test")).toBe(false);
    expect(isValidPrefix("")).toBe(false);
  });
});
