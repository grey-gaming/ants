import { describe, test, expect } from "bun:test";
import { createQueueService } from "./queue-service";
import { RateLimitError } from "../lib/errors";

function makeMockDb(perUser: Record<string, number>) {
  const results = Object.entries(perUser).map(([userId, count]) => ({
    userId,
    activeCount: String(count),
  }));

  return {
    select: () => ({
      from: () => ({
        where: () => ({
          groupBy: async () => results,
        }),
      }),
    }),
  } as never;
}

describe("queue-service", () => {
  test("dequeue empty returns null", () => {
    const db = makeMockDb({});
    const service = createQueueService(db);
    expect(service.dequeue()).toBeNull();
  });

  test("enqueue and dequeue in priority order", () => {
    const db = makeMockDb({});
    const service = createQueueService(db);

    service.enqueue({ runId: "r-1", userId: "u-1", threadId: "t-1", priority: "low" });
    service.enqueue({ runId: "r-2", userId: "u-2", threadId: "t-2", priority: "critical" });
    service.enqueue({ runId: "r-3", userId: "u-1", threadId: "t-1", priority: "high" });
    service.enqueue({ runId: "r-4", userId: "u-1", threadId: "t-1", priority: "normal" });

    expect(service.dequeue()?.runId).toBe("r-2");
    expect(service.dequeue()?.runId).toBe("r-3");
    expect(service.dequeue()?.runId).toBe("r-4");
    expect(service.dequeue()?.runId).toBe("r-1");
    expect(service.dequeue()).toBeNull();
  });

  test("dequeue FIFO within same priority", () => {
    const db = makeMockDb({});
    const service = createQueueService(db);

    service.enqueue({ runId: "r-1", userId: "u-1", threadId: "t-1", priority: "normal" });
    service.enqueue({ runId: "r-2", userId: "u-1", threadId: "t-1", priority: "normal" });

    expect(service.dequeue()?.runId).toBe("r-1");
    expect(service.dequeue()?.runId).toBe("r-2");
  });

  test("default priority is normal", () => {
    const db = makeMockDb({});
    const service = createQueueService(db);

    service.enqueue({ runId: "r-1", userId: "u-1", threadId: "t-1" });
    service.enqueue({ runId: "r-2", userId: "u-1", threadId: "t-1", priority: "high" });

    expect(service.dequeue()?.runId).toBe("r-2");
    expect(service.dequeue()?.runId).toBe("r-1");
  });

  test("enforceConcurrencyLimits throws on global limit", async () => {
    const db = makeMockDb({ "u-1": 5, "u-2": 5 });
    const service = createQueueService(db);

    await expect(service.enforceConcurrencyLimits()).rejects.toThrow(RateLimitError);
  });

  test("enforceConcurrencyLimits throws on per-user limit", async () => {
    const db = makeMockDb({ "u-1": 3 });
    const service = createQueueService(db);

    await expect(service.enforceConcurrencyLimits("u-1")).rejects.toThrow(RateLimitError);
  });

  test("enforceConcurrencyLimits allows within limits", async () => {
    const db = makeMockDb({ "u-1": 1 });
    const service = createQueueService(db);

    await expect(service.enforceConcurrencyLimits("u-1")).resolves.toBeUndefined();
  });

  test("getStats returns queue depth", async () => {
    const db = makeMockDb({});
    const service = createQueueService(db);

    service.enqueue({ runId: "r-1", userId: "u-1", threadId: "t-1" });
    service.enqueue({ runId: "r-2", userId: "u-2", threadId: "t-2" });

    const stats = await service.getStats();
    expect(stats.queueDepth).toBe(2);
    expect(stats.maxConcurrency).toBe(10);
  });
});
