import type { LLMProvider, Message } from "@ants/llm";
import {
	agentTypes,
	messages,
	runSteps,
	runs,
	threads,
	toolCalls,
	tools,
} from "@ants/store";
import type { Tool } from "@ants/tools";
import { toolRegistry } from "@ants/tools";
import { and, eq, inArray, isNull } from "drizzle-orm";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type {
	AgentService,
	MessageService,
	RunService,
	ToolService,
} from "../index";
import { InternalError, logger, NotFoundError, truncateOutput } from "../index";
import { eventBus } from "./event-bus";

// ---------------------------------------------------------------------------
// Event types for SSE streaming
// ---------------------------------------------------------------------------

export type RunEvent =
	| { type: "run_start"; runId: string; agentName: string }
	| { type: "run_step_start"; stepId: string; stepType: string }
	| { type: "run_step_complete"; stepId: string; stepType: string }
	| {
			type: "tool_call_start";
			toolCallId: string;
			toolName: string;
			args: Record<string, unknown>;
	  }
	| { type: "tool_call_complete"; toolCallId: string; result: string }
	| { type: "tool_call_fail"; toolCallId: string; error: string }
	| { type: "message_delta"; runId: string; content: string }
	| { type: "run_complete"; runId: string }
	| { type: "run_fail"; runId: string; error: string };

// ---------------------------------------------------------------------------
// Run executor — dequeues a run, invokes LLM, processes tool calls, persists
// ---------------------------------------------------------------------------

interface RunExecutorInput {
	runId: string;
	userId: string;
	threadId: string;
	agentTypeId: string;
	llmProvider: LLMProvider;
}

export function createRunExecutor(
	db: PostgresJsDatabase,
	runService: RunService,
	messageService: MessageService,
	_agentService: AgentService,
	toolDbService: ToolService,
) {
	async function execute({
		runId,
		userId,
		threadId,
		agentTypeId,
		llmProvider,
	}: RunExecutorInput): Promise<void> {
		const [run] = await db
			.select()
			.from(runs)
			.where(and(eq(runs.id, runId), eq(runs.userId, userId)));
		if (!run) throw new NotFoundError("Run", runId);

		const [thread] = await db
			.select()
			.from(threads)
			.where(and(eq(threads.id, threadId), eq(threads.userId, userId)));
		if (!thread) throw new NotFoundError("Thread", threadId);

		const [agentType] = await db
			.select()
			.from(agentTypes)
			.where(eq(agentTypes.id, agentTypeId));
		if (!agentType) throw new NotFoundError("AgentType", agentTypeId);

		// Load agent's tools from DB
		const toolRows = agentType.toolIds
			? await db
					.select()
					.from(tools)
					.where(
						and(eq(tools.active, true), inArray(tools.id, agentType.toolIds)),
					)
			: [];

		// Load thread messages
		const threadMessages = await db
			.select()
			.from(messages)
			.where(eq(messages.threadId, threadId))
			.orderBy(messages.createdAt);

		// Build tool definition string for the system prompt
		const toolDefinitions = toolRows
			.map((t) => {
				const params = t.parametersSchema as Record<string, unknown>;
				const props = params.properties || {};
				const required = Array.isArray(params.required) ? params.required : [];
				const paramDesc = Object.entries(props as Record<string, unknown>)
					.map(([k, v]) => {
						const val = v as Record<string, unknown>;
						const req = required.includes(k) ? " (required)" : " (optional)";
						return `    ${k}: ${val.type || "string"} - ${val.description || ""}${req}`;
					})
					.join("\n");
				return `Tool: ${t.name}
Description: ${t.description}
Parameters:
${paramDesc}
`;
			})
			.join("\n");

		const toolInstructions =
			toolRows.length > 0
				? `
You have access to the following tools. Use them by including the tool call in your response using the exact format:
[TOOL_CALL:toolName]({"param1": "value1", "param2": "value2"})

${toolDefinitions}

IMPORTANT: 
- Use the exact [TOOL_CALL:name](json) format
- The JSON arguments must be valid JSON on a single line
- After using a tool, continue your reasoning or answer the user's question based on the tool result
- If you don't need a tool, just respond naturally to the user`
				: "";

		// Build LLM message history
		let llmMessages: Message[] = threadMessages
			.filter((m) => m.role === "user" || m.role === "system")
			.map((m) => ({ role: m.role as "user" | "system", content: m.content }));

		const systemContent = `${agentType.description || "You are a helpful assistant."}${toolInstructions}`;
		if (llmMessages.length === 0) {
			llmMessages = [{ role: "system", content: systemContent }];
		} else if (llmMessages[0].role === "system") {
			// Inject tool instructions into existing system message
			llmMessages[0] = { role: "system", content: systemContent };
		} else {
			llmMessages.unshift({ role: "system", content: systemContent });
		}

		await runService.updateStatus(runId, "in_progress");
		eventBus.emit({ type: "run_start", runId, agentName: agentType.name });

		let assistantContent = "";
		let hasToolCalls = true;

		while (hasToolCalls) {
			const [step] = await db
				.insert(runSteps)
				.values({
					runId,
					type: "reasoning",
					status: "in_progress",
					details: { model: agentType.name },
				})
				.returning();

			eventBus.emit({
				type: "run_step_start",
				stepId: step.id,
				stepType: "reasoning",
			});

			try {
				const result = await llmProvider.chatCompletion(llmMessages);
				assistantContent = result.content;

				// Check for tool calls in the LLM response
				const rawContent = result.content;
				const toolCallsData = extractToolCallsFromResponse(rawContent);

				if (toolCallsData.length > 0) {
					for (const tc of toolCallsData) {
						const toolRow = toolRows.find((t) => t.name === tc.name);
						const toolCallId = `tc_${crypto.randomUUID()}`;

						const [tcRow] = await db
							.insert(toolCalls)
							.values({
								runStepId: step.id,
								toolId: toolRow?.id,
								name: tc.name,
								arguments: tc.args,
								status: "in_progress",
							})
							.returning();

						eventBus.emit({
							type: "tool_call_start",
							toolCallId: toolCallId,
							toolName: tc.name,
							args: tc.args,
						});

						try {
							const toolResult = await executeTool(toolRow, tc.args);
							await db
								.update(toolCalls)
								.set({
									status: "completed",
									result: toolResult,
									completedAt: new Date(),
								})
								.where(eq(toolCalls.id, tcRow.id));

							eventBus.emit({
								type: "tool_call_complete",
								toolCallId: toolCallId,
								result: JSON.stringify(toolResult),
							});

							llmMessages.push({ role: "assistant", content: "" });
							llmMessages.push({
								role: "user",
								content: `Tool "${tc.name}" result: ${JSON.stringify(toolResult)}`,
							});
						} catch (err) {
							const msg = err instanceof Error ? err.message : String(err);
							await db
								.update(toolCalls)
								.set({
									status: "failed",
									result: { error: msg },
									completedAt: new Date(),
								})
								.where(eq(toolCalls.id, tcRow.id));

							eventBus.emit({
								type: "tool_call_fail",
								toolCallId: toolCallId,
								error: msg,
							});
						}
					}
				} else {
					hasToolCalls = false;
				}

				await db
					.update(runSteps)
					.set({ status: "completed", completedAt: new Date() })
					.where(eq(runSteps.id, step.id));

				eventBus.emit({
					type: "message_delta",
					runId,
					content: assistantContent,
				});
				eventBus.emit({
					type: "run_step_complete",
					stepId: step.id,
					stepType: "reasoning",
				});

				// Save assistant message
				await messageService.create(userId, {
					threadId,
					role: "assistant",
					content: truncateOutput(assistantContent, 50000),
					agentTypeId,
				});
			} catch (err) {
				await db
					.update(runSteps)
					.set({ status: "failed", completedAt: new Date() })
					.where(eq(runSteps.id, step.id));

				await runService.updateStatus(runId, "failed");
				const msg = err instanceof Error ? err.message : String(err);
				logger.error("executor", `Run ${runId} failed: ${msg}`);
				eventBus.emit({ type: "run_fail", runId, error: msg });
				throw new InternalError(`Run execution failed: ${msg}`);
			}
		}

		// Mark run complete
		await runService.updateStatus(runId, "completed");
		eventBus.emit({ type: "run_complete", runId });
		logger.info("executor", `Run ${runId} completed successfully`);
	}

	return { execute };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ParsedToolCall {
	name: string;
	args: Record<string, unknown>;
}

function extractToolCallsFromResponse(content: string): ParsedToolCall[] {
	const calls: ParsedToolCall[] = [];
	const regex = /\[TOOL_CALL:(\w+)\]\(([^)]+)\)/g;
	let match;
	while ((match = regex.exec(content)) !== null) {
		try {
			const args = JSON.parse(match[2]);
			calls.push({ name: match[1], args });
		} catch {
			// Skip malformed tool calls
		}
	}
	return calls;
}

async function executeTool(
	toolRow:
		| { name: string; description: string; parametersSchema: unknown }
		| undefined,
	args: Record<string, unknown>,
): Promise<Record<string, unknown>> {
	if (!toolRow) {
		return { error: `Unknown tool, result: ${JSON.stringify(args)}` };
	}

	// Execute through the tool registry — resolves to the actual tool class
	const result = await toolRegistry.execute(toolRow.name, args);
	if (!result.success) {
		return { success: false, error: result.error ?? "Tool execution failed" };
	}
	return { success: true, data: result.data };
}
