import { describe, test, expect } from "bun:test";
import { createRunService } from "./run-service";
import { NotFoundError, ConflictError, ValidationError } from "../lib/errors";

function makeMockDb(selectResult: unknown[] = []) {
  return {
    select: () => ({
      from: () => ({
        where: async () => selectResult,
      }),
    }),
    insert: () => ({
      values: () => [],
      returning: async () => [],
    }),
  } as never;
}

describe("run-service", () => {
  test("throws ValidationError for missing threadId", async () => {
    const db = makeMockDb();
    const service = createRunService(db);

    await expect(
      service.create({ threadId: "", agentTypeId: "agent-1" }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws NotFoundError when run not found for cancel", async () => {
    const db = makeMockDb([]);
    const service = createRunService(db);

    await expect(service.cancel("nonexistent")).rejects.toThrow(NotFoundError);
  });

  test("throws ConflictError when cancelling completed run", async () => {
    const db = makeMockDb([{ id: "run-1", status: "completed" }]);
    const service = createRunService(db);

    await expect(service.cancel("run-1")).rejects.toThrow(ConflictError);
  });

  test("throws ConflictError when cancelling failed run", async () => {
    const db = makeMockDb([{ id: "run-1", status: "failed" }]);
    const service = createRunService(db);

    await expect(service.cancel("run-1")).rejects.toThrow(ConflictError);
  });

  test("throws ConflictError when cancelling cancelled run", async () => {
    const db = makeMockDb([{ id: "run-1", status: "cancelled" }]);
    const service = createRunService(db);

    await expect(service.cancel("run-1")).rejects.toThrow(ConflictError);
  });
});
