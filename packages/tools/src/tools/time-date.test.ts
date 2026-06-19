import { beforeEach, describe, expect, test } from "bun:test";
import { TimeDate } from "./time-date";

describe("TimeDate", () => {
	const td = new TimeDate();

	test("get current time in UTC", async () => {
		const result = await td.execute({ action: "now" });
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data).toHaveProperty("iso");
		expect(data).toHaveProperty("unix");
		expect(data.timezone).toBe("UTC");
	});

	test("get current time in custom timezone", async () => {
		const result = await td.execute({
			action: "now",
			timezone: "America/New_York",
		});
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.timezone).toBe("America/New_York");
	});

	test("convert timezone", async () => {
		const result = await td.execute({
			action: "convert",
			datetime: "2025-01-01T12:00:00Z",
			toTimezone: "America/New_York",
		});
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.toTimezone).toBe("America/New_York");
		expect(data).toHaveProperty("converted");
	});

	test("convert requires datetime", async () => {
		const result = await td.execute({ action: "convert" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("datetime is required");
	});

	test("format date as ISO", async () => {
		const result = await td.execute({
			action: "format",
			datetime: "2025-06-15",
			format: "iso",
		});
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.formatted).toContain("2025-06-15");
	});

	test("format requires datetime", async () => {
		const result = await td.execute({ action: "format" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("datetime is required");
	});

	test("calculate duration", async () => {
		const result = await td.execute({
			action: "duration",
			startDate: "2025-01-01T00:00:00Z",
			endDate: "2025-01-08T00:00:00Z",
		});
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.days).toBe(7);
		expect(data.hours).toBe(168);
		expect(data.direction).toBe("future");
	});

	test("calculate duration past", async () => {
		const result = await td.execute({
			action: "duration",
			startDate: "2025-01-08T00:00:00Z",
			endDate: "2025-01-01T00:00:00Z",
		});
		expect(result.success).toBe(true);
		const data = result.data as any;
		expect(data.direction).toBe("past");
	});

	test("duration requires both dates", async () => {
		const result = await td.execute({
			action: "duration",
			startDate: "2025-01-01",
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("startDate and endDate are required");
	});

	test("invalid datetime format", async () => {
		const result = await td.execute({
			action: "convert",
			datetime: "not-a-date",
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("Invalid datetime");
	});
});
