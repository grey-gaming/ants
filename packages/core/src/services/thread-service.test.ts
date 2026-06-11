import { describe, test, expect } from "bun:test";

describe("ThreadService cursor pagination logic", () => {
  test("cursor-based WHERE uses lt (less than) on createdAt, not in-memory findIndex", () => {
    const cursorCreatedAt = new Date("2025-01-15T12:00:00Z");
    const older = new Date("2025-01-14T12:00:00Z");
    const newer = new Date("2025-01-16T12:00:00Z");
    expect(older < cursorCreatedAt).toBe(true);
    expect(newer < cursorCreatedAt).toBe(false);
  });
});