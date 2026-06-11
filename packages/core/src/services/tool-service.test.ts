import { describe, test, expect } from "bun:test";
import { createToolService } from "./tool-service";
import { NotFoundError, ValidationError } from "../lib/errors";

function makeMockDb(selectResult: unknown[] = []) {
  return {
    select: () => ({
      from: () => ({
        where: async () => selectResult,
        orderBy: () => ({
          limit: async () => [],
        }),
      }),
    }),
    insert: () => ({
      values: () => [],
      returning: async () => [],
    }),
  } as never;
}

describe("tool-service", () => {
  test("throws ValidationError for empty name", async () => {
    const db = makeMockDb();
    const service = createToolService(db);

    await expect(
      service.register({ name: "", description: "test", type: "function" }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws ValidationError for whitespace name", async () => {
    const db = makeMockDb();
    const service = createToolService(db);

    await expect(
      service.register({ name: "   ", description: "test", type: "function" }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws NotFoundError when tool not found for update", async () => {
    const db = makeMockDb([]);
    const service = createToolService(db);

    await expect(service.update("nonexistent", { name: "updated" })).rejects.toThrow(NotFoundError);
  });

  test("throws NotFoundError when tool not found for deactivate", async () => {
    const db = makeMockDb([]);
    const service = createToolService(db);

    await expect(service.deactivate("nonexistent")).rejects.toThrow(NotFoundError);
  });
});
