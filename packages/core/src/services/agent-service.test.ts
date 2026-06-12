import { describe, test, expect } from "bun:test";
import { createAgentService } from "./agent-service";
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

describe("agent-service", () => {
  test("throws ValidationError for empty name", async () => {
    const db = makeMockDb();
    const service = createAgentService(db);

    await expect(
      service.register({ name: "", tier: "T1", description: "test" }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws ValidationError for whitespace name", async () => {
    const db = makeMockDb();
    const service = createAgentService(db);

    await expect(
      service.register({ name: "   ", tier: "T1", description: "test" }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws NotFoundError when agent not found for update", async () => {
    const db = makeMockDb([]);
    const service = createAgentService(db);

    await expect(service.update("nonexistent", { name: "updated" })).rejects.toThrow(NotFoundError);
  });

  test("throws NotFoundError when agent not found for deactivate", async () => {
    const db = makeMockDb([]);
    const service = createAgentService(db);

    await expect(service.deactivate("nonexistent")).rejects.toThrow(NotFoundError);
  });
});
