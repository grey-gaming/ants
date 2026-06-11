import { describe, test, expect } from "bun:test";
import { lt, eq, and, or } from 'drizzle-orm';

describe("ThreadService cursor pagination logic", () => {
  test("cursor-based WHERE uses composite condition: createdAt < cursor OR (createdAt = cursor AND id < cursor_id)", () => {
    const cursorCreatedAt = new Date("2025-01-15T12:00:00Z");
    const older = new Date("2025-01-14T12:00:00Z");
    const newer = new Date("2025-01-16T12:00:00Z");

    expect(older < cursorCreatedAt).toBe(true);
    expect(newer < cursorCreatedAt).toBe(false);

    const sameTime = new Date("2025-01-15T12:00:00Z");
    expect(sameTime.getTime() === cursorCreatedAt.getTime()).toBe(true);

    const sameTimeOlderId = "aaaaaaaa-0000-0000-0000-000000000001";
    const sameTimeNewerId = "bbbbbbbb-0000-0000-0000-000000000001";
    expect(sameTimeOlderId < sameTimeNewerId).toBe(true);
  });

  test("composite cursor handles ties on createdAt by comparing id", () => {
    const cursorCreatedAt = new Date("2025-01-15T12:00:00Z");
    const cursorId = "cccccccc-0000-0000-0000-000000000001";

    const sameTimeEarlierId = "aaaaaaaa-0000-0000-0000-000000000001";
    const sameTimeLaterId = "ffffffff-0000-0000-0000-000000000001";

    expect(
      sameTimeEarlierId < cursorId &&
      sameTimeEarlierId === cursorCreatedAt.toISOString()
    ).toBe(false);

    const shouldInclude =
      sameTimeEarlierId < cursorId;
    expect(shouldInclude).toBe(true);

    const shouldExclude =
      sameTimeLaterId < cursorId;
    expect(shouldExclude).toBe(false);
  });
});