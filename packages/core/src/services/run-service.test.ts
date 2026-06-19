import { describe, expect, test } from "bun:test";
import { ConflictError, NotFoundError, ValidationError } from "../lib/errors";
import { createRunService } from "./run-service";

type thenable = Promise<unknown> & { then: () => void };

function builder(result: unknown[]): thenable {
	return Object.assign(() => result, {
		orderBy: () => ({ limit: async () => result }),
		then: (resolve: (v: unknown) => void) => resolve(result),
	}) as never as thenable;
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
		update: () => ({
			set: () => ({ where: resultPromise, returning: resultPromise }),
		}),
	} as never;
}

function makePaginatedMockDb(
	filteredRows: unknown[],
	limit: number,
): never {
	return {
		select: () => ({
			from: () => ({
				where: () => builder(filteredRows),
			}),
		}),
		insert: () => ({ values: () => [], returning: async () => [] }),
		update: () => ({
			set: () => ({
				where: async () => [],
				returning: async () => [],
			}),
		}),
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
		const service = createRunService(
			makeMockDb([{ id: "run-1", status: "completed" }]),
		);

		await expect(service.cancel("run-1")).rejects.toThrow(ConflictError);
	});

	test("throws ConflictError when cancelling failed run", async () => {
		const service = createRunService(
			makeMockDb([{ id: "run-1", status: "failed" }]),
		);

		await expect(service.cancel("run-1")).rejects.toThrow(ConflictError);
	});

	test("throws ConflictError when cancelling cancelled run", async () => {
		const service = createRunService(
			makeMockDb([{ id: "run-1", status: "cancelled" }]),
		);

		await expect(service.cancel("run-1")).rejects.toThrow(ConflictError);
	});

	test("list returns paginated runs with composite cursor", async () => {
		const rows = [
			{
				id: "r-1",
				threadId: "t-1",
				userId: "u-1",
				createdAt: new Date("2024-01-03"),
				status: "queued",
			},
			{
				id: "r-2",
				threadId: "t-1",
				userId: "u-1",
				createdAt: new Date("2024-01-02"),
				status: "queued",
			},
		];
		const service = createRunService(makeMockDb(rows));

		const result = await service.list("t-1");
		expect(result.data.length).toBe(2);
		expect(result.nextCursor).toBeDefined();
	});

	test("listAll returns user-scoped runs with composite cursor", async () => {
		const rows = [
			{
				id: "r-1",
				threadId: "t-1",
				userId: "u-1",
				createdAt: new Date("2024-01-03"),
				status: "queued",
			},
			{
				id: "r-2",
				threadId: "t-2",
				userId: "u-1",
				createdAt: new Date("2024-01-02"),
				status: "completed",
			},
		];
		const service = createRunService(makeMockDb(rows));

		const result = await service.listAll("u-1");
		expect(result.data.length).toBe(2);
		expect(result.nextCursor).toBeDefined();
		expect(result.data[0].id).toBe("r-1");
		expect(result.data[1].id).toBe("r-2");
	});

	test("listAll returns runs in newest-first order with 3 runs and cursor pagination", async () => {
		const mainRows = [
			{
				id: "r-1",
				threadId: "t-1",
				userId: "user-1",
				createdAt: new Date("2024-01-03T12:00:00Z"),
				status: "completed",
			},
			{
				id: "r-2",
				threadId: "t-2",
				userId: "user-1",
				createdAt: new Date("2024-01-02T12:00:00Z"),
				status: "in_progress",
			},
			{
				id: "r-3",
				threadId: "t-3",
				userId: "user-1",
				createdAt: new Date("2024-01-01T12:00:00Z"),
				status: "queued",
			},
		];
		// Pad to 51 so the service (default limit=50) returns 50 and sets nextCursor
		// Use negative day offsets to get dates before mainRows (all before 2024-01-01)
		const paddedRows = [
			...mainRows,
			...Array.from({ length: 48 }, (_, i) => ({
				id: `r-extra-${i}`,
				threadId: `t-extra-${i}`,
				userId: "user-1",
				createdAt: new Date(2024, 0, 1 - i),
				status: "queued",
			})),
		];
		const service = createRunService(makePaginatedMockDb(paddedRows, 51));

		const result = await service.listAll("user-1");
		expect(result.data.length).toBe(50);
		expect(result.nextCursor).toBeDefined();
		// Verify newest-first order (mock data is already in this order)
		expect(result.data[0].id).toBe("r-1");
		expect(result.data[0].createdAt.toISOString()).toBe(
			"2024-01-03T12:00:00.000Z",
		);
		expect(result.data[1].id).toBe("r-2");
		expect(result.data[1].createdAt.toISOString()).toBe(
			"2024-01-02T12:00:00.000Z",
		);
		// Verify cursor encodes the last returned item (index 49 = r-extra-46)
		const cursorDecoded = Buffer.from(result.nextCursor!, "base64").toString();
		expect(cursorDecoded).toContain("r-extra-46");
	});

	test("listAll filters by status when provided", async () => {
		// Mock returns only completed rows (simulating a filtered DB query)
		const completedRows = [
			{
				id: "r-1",
				threadId: "t-1",
				userId: "user-1",
				createdAt: new Date("2024-01-03T12:00:00Z"),
				status: "completed",
			},
			{
				id: "r-3",
				threadId: "t-3",
				userId: "user-1",
				createdAt: new Date("2024-01-01T12:00:00Z"),
				status: "completed",
			},
		];
		const service = createRunService(makeMockDb(completedRows));

		const result = await service.listAll("user-1", { status: "completed" });
		expect(result.data.length).toBe(2);
		expect(result.data[0].id).toBe("r-1");
		expect(result.data[1].id).toBe("r-3");
	});
});
