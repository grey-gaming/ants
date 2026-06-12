import { z } from "zod";
import { paginationCursorSchema } from "./pagination";

export const createThreadSchema = z.object({
  title: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const updateThreadSchema = z.object({
  title: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createRunSchema = z.object({
  threadId: z.string().uuid(),
  messages: z.array(z.string()).min(1),
});

export const updateRunStatusSchema = z.object({
  status: z.enum(["in_progress", "paused", "cancelled"]),
  reason: z.string().optional(),
});

export const registerAgentSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(1),
  tier: z.enum(["T1", "T2", "T3"]),
  metadata: z.record(z.unknown()).optional(),
});

export const updateAgentSchema = z.object({
  name: z.string().optional(),
  prompt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const createMessageSchema = z.object({
  threadId: z.string().uuid(),
  role: z.enum(["user", "system", "assistant"]),
  content: z.string().min(1),
});

export const getMessageListSchema = z.object({
  threadId: z.string().uuid(),
  cursor: paginationCursorSchema.optional(),
});

export const registerToolSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["function", "builtin"]),
  metadata: z.record(z.unknown()).optional(),
});

export const updateToolSchema = z.object({
  name: z.string().optional(),
  description: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const settingUpsertSchema = z.object({
  storeKey: z.string().min(1),
  storeValue: z.unknown(),
});

export const createThreadRequestSchema = z.object({
  title: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
});

export const createRunRequestSchema = z.object({
  threadId: z.string().uuid(),
  messages: z.array(z.string()).min(1),
});

export const updateRunStatusRequestSchema = z.object({
  status: z.enum(["in_progress", "paused", "cancelled"]),
  reason: z.string().optional(),
});

export const registerAgentRequestSchema = z.object({
  name: z.string().min(1),
  prompt: z.string().min(1),
  tier: z.enum(["T1", "T2", "T3"]),
  metadata: z.record(z.unknown()).optional(),
});

export const updateAgentRequestSchema = z.object({
  name: z.string().optional(),
  prompt: z.string().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const registerToolRequestSchema = z.object({
  name: z.string().min(1),
  description: z.string().min(1),
  type: z.enum(["function", "builtin"]),
  metadata: z.record(z.unknown()).optional(),
});

export const settingUpsertRequestSchema = z.object({
  storeKey: z.string().min(1),
  storeValue: z.unknown(),
});
