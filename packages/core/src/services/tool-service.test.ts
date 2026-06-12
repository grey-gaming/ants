import { describe, test, expect } from "bun:test";
import { createToolService } from "./tool-service";
import { NotFoundError, ValidationError } from "../lib/errors";

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

describe("tool-service", () => {
  test("throws ValidationError for empty name", async () => {
    const service = createToolService(makeMockDb());

    await expect(
      service.register(null, { name: "", description: "test", type: "function" }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws ValidationError for whitespace name", async () => {
    const service = createToolService(makeMockDb());

    await expect(
      service.register(null, { name: "   ", description: "test", type: "function" }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws NotFoundError when tool not found for update", async () => {
    const service = createToolService(makeMockDb([]));

    await expect(
      service.update(null, "nonexistent", { name: "updated" }),
    ).rejects.toThrow(NotFoundError);
  });

  test("throws NotFoundError when tool not found for deactivate", async () => {
    const service = createToolService(makeMockDb([]));

    await expect(
      service.deactivate(null, "nonexistent"),
    ).rejects.toThrow(NotFoundError);
  });

  test("filters list by userId when provided", async () => {
    const tool = { id: "t-1", name: "test-tool", createdBy: "user-1" };
    const service = createToolService(makeMockDb([tool]));

    const result = await service.list({ userId: "user-1" });
    expect(result).toEqual([tool] as never[]);
  });
});
