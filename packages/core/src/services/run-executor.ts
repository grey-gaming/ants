import { eq, and, inArray, isNull } from "drizzle-orm";
import {
  runs, runSteps, toolCalls, messages,
  agentTypes, tools, threads,
} from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import type { Message, LLMProvider } from "@ants/llm";
import { toolRegistry } from "@ants/tools";
import type { Tool } from "@ants/tools";
import { NotFoundError, InternalError, logger, truncateOutput } from "../index";
import type { RunService, MessageService, AgentService, ToolService } from "../index";
import { eventBus } from "./event-bus";

// ---------------------------------------------------------------------------
// Event types for SSE streaming
// ---------------------------------------------------------------------------

export type RunEvent =
  | { type: "run_start"; runId: string; agentName: string }
  | { type: "run_step_start"; stepId: string; stepType: string }
  | { type: "run_step_complete"; stepId: string; stepType: string }
  | { type: "tool_call_start"; toolCallId: string; toolName: string; args: Record<string, unknown> }
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
  async function execute({ runId, userId, threadId, agentTypeId, llmProvider }: RunExecutorInput): Promise<void> {
    const [run] = await db.select().from(runs)
      .where(and(eq(runs.id, runId), eq(runs.userId, userId)));
    if (!run) throw new NotFoundError("Run", runId);

    const [thread] = await db.select().from(threads)
      .where(and(eq(threads.id, threadId), eq(threads.userId, userId)));
    if (!thread) throw new NotFoundError("Thread", threadId);

    const [agentType] = await db.select().from(agentTypes)
      .where(eq(agentTypes.id, agentTypeId));
    if (!agentType) throw new NotFoundError("AgentType", agentTypeId);

    // Load agent's tools from DB
    const toolRows = agentType.toolIds
      ? await db.select().from(tools)
          .where(and(eq(tools.active, true), inArray(tools.id, agentType.toolIds)))
      : [];

    // Load thread messages
    const threadMessages = await db.select()
      .from(messages)
      .where(eq(messages.threadId, threadId))
      .orderBy(messages.createdAt);

    // Build LLM message history
    let llmMessages: Message[] = threadMessages
      .filter(m => m.role === "user" || m.role === "system")
      .map(m => ({ role: m.role as "user" | "system", content: m.content }));

    if (llmMessages.length === 0) {
      llmMessages = [{ role: "system", content: agentType.description || "You are a helpful assistant." }];
    }

    await runService.updateStatus(runId, "in_progress");
    eventBus.emit({ type: "run_start", runId, agentName: agentType.name });

    let assistantContent = "";
    let hasToolCalls = true;

    while (hasToolCalls) {
      const [step] = await db.insert(runSteps).values({
        runId,
        type: "reasoning",
        status: "in_progress",
        details: { model: agentType.name },
      }).returning();

      eventBus.emit({ type: "run_step_start", stepId: step.id, stepType: "reasoning" });

      try {
        const result = await llmProvider.chatCompletion(llmMessages);
        assistantContent = result.content;

        // Check for tool calls in the LLM response
        const rawContent = result.content;
        const toolCallsData = extractToolCallsFromResponse(rawContent);

        if (toolCallsData.length > 0) {
          for (const tc of toolCallsData) {
            const toolRow = toolRows.find(t => t.name === tc.name);
            const toolCallId = `tc_${crypto.randomUUID()}`;

            const [tcRow] = await db.insert(toolCalls).values({
              runStepId: step.id,
              toolId: toolRow?.id ?? "",
              name: tc.name,
              arguments: tc.args,
              status: "in_progress",
            }).returning();

            eventBus.emit({
              type: "tool_call_start",
              toolCallId: toolCallId,
              toolName: tc.name,
              args: tc.args,
            });

            try {
              const toolResult = await executeTool(toolRow, tc.args);
              await db.update(toolCalls)
                .set({ status: "completed", result: toolResult, completedAt: new Date() })
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
              await db.update(toolCalls)
                .set({ status: "failed", result: { error: msg }, completedAt: new Date() })
                .where(eq(toolCalls.id, tcRow.id));

              eventBus.emit({ type: "tool_call_fail", toolCallId: toolCallId, error: msg });
            }
          }
        } else {
          hasToolCalls = false;
        }

        await db.update(runSteps)
          .set({ status: "completed", completedAt: new Date() })
          .where(eq(runSteps.id, step.id));

        eventBus.emit({ type: "message_delta", runId, content: assistantContent });
        eventBus.emit({ type: "run_step_complete", stepId: step.id, stepType: "reasoning" });

        // Save assistant message
        await messageService.create(userId, {
          threadId,
          role: "assistant",
          content: truncateOutput(assistantContent, 50000),
          agentTypeId,
        });
      } catch (err) {
        await db.update(runSteps)
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
  toolRow: { name: string; description: string; parametersSchema: unknown } | undefined,
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
