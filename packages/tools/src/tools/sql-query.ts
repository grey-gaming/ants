import { z } from "zod";
import type { ToolResult } from "../types/tool";
import { BaseTool } from "./base-tool";

const DANGEROUS_KEYWORDS = [
	"DROP ",
	"DELETE ",
	"UPDATE ",
	"INSERT ",
	"ALTER ",
	"TRUNCATE ",
	"CREATE TABLE",
	"GRANT ",
	"REVOKE ",
	"EXECUTE ",
	"EXEC ",
];

export class SqlQuery extends BaseTool<typeof SqlQuery.parameters> {
	name = "sql-query";
	description =
		"Execute read-only SQL queries on a PostgreSQL database. Only SELECT statements are allowed. Results are returned as an array of row objects. Requires DATABASE_URL environment variable.";
	static parameters = z.object({
		query: z.string().min(1).max(5000),
		limit: z.number().int().min(1).max(1000).optional(),
	});
	parameters = SqlQuery.parameters;

	protected async _execute(
		input: z.infer<typeof SqlQuery.parameters>,
	): Promise<ToolResult> {
		const { query, limit = 100 } = input;

		// Block dangerous operations
		const upperQuery = query.trim().toUpperCase();
		for (const keyword of DANGEROUS_KEYWORDS) {
			if (
				upperQuery.startsWith(keyword) ||
				upperQuery.includes(`; ${keyword}`)
			) {
				return {
					success: false,
					error: `Query blocked: '${keyword.trim()}' is not allowed. Only SELECT queries permitted.`,
				};
			}
		}

		const dbUrl = process.env.DATABASE_URL;
		if (!dbUrl) {
			return { success: false, error: "DATABASE_URL not configured" };
		}

		try {
			const { Client } = await import("pg");
			const client = new Client({ connectionString: dbUrl });
			await client.connect();

			const sql = limit ? `${query} LIMIT ${limit}` : query;
			const result = await client.query(sql);

			await client.end();

			return {
				success: true,
				data: { rowCount: result.rowCount ?? 0, rows: result.rows },
			};
		} catch (err) {
			return {
				success: false,
				error: `SQL error: ${err instanceof Error ? err.message : String(err)}`,
			};
		}
	}
}
