import { describe, test, expect } from "bun:test";
import { createThreadService } from "./thread-service";
import { NotFoundError, ValidationError } from "../lib/errors";

function makeMockDb(selectResult: unknown[] = []) {
  return {
    insert: () => ({
      values: () => [],
      returning: async () => [],
    }),
    select: () => ({
      from: () => ({
        where: async () => selectResult,
        orderBy: () => ({
          limit: async () => selectResult,
        }),
      }),
    }),
    update: () => ({
      set: () => ({
        where: async () => [],
        returning: async () => [],
      }),
    }),
    delete: () => ({
      where: async () => [],
    }),
  } as never;
}

describe("thread-service", () => {
  test("throws ValidationError for empty title", async () => {
    const db = makeMockDb();
    const service = createThreadService(db);

    await expect(service.create("user-1", { title: "" })).rejects.toThrow(ValidationError);
  });

  test("throws ValidationError for whitespace title", async () => {
    const db = makeMockDb();
    const service = createThreadService(db);

    await expect(service.create("user-1", { title: "   " })).rejects.toThrow(ValidationError);
  });

  test("trims whitespace from title before validation", async () => {
    const db = makeMockDb();
    const service = createThreadService(db);

    await expect(service.create("user-1", { title: "\t\n " })).rejects.toThrow(ValidationError);
  });

  test("getById returns null when thread not found", async () => {
    const db = makeMockDb([]);
    const service = createThreadService(db);
    const result = await service.getById("user-1", "nonexistent");
    expect(result).toBeNull();
  });
});
