import { describe, expect, test } from "bun:test";
import { Weather } from "./weather";

describe("Weather", () => {
	const tool = new Weather();

	test("returns error when API key not configured", async () => {
		const original = process.env.OPENWEATHER_API_KEY;
		delete process.env.OPENWEATHER_API_KEY;

		const result = await tool.execute({ location: "London" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("OPENWEATHER_API_KEY not configured");

		if (original !== undefined) {
			process.env.OPENWEATHER_API_KEY = original;
		}
	});

	test("rejects empty location", async () => {
		const result = await tool.execute({ location: "" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("Validation failed");
	});

	test("accepts fahrenheit unit", async () => {
		const original = process.env.OPENWEATHER_API_KEY;
		delete process.env.OPENWEATHER_API_KEY;

		const result = await tool.execute({
			location: "London",
			unit: "fahrenheit",
		});
		expect(result.success).toBe(false);
		expect(result.error).toContain("OPENWEATHER_API_KEY not configured");

		if (original !== undefined) {
			process.env.OPENWEATHER_API_KEY = original;
		}
	});

	test("accepts celsius unit", async () => {
		const original = process.env.OPENWEATHER_API_KEY;
		delete process.env.OPENWEATHER_API_KEY;

		const result = await tool.execute({ location: "London", unit: "celsius" });
		expect(result.success).toBe(false);
		expect(result.error).toContain("OPENWEATHER_API_KEY not configured");

		if (original !== undefined) {
			process.env.OPENWEATHER_API_KEY = original;
		}
	});
});
