import { describe, test, expect } from "bun:test";
import { createQueueService } from "./queue-service";
import { RateLimitError } from "../lib/errors";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type thenable = any;

function makeMockDb(perUser: Record<string, number>, queuedCount: number = 0): never {
  const activeResults = Object.entries(perUser).map(([userId, count]) => ({
    userId,
    activeCount: String(count),
  }));

  const countResult = [{ count: String(queuedCount) }];
  const emptyResult: unknown[] = [];

  function resolvedEmpty(): thenable {
    return Object.assign(
      async () => emptyResult,
      { then: (resolve: (v: unknown) => void) => resolve(emptyResult) },
    );
  }

  function orderedBuilder(): thenable {
    return Object.assign(
      async () => emptyResult,
      {
        limit: () => resolvedEmpty(),
        then: (resolve: (v: unknown) => void) => resolve(emptyResult),
      },
    );
  }

  function whereBuilder(): thenable {
    return Object.assign(
      async () => emptyResult,
      {
        orderBy: () => orderedBuilder(),
        limit: async () => countResult,
        groupBy: async () => activeResults,
        then: (resolve: (v: unknown) => void) => resolve(countResult),
      },
    );
  }

  return {
    select: () => ({
      from: () => ({
        where: () => whereBuilder(),
      }),
      where: async () => countResult,
    }),
    insert: () => ({ values: () => {} }),
    update: () => ({ set: () => ({ where: async () => [] }) }),
  } as never;
}

describe("queue-service", () => {
  test("dequeue empty returns null", async () => {
    const service = createQueueService(makeMockDb({}));
    const result = await service.dequeue();
    expect(result).toBeNull();
  });

  test("enqueue is async and writes to store", async () => {
    const service = createQueueService(makeMockDb({}));

    await expect(
      service.enqueue({
        runId: "r-1",
        userId: "u-1",
        threadId: "t-1",
        priority: "critical",
      }),
    ).resolves.toBeUndefined();
  });

  test("enforceConcurrencyLimits throws on global limit", async () => {
    const service = createQueueService(makeMockDb({ "u-1": 5, "u-2": 5 }));

    await expect(service.enforceConcurrencyLimits()).rejects.toThrow(RateLimitError);
  });

  test("enforceConcurrencyLimits throws on per-user limit", async () => {
    const service = createQueueService(makeMockDb({ "u-1": 3 }));

    await expect(service.enforceConcurrencyLimits("u-1")).rejects.toThrow(RateLimitError);
  });

  test("enforceConcurrencyLimits allows within limits", async () => {
    const service = createQueueService(makeMockDb({ "u-1": 1 }));

    await expect(service.enforceConcurrencyLimits("u-1")).resolves.toBeUndefined();
  });

  test("getStats returns correct stats from db", async () => {
    const service = createQueueService(makeMockDb({ "u-1": 2 }, 3));

    const stats = await service.getStats();
    expect(stats.maxConcurrency).toBe(10);
    expect(stats.activeRuns).toBe(2);
    expect(stats.queueDepth).toBe(3);
    expect(stats.perUserActiveRuns["u-1"]).toBe(2);
  });
});
