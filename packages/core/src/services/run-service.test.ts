import { describe, test, expect } from "bun:test";
import { createRunService } from "./run-service";
import { NotFoundError, ConflictError, ValidationError } from "../lib/errors";

type thenable = Promise<unknown> & { then: () => void };

function builder(result: unknown[]): thenable {
  return Object.assign(
    () => result,
    {
      orderBy: () => ({ limit: async () => result }),
      then: (resolve: (v: unknown) => void) => resolve(result),
    },
  ) as never as thenable;
}

function makeMockDb(selectResult: unknown[] = []): never {
  const resultPromise = async () => selectResult;

  return {
    select: () => ({
      from: () => ({
        where: () => builder(selectResult),
      }),
    }),
    insert: () => ({ values: () => [], returning: resultPromise }),
    update: () => ({ set: () => ({ where: resultPromise, returning: resultPromise }) }),
  } as never;
}

describe("run-service", () => {
  test("throws ValidationError for missing threadId", async () => {
    const service = createRunService(makeMockDb());

    await expect(
      service.create({ userId: "u-1", threadId: "", agentTypeId: "agent-1" }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws ValidationError for missing agentTypeId", async () => {
    const service = createRunService(makeMockDb());

    await expect(
      service.create({ userId: "u-1", threadId: "thread-1", agentTypeId: "" }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws NotFoundError when run not found for cancel", async () => {
    const service = createRunService(makeMockDb([]));

    await expect(service.cancel("nonexistent")).rejects.toThrow(NotFoundError);
  });

  test("throws ConflictError when cancelling completed run", async () => {
    const service = createRunService(makeMockDb([{ id: "run-1", status: "completed" }]));

    await expect(service.cancel("run-1")).rejects.toThrow(ConflictError);
  });

  test("throws ConflictError when cancelling failed run", async () => {
    const service = createRunService(makeMockDb([{ id: "run-1", status: "failed" }]));

    await expect(service.cancel("run-1")).rejects.toThrow(ConflictError);
  });

  test("throws ConflictError when cancelling cancelled run", async () => {
    const service = createRunService(makeMockDb([{ id: "run-1", status: "cancelled" }]));

    await expect(service.cancel("run-1")).rejects.toThrow(ConflictError);
  });

  test("list returns paginated runs with composite cursor", async () => {
    const rows = [
      { id: "r-1", threadId: "t-1", createdAt: new Date("2024-01-03"), status: "queued" },
      { id: "r-2", threadId: "t-1", createdAt: new Date("2024-01-02"), status: "queued" },
    ];
    const service = createRunService(makeMockDb(rows));

    const result = await service.list("t-1");
    expect(result.data.length).toBe(2);
    expect(result.nextCursor).toBeDefined();
  });
});
