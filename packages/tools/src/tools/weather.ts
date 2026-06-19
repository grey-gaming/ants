import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

export class Weather extends BaseTool<typeof Weather.parameters> {
	name = "weather";
	description =
		"Get current weather data for a location. Requires OPENWEATHER_API_KEY environment variable. Supports city name or lat/lon coordinates.";
	static parameters = z.object({
		location: z.string().min(1),
		unit: z.enum(["celsius", "fahrenheit", "kelvin"]).optional(),
	});
	parameters = Weather.parameters;

	protected async _execute(
		input: z.infer<typeof Weather.parameters>,
	): Promise<ToolResult> {
		const { location, unit = "celsius" } = input;
		const apiKey = process.env.OPENWEATHER_API_KEY;

		if (!apiKey) {
			return {
				success: false,
				error:
					"OPENWEATHER_API_KEY not configured. Set this environment variable to use the weather tool.",
			};
		}

		const units = unit === "fahrenheit" ? "imperial" : "metric";
		const url = `https://api.openweathermap.org/data/2.5/weather?q=${encodeURIComponent(location)}&units=${units}&appid=${apiKey}`;

		try {
			const response = await fetch(url, {
				signal: AbortSignal.timeout(10000),
			});

			if (!response.ok) {
				return {
					success: false,
					error:
						response.status === 404
							? `Location not found: ${location}`
							: `Weather API error: HTTP ${response.status}`,
				};
			}

			const data = await response.json();

			return {
				success: true,
				data: {
					location: `${data.name}, ${data.sys?.country || ""}`,
					temperature: data.main.temp,
					feelsLike: data.main.feels_like,
					humidity: data.main.humidity,
					description: data.weather?.[0]?.description || "N/A",
					windSpeed: data.wind?.speed || 0,
					unit: unit === "fahrenheit" ? "°F" : "°C",
				},
			};
		} catch (err) {
			return {
				success: false,
				error: `Weather fetch failed: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}
}
