import { describe, test, expect } from "bun:test";
import { createMessageService } from "./message-service";
import { NotFoundError, ValidationError } from "../lib/errors";

function makeMockDb(threadAccessResult: unknown[] = []) {
  return {
    select: () => ({
      from: () => ({
        where: async () => threadAccessResult,
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

describe("message-service", () => {
  test("throws ValidationError for empty content", async () => {
    const db = makeMockDb([{ id: "thread-1" }]);
    const service = createMessageService(db);

    await expect(
      service.create("user-1", {
        threadId: "thread-1",
        role: "user",
        content: "",
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws ValidationError for whitespace content", async () => {
    const db = makeMockDb([{ id: "thread-1" }]);
    const service = createMessageService(db);

    await expect(
      service.create("user-1", {
        threadId: "thread-1",
        role: "user",
        content: "   ",
      }),
    ).rejects.toThrow(ValidationError);
  });

  test("throws NotFoundError when thread not accessible", async () => {
    const db = makeMockDb([]);
    const service = createMessageService(db);

    await expect(
      service.create("user-1", {
        threadId: "other-thread",
        role: "user",
        content: "hello",
      }),
    ).rejects.toThrow(NotFoundError);
  });
});
