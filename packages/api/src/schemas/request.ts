import { z } from "zod";
import { paginationCursorSchema } from "./pagination";

export const createThreadSchema = z.object({
  title: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const updateThreadSchema = z.object({
  title: z.string().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const createRunSchema = z.object({
  threadId: z.string().uuid(),
  agentTypeId: z.string().uuid(),
  messages: z.array(z.string()).min(1),
  modelConfig: z.record(z.string(), z.any()).optional(),
  parentRunId: z.string().uuid().optional(),
});

export const updateRunStatusSchema = z.object({
  status: z.enum(["in_progress", "paused", "cancelled"]),
  reason: z.string().optional(),
});

export const registerAgentSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(1),
  tier: z.enum(["T1", "T2", "T3"]),
  description: z.string().optional(),
  modelConfig: z.record(z.string(), z.any()).optional(),
  capabilities: z.record(z.string(), z.any()).optional(),
  toolIds: z.array(z.string()).optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().optional(),
  prompt: z.string().optional(),
  description: z.string().optional(),
  modelConfig: z.record(z.string(), z.any()).optional(),
  capabilities: z.record(z.string(), z.any()).optional(),
  toolIds: z.array(z.string()).optional(),
});

export const createMessageSchema = z.object({
  threadId: z.string().uuid(),
  role: z.enum(["user", "system", "assistant"]),
  content: z.string().min(1),
  agentTypeId: z.string().uuid().optional(),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const getMessageListSchema = z.object({
  threadId: z.string().uuid(),
  cursor: paginationCursorSchema.optional(),
});

export const registerToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["function", "builtin"]),
  parametersSchema: z.record(z.string(), z.any()).optional(),
});

export const updateToolSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  parametersSchema: z.record(z.string(), z.any()).optional(),
});

export const settingUpsertSchema = z.object({
  storeKey: z.string().min(1),
  storeValue: z.any(),
});

export const createThreadRequestSchema = z.object({
  title: z.string().min(1),
  metadata: z.record(z.string(), z.any()).optional(),
});

export const createRunRequestSchema = z.object({
  threadId: z.string().uuid(),
  agentTypeId: z.string().uuid(),
  messages: z.array(z.string()).min(1),
  modelConfig: z.record(z.string(), z.any()).optional(),
  parentRunId: z.string().uuid().optional(),
});

export const updateRunStatusRequestSchema = z.object({
  status: z.enum(["in_progress", "paused", "cancelled"]),
  reason: z.string().optional(),
});

export const registerAgentRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().optional(),
  tier: z.enum(["T1", "T2", "T3"]),
  modelConfig: z.record(z.string(), z.any()).optional(),
  capabilities: z.record(z.string(), z.any()).optional(),
  toolIds: z.array(z.string()).optional(),
});

export const updateAgentRequestSchema = z.object({
  name: z.string().optional(),
  prompt: z.string().optional(),
  description: z.string().optional(),
  modelConfig: z.record(z.string(), z.any()).optional(),
  capabilities: z.record(z.string(), z.any()).optional(),
  toolIds: z.array(z.string()).optional(),
});

export const registerToolRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["function", "builtin"]),
  parametersSchema: z.record(z.string(), z.any()).optional(),
});

export const settingUpsertRequestSchema = z.object({
  storeKey: z.string().min(1),
  storeValue: z.any(),
});

export const registerUserRequestSchema = z.object({
  email: z.string().email(),
  name: z.string().min(1),
  inviteCode: z.string().optional(),
});

export const loginRequestSchema = z.object({
  apiKey: z.string().min(1),
});

export const createApiKeyRequestSchema = z.object({
  name: z.string().min(1),
  expiresAt: z.string().datetime().optional(),
});
