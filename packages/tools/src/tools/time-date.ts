import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

export class TimeDate extends BaseTool<typeof TimeDate.parameters> {
	name = "time-date";
	description =
		"Get current date and time, convert between timezones, format dates, or calculate durations between dates. Supports IANA timezone names (e.g., 'America/New_York', 'Asia/Tokyo').";
	static parameters = z.object({
		action: z.enum(["now", "convert", "format", "duration"]),
		timezone: z.string().optional(),
		datetime: z.string().optional(),
		format: z.string().optional(),
		fromTimezone: z.string().optional(),
		toTimezone: z.string().optional(),
		startDate: z.string().optional(),
		endDate: z.string().optional(),
	});
	parameters = TimeDate.parameters;

	protected async _execute(
		input: z.infer<typeof TimeDate.parameters>,
	): Promise<ToolResult> {
		const { action } = input;

		switch (action) {
			case "now":
				return this.getCurrentTime(input);
			case "convert":
				return this.convertTimezone(input);
			case "format":
				return this.formatDate(input);
			case "duration":
				return this.calculateDuration(input);
		}
	}

	private getCurrentTime(
		input: z.infer<typeof TimeDate.parameters>,
	): ToolResult {
		const tz = input.timezone || "UTC";
		const now = new Date();
		return {
			success: true,
			data: {
				iso: now.toISOString(),
				timezone: tz,
				formatted: now.toLocaleString("en-US", { timeZone: tz }),
				unix: now.getTime() / 1000,
			},
		};
	}

	private convertTimezone(
		input: z.infer<typeof TimeDate.parameters>,
	): ToolResult {
		if (!input.datetime) {
			return {
				success: false,
				error: "datetime is required for convert action",
			};
		}
		const dt = new Date(input.datetime);
		if (isNaN(dt.getTime())) {
			return { success: false, error: `Invalid datetime: ${input.datetime}` };
		}
		const toTz = input.toTimezone || "UTC";
		return {
			success: true,
			data: {
				original: input.datetime,
				toTimezone: toTz,
				converted: dt.toLocaleString("en-US", { timeZone: toTz }),
				iso: dt.toISOString(),
			},
		};
	}

	private formatDate(input: z.infer<typeof TimeDate.parameters>): ToolResult {
		if (!input.datetime) {
			return {
				success: false,
				error: "datetime is required for format action",
			};
		}
		const dt = new Date(input.datetime);
		if (isNaN(dt.getTime())) {
			return { success: false, error: `Invalid datetime: ${input.datetime}` };
		}
		const tz = input.timezone || "UTC";
		const fmt = input.format || "full";
		let formatted: string;
		switch (fmt) {
			case "iso":
				formatted = dt.toISOString();
				break;
			case "short":
				formatted = dt.toLocaleDateString("en-US", { timeZone: tz });
				break;
			default:
				formatted = dt.toLocaleString("en-US", { timeZone: tz });
		}
		return {
			success: true,
			data: { original: input.datetime, format: fmt, formatted, timezone: tz },
		};
	}

	private calculateDuration(
		input: z.infer<typeof TimeDate.parameters>,
	): ToolResult {
		if (!input.startDate || !input.endDate) {
			return {
				success: false,
				error: "startDate and endDate are required for duration action",
			};
		}
		const start = new Date(input.startDate);
		const end = new Date(input.endDate);
		if (isNaN(start.getTime()) || isNaN(end.getTime())) {
			return { success: false, error: "Invalid date format" };
		}
		const diffMs = end.getTime() - start.getTime();
		return {
			success: true,
			data: {
				startDate: input.startDate,
				endDate: input.endDate,
				milliseconds: diffMs,
				seconds: Math.floor(Math.abs(diffMs) / 1000),
				minutes: Math.floor(Math.abs(diffMs) / 60000),
				hours: Math.floor(Math.abs(diffMs) / 3600000),
				days: Math.floor(Math.abs(diffMs) / 86400000),
				direction: diffMs >= 0 ? "future" : "past",
			},
		};
	}
}
