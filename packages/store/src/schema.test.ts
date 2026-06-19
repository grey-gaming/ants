import { describe, expect, test } from "bun:test";
import { getTableColumns } from "drizzle-orm";
import {
	agentTypes,
	agentTypesRelations,
	inviteCodes,
	jobQueuePriorityEnum,
	jobQueueRelations,
	messageRoleEnum,
	messages,
	messagesRelations,
	runStatusEnum,
	runStepStatusEnum,
	runSteps,
	runStepsRelations,
	runStepTypeEnum,
	runs,
	runsRelations,
	settings,
	settingsRelations,
	threads,
	threadsRelations,
	tierEnum,
	toolCallStatusEnum,
	toolCalls,
	toolCallsRelations,
	tools,
	toolsRelations,
	toolTypeEnum,
	users,
	usersRelations,
} from "./schema";

const allTables = [
	users,
	threads,
	messages,
	runs,
	runSteps,
	toolCalls,
	agentTypes,
	tools,
	inviteCodes,
	settings,
];

function getCols(table: any) {
	return getTableColumns(table) as Record<string, any>;
}

function colByName(table: any, dbName: string) {
	const cols = getCols(table);
	return Object.values(cols).find((c: any) => c.name === dbName);
}

function hasCol(table: any, dbName: string) {
	return colByName(table, dbName) !== undefined;
}

// ─── Table Definitions ──────────────────────────────────────────────────────

describe("Schema — Table Definitions", () => {
	test("all 10 tables are defined", () => {
		expect(users).toBeDefined();
		expect(threads).toBeDefined();
		expect(messages).toBeDefined();
		expect(runs).toBeDefined();
		expect(runSteps).toBeDefined();
		expect(toolCalls).toBeDefined();
		expect(agentTypes).toBeDefined();
		expect(tools).toBeDefined();
		expect(inviteCodes).toBeDefined();
		expect(settings).toBeDefined();
	});

	test("users table has correct columns", () => {
		const names = Object.values(getCols(users)).map((c) => c.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"id",
				"email",
				"name",
				"created_at",
				"updated_at",
			]),
		);
	});

	test("threads table has correct columns", () => {
		const names = Object.values(getCols(threads)).map((c) => c.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"id",
				"user_id",
				"title",
				"metadata",
				"created_at",
				"updated_at",
			]),
		);
	});

	test("messages table has correct columns", () => {
		const names = Object.values(getCols(messages)).map((c) => c.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"id",
				"thread_id",
				"role",
				"content",
				"agent_type_id",
				"metadata",
				"created_at",
			]),
		);
	});

	test("runs table has correct columns", () => {
		const names = Object.values(getCols(runs)).map((c) => c.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"id",
				"thread_id",
				"user_id",
				"agent_type_id",
				"parent_run_id",
				"status",
				"model_config",
				"usage",
				"started_at",
				"completed_at",
				"created_at",
			]),
		);
	});

	test("run_steps table has correct columns", () => {
		const names = Object.values(getCols(runSteps)).map((c) => c.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"id",
				"run_id",
				"type",
				"status",
				"details",
				"created_at",
				"completed_at",
			]),
		);
	});

	test("tool_calls table has correct columns", () => {
		const names = Object.values(getCols(toolCalls)).map((c) => c.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"id",
				"run_step_id",
				"tool_id",
				"name",
				"arguments",
				"result",
				"status",
				"created_at",
				"completed_at",
			]),
		);
	});

	test("agent_types table has correct columns", () => {
		const names = Object.values(getCols(agentTypes)).map((c) => c.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"id",
				"name",
				"tier",
				"description",
				"model_config",
				"capabilities",
				"tool_ids",
				"active",
				"created_at",
				"updated_at",
			]),
		);
	});

	test("tools table has correct columns", () => {
		const names = Object.values(getCols(tools)).map((c) => c.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"id",
				"name",
				"description",
				"parameters_schema",
				"type",
				"active",
				"created_at",
				"updated_at",
			]),
		);
	});

	test("invite_codes table has correct columns", () => {
		const names = Object.values(getCols(inviteCodes)).map((c) => c.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"id",
				"code",
				"used",
				"expires_at",
				"created_at",
			]),
		);
	});

	test("settings table has correct columns", () => {
		const names = Object.values(getCols(settings)).map((c) => c.name);
		expect(names).toEqual(
			expect.arrayContaining([
				"id",
				"key",
				"value",
				"is_global",
				"user_id",
				"created_at",
				"updated_at",
			]),
		);
	});
});

// ─── UUID Primary Keys ─────────────────────────────────────────────────────

describe("Schema — UUID Primary Keys", () => {
	test("all tables have uuid primary keys", () => {
		for (const table of allTables) {
			const idColumn = colByName(table, "id");
			expect(idColumn).toBeDefined();
			expect(idColumn?.primary).toBe(true);
		}
	});
});

// ─── Enum Definitions ──────────────────────────────────────────────────────

describe("Schema — Enum Definitions", () => {
	test("messageRoleEnum has correct values", () => {
		expect(messageRoleEnum.enumValues).toEqual(["user", "assistant", "system"]);
	});

	test("runStatusEnum has correct values", () => {
		expect(runStatusEnum.enumValues).toEqual([
			"queued",
			"in_progress",
			"awaiting_response",
			"paused",
			"completed",
			"failed",
			"cancelled",
		]);
	});

	test("runStepTypeEnum has correct values", () => {
		expect(runStepTypeEnum.enumValues).toEqual([
			"message_creation",
			"tool_call",
			"agent_delegation",
			"reasoning",
		]);
	});

	test("runStepStatusEnum has correct values", () => {
		expect(runStepStatusEnum.enumValues).toEqual([
			"in_progress",
			"completed",
			"failed",
		]);
	});

	test("toolCallStatusEnum has correct values", () => {
		expect(toolCallStatusEnum.enumValues).toEqual([
			"in_progress",
			"completed",
			"failed",
		]);
	});

	test("tierEnum has correct values", () => {
		expect(tierEnum.enumValues).toEqual(["T1", "T2", "T3"]);
	});

	test("toolTypeEnum has correct values", () => {
		expect(toolTypeEnum.enumValues).toEqual(["function", "builtin"]);
	});

	test("jobQueuePriorityEnum has correct values", () => {
		expect(jobQueuePriorityEnum.enumValues).toEqual([
			"critical",
			"high",
			"normal",
			"low",
		]);
	});
});

// ─── FK Relations ──────────────────────────────────────────────────────────

describe("Schema — FK Relations", () => {
	test("10 relation exports are defined", () => {
		expect(usersRelations).toBeDefined();
		expect(threadsRelations).toBeDefined();
		expect(messagesRelations).toBeDefined();
		expect(runsRelations).toBeDefined();
		expect(runStepsRelations).toBeDefined();
		expect(toolCallsRelations).toBeDefined();
		expect(agentTypesRelations).toBeDefined();
		expect(toolsRelations).toBeDefined();
		expect(settingsRelations).toBeDefined();
		expect(jobQueueRelations).toBeDefined();
	});
});

// ─── JSONB Columns ─────────────────────────────────────────────────────────

describe("Schema — JSONB Columns", () => {
	test("messages has jsonb metadata column", () => {
		const meta = colByName(messages, "metadata");
		expect(meta?.columnType).toBe("PgJsonb");
	});

	test("threads has jsonb metadata column", () => {
		const meta = colByName(threads, "metadata");
		expect(meta?.columnType).toBe("PgJsonb");
	});

	test("runs has jsonb model_config and usage columns", () => {
		expect(colByName(runs, "model_config")?.columnType).toBe("PgJsonb");
		expect(colByName(runs, "usage")?.columnType).toBe("PgJsonb");
	});

	test("agent_types has jsonb model_config and capabilities columns", () => {
		expect(colByName(agentTypes, "model_config")?.columnType).toBe("PgJsonb");
		expect(colByName(agentTypes, "capabilities")?.columnType).toBe("PgJsonb");
	});

	test("tools has jsonb parameters_schema column", () => {
		const ps = colByName(tools, "parameters_schema");
		expect(ps?.columnType).toBe("PgJsonb");
	});
});

// ─── Timestamps ────────────────────────────────────────────────────────────

describe("Schema — Timestamps", () => {
	test("all tables have created_at timestamp", () => {
		for (const table of allTables) {
			const ts = colByName(table, "created_at");
			expect(ts).toBeDefined();
			expect(ts?.hasDefault).toBe(true);
		}
	});

	test("tables have correct timestamp columns", () => {
		const timestampTables = [
			{ table: users, hasUpdated: true },
			{ table: threads, hasUpdated: true },
			{ table: messages, hasUpdated: false },
			{ table: runs, hasUpdated: false },
			{ table: runSteps, hasUpdated: false },
			{ table: toolCalls, hasUpdated: false },
			{ table: agentTypes, hasUpdated: true },
			{ table: tools, hasUpdated: true },
			{ table: inviteCodes, hasUpdated: false },
			{ table: settings, hasUpdated: true },
		];
		for (const { table, hasUpdated } of timestampTables) {
			const created = colByName(table, "created_at");
			expect(created).toBeDefined();
			expect(created?.hasDefault).toBe(true);
			if (hasUpdated) {
				const updated = colByName(table, "updated_at");
				expect(updated).toBeDefined();
				expect(updated?.hasDefault).toBe(true);
			}
		}
	});
});

// ─── Unique Constraints ────────────────────────────────────────────────────

describe("Schema — Unique Constraints", () => {
	test("users has unique constraint on email", () => {
		const emailCol = colByName(users, "email");
		expect(emailCol?.uniqueName).toBeDefined();
		expect(emailCol?.uniqueName).toContain("email");
	});

	test("agent_types has unique constraint on name", () => {
		const nameCol = colByName(agentTypes, "name");
		expect(nameCol?.uniqueName).toBeDefined();
		expect(nameCol?.uniqueName).toContain("name");
	});

	test("tools has unique constraint on name", () => {
		const nameCol = colByName(tools, "name");
		expect(nameCol?.uniqueName).toBeDefined();
		expect(nameCol?.uniqueName).toContain("name");
	});

	test("invite_codes has unique constraint on code", () => {
		const codeCol = colByName(inviteCodes, "code");
		expect(codeCol?.uniqueName).toBeDefined();
		expect(codeCol?.uniqueName).toContain("code");
	});
});

// ─── Nullable/Required Columns ─────────────────────────────────────────────

describe("Schema — Nullable/Required Columns", () => {
	test("agentTypeId on messages is nullable", () => {
		expect(colByName(messages, "agent_type_id")?.notNull).toBe(false);
	});

	test("agentTypes toolIds is a nullable array", () => {
		const toolIds = colByName(agentTypes, "tool_ids");
		expect(toolIds).toBeDefined();
		expect(toolIds?.notNull).toBe(false);
		expect(toolIds?.columnType).toBe("PgArray");
	});
});
