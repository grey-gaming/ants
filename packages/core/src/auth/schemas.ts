import { z } from 'zod';

export const CreateThreadSchema = z.object({
  title: z.string().min(1).max(512),
  metadata: z.record(z.unknown()).optional(),
});

export const UpdateThreadSchema = z.object({
  title: z.string().min(1).max(512).optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateMessageSchema = z.object({
  role: z.enum(['user', 'assistant', 'system']),
  content: z.string().min(1),
  agentTypeId: z.string().uuid().optional(),
  metadata: z.record(z.unknown()).optional(),
});

export const CreateRunSchema = z.object({
  threadId: z.string().uuid(),
  agentTypeId: z.string().uuid(),
  parentRunId: z.string().uuid().optional(),
  modelConfig: z.record(z.unknown()).optional(),
});

export const CancelRunSchema = z.object({
  runId: z.string().uuid(),
});

export const CreateAgentTypeSchema = z.object({
  name: z.string().min(1).max(256),
  tier: z.enum(['T1', 'T2', 'T3']),
  description: z.string().max(2048),
  modelConfig: z.record(z.unknown()).optional(),
  capabilities: z.record(z.unknown()).optional(),
  toolIds: z.array(z.string().uuid()).optional(),
});

export const UpdateAgentTypeSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  tier: z.enum(['T1', 'T2', 'T3']).optional(),
  description: z.string().max(2048).optional(),
  modelConfig: z.record(z.unknown()).optional(),
  capabilities: z.record(z.unknown()).optional(),
  toolIds: z.array(z.string().uuid()).optional(),
  active: z.boolean().optional(),
});

export const CreateToolSchema = z.object({
  name: z.string().min(1).max(256),
  description: z.string().max(2048),
  parametersSchema: z.record(z.unknown()).optional(),
  type: z.enum(['function', 'builtin']),
});

export const UpdateToolSchema = z.object({
  name: z.string().min(1).max(256).optional(),
  description: z.string().max(2048).optional(),
  parametersSchema: z.record(z.unknown()).optional(),
  type: z.enum(['function', 'builtin']).optional(),
  active: z.boolean().optional(),
});

export const CreateApiKeySchema = z.object({
  name: z.string().min(1).max(256),
});
