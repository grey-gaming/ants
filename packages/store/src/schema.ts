import {
  pgTable,
  uuid,
  varchar,
  text,
  jsonb,
  pgEnum,
  timestamp,
  boolean,
  unique,
  index,
} from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import { relations } from 'drizzle-orm';

// ─── Enum Definitions ─────────────────────────────────────────────────────

export const messageRoleEnum = pgEnum('message_role', [
  'user',
  'assistant',
  'system',
]);

export const runStatusEnum = pgEnum('run_status', [
  'queued',
  'in_progress',
  'awaiting_response',
  'paused',
  'completed',
  'failed',
  'cancelled',
]);

export const runStepTypeEnum = pgEnum('run_step_type', [
  'message_creation',
  'tool_call',
  'agent_delegation',
  'reasoning',
]);

export const runStepStatusEnum = pgEnum('run_step_status', [
  'in_progress',
  'completed',
  'failed',
]);

export const toolCallStatusEnum = pgEnum('tool_call_status', [
  'in_progress',
  'completed',
  'failed',
]);

export const tierEnum = pgEnum('tier', ['T1', 'T2', 'T3']);

export const toolTypeEnum = pgEnum('tool_type', ['function', 'builtin']);

export const jobQueuePriorityEnum = pgEnum('job_queue_priority', [
  'critical',
  'high',
  'normal',
  'low',
]);

// ─── Table: users ─────────────────────────────────────────────────────────

export const users = pgTable('users', {
  id: uuid('id').primaryKey().defaultRandom(),
  email: varchar('email', { length: 255 }).notNull(),
  name: text('name').notNull(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  usersEmailKey: unique().on(t.email),
}));

// ─── Table: api_keys ──────────────────────────────────────────────────────

export const apiKeys = pgTable('api_keys', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id),
  keyHash: text('key_hash').notNull(),
  name: text('name').notNull(),
  lastUsedAt: timestamp('last_used_at'),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  apiKeysUserIdIdx: index().on(t.userId),
  apiKeysKeyHashKey: unique().on(t.keyHash),
}));

// ─── Table: threads ───────────────────────────────────────────────────────

export const threads = pgTable('threads', {
  id: uuid('id').primaryKey().$default(() => sql`gen_random_uuid()`),
  userId: uuid('user_id').notNull().references(() => users.id),
  title: text('title').notNull(),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  threadsUserIdIdx: index().on(t.userId),
}));

// ─── Table: agent_types ───────────────────────────────────────────────────

export const agentTypes = pgTable('agent_types', {
  id: uuid('id').primaryKey().$default(() => sql`gen_random_uuid()`),
  name: text('name').notNull(),
  tier: tierEnum('tier').notNull(),
  description: text('description').notNull(),
  modelConfig: jsonb('model_config').$type<Record<string, unknown>>(),
  capabilities: jsonb('capabilities').$type<Record<string, unknown>>(),
  toolIds: uuid('tool_ids').array(),
  active: boolean('active').notNull().default(true),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  agentTypesNameKey: unique().on(t.name),
}));

// ─── Table: tools ─────────────────────────────────────────────────────────

export const tools = pgTable('tools', {
  id: uuid('id').primaryKey().$default(() => sql`gen_random_uuid()`),
  name: text('name').notNull(),
  description: text('description').notNull(),
  parametersSchema: jsonb('parameters_schema').$type<Record<string, unknown>>(),
  type: toolTypeEnum('type').notNull(),
  active: boolean('active').notNull().default(true),
  createdBy: uuid('created_by').references(() => users.id),
  updatedBy: uuid('updated_by').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  toolsNameKey: unique().on(t.name),
  toolsCreatedByIdx: index().on(t.createdBy),
}));

// ─── Table: invite_codes ──────────────────────────────────────────────────

export const inviteCodes = pgTable('invite_codes', {
  id: uuid('id').primaryKey().$default(() => sql`gen_random_uuid()`),
  code: varchar('code', { length: 64 }).notNull(),
  used: boolean('used').notNull().default(false),
  expiresAt: timestamp('expires_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  inviteCodesCodeKey: unique().on(t.code),
}));

// ─── Table: settings ──────────────────────────────────────────────────────

export const settings = pgTable('settings', {
  id: uuid('id').primaryKey().$default(() => sql`gen_random_uuid()`),
  key: varchar('key', { length: 255 }).notNull(),
  value: jsonb('value').$type<Record<string, unknown>>(),
  isGlobal: boolean('is_global').notNull().default(true),
  userId: uuid('user_id').references(() => users.id),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  updatedAt: timestamp('updated_at').defaultNow().notNull(),
}, (t) => ({
  settingsKeyIdx: index().on(t.key),
  settingsUserIdIdx: index().on(t.userId),
}));

// ─── Table: job_queue ─────────────────────────────────────────────────────

export const jobQueue = pgTable('job_queue', {
  id: uuid('id').primaryKey().$default(() => sql`gen_random_uuid()`),
  runId: uuid('run_id').notNull().references(() => runs.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  threadId: uuid('thread_id').notNull().references(() => threads.id),
  priority: jobQueuePriorityEnum('priority').notNull().default('normal'),
  status: varchar('status', { length: 20 }).notNull().default('waiting'),
  enqueuedAt: timestamp('enqueued_at').defaultNow().notNull(),
  processedAt: timestamp('processed_at'),
}, (t) => ({
  jobQueueStatusIdx: index().on(t.status),
  jobQueuePriorityEnqueuedIdx: index().on(t.priority, t.enqueuedAt),
}));

// ─── Table: messages ──────────────────────────────────────────────────────

export const messages = pgTable('messages', {
  id: uuid('id').primaryKey().$default(() => sql`gen_random_uuid()`),
  threadId: uuid('thread_id').notNull().references(() => threads.id),
  role: messageRoleEnum('role').notNull(),
  content: text('content').notNull(),
  agentTypeId: uuid('agent_type_id').references(() => agentTypes.id),
  metadata: jsonb('metadata').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  messagesThreadIdIdx: index().on(t.threadId),
}));

// ─── Table: runs ──────────────────────────────────────────────────────────

export const runs = pgTable('runs', {
  id: uuid('id').primaryKey().$default(() => sql`gen_random_uuid()`),
  threadId: uuid('thread_id').notNull().references(() => threads.id),
  userId: uuid('user_id').notNull().references(() => users.id),
  agentTypeId: uuid('agent_type_id').notNull().references(() => agentTypes.id),
  parentRunId: uuid('parent_run_id'),
  status: runStatusEnum('status').notNull().default('queued'),
  modelConfig: jsonb('model_config').$type<Record<string, unknown>>(),
  usage: jsonb('usage').$type<Record<string, unknown>>(),
  startedAt: timestamp('started_at'),
  completedAt: timestamp('completed_at'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
}, (t) => ({
  runsThreadIdIdx: index().on(t.threadId),
  runsUserIdIdx: index().on(t.userId),
  runsAgentTypeIdIdx: index().on(t.agentTypeId),
  runsStatusIdx: index().on(t.status),
  runsParentRunIdIdx: index().on(t.parentRunId),
}));

// ─── Table: run_steps ─────────────────────────────────────────────────────

export const runSteps = pgTable('run_steps', {
  id: uuid('id').primaryKey().$default(() => sql`gen_random_uuid()`),
  runId: uuid('run_id').notNull().references(() => runs.id),
  type: runStepTypeEnum('type').notNull(),
  status: runStepStatusEnum('status').notNull().default('in_progress'),
  details: jsonb('details').$type<Record<string, unknown>>(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (t) => ({
  runStepsRunIdIdx: index().on(t.runId),
}));

// ─── Table: tool_calls ────────────────────────────────────────────────────

export const toolCalls = pgTable('tool_calls', {
  id: uuid('id').primaryKey().$default(() => sql`gen_random_uuid()`),
  runStepId: uuid('run_step_id').notNull().references(() => runSteps.id),
  toolId: uuid('tool_id').notNull().references(() => tools.id),
  name: text('name').notNull(),
  arguments: jsonb('arguments').$type<Record<string, unknown>>(),
  result: jsonb('result').$type<Record<string, unknown>>(),
  status: toolCallStatusEnum('status').notNull().default('in_progress'),
  createdAt: timestamp('created_at').defaultNow().notNull(),
  completedAt: timestamp('completed_at'),
}, (t) => ({
  toolCallsRunStepIdIdx: index().on(t.runStepId),
  toolCallsToolIdIdx: index().on(t.toolId),
}));

// ─── Relations ────────────────────────────────────────────────────────────

export const usersRelations = relations(users, ({ many }) => ({
  apiKeys: many(apiKeys),
  threads: many(threads),
  settings: many(settings),
}));

export const apiKeysRelations = relations(apiKeys, ({ one }) => ({
  user: one(users, { fields: [apiKeys.userId], references: [users.id] }),
}));

export const threadsRelations = relations(threads, ({ many }) => ({
  messages: many(messages),
  runs: many(runs),
}));

export const agentTypesRelations = relations(agentTypes, ({ many }) => ({
  runs: many(runs),
  messages: many(messages),
}));

export const toolsRelations = relations(tools, ({ many }) => ({
  toolCalls: many(toolCalls),
}));

export const messagesRelations = relations(messages, ({ one }) => ({
  thread: one(threads, { fields: [messages.threadId], references: [threads.id] }),
  agentType: one(agentTypes, { fields: [messages.agentTypeId], references: [agentTypes.id] }),
}));

export const runsRelations = relations(runs, ({ one, many }) => ({
  thread: one(threads, { fields: [runs.threadId], references: [threads.id] }),
  agentType: one(agentTypes, { fields: [runs.agentTypeId], references: [agentTypes.id] }),
  parentRun: one(runs, {
    fields: [runs.parentRunId],
    references: [runs.id],
  }),
  runSteps: many(runSteps),
}));

export const runStepsRelations = relations(runSteps, ({ one, many }) => ({
  run: one(runs, { fields: [runSteps.runId], references: [runs.id] }),
  toolCalls: many(toolCalls),
}));

export const toolCallsRelations = relations(toolCalls, ({ one }) => ({
  runStep: one(runSteps, { fields: [toolCalls.runStepId], references: [runSteps.id] }),
  tool: one(tools, { fields: [toolCalls.toolId], references: [tools.id] }),
}));

export const settingsRelations = relations(settings, ({ one }) => ({
  user: one(users, { fields: [settings.userId], references: [users.id] }),
}));

export const jobQueueRelations = relations(jobQueue, ({ one }) => ({
  run: one(runs, { fields: [jobQueue.runId], references: [runs.id] }),
  user: one(users, { fields: [jobQueue.userId], references: [users.id] }),
  thread: one(threads, { fields: [jobQueue.threadId], references: [threads.id] }),
}));

// ─── Type Exports ─────────────────────────────────────────────────────────

export type User = typeof users.$inferSelect;
export type NewUser = typeof users.$inferInsert;

export type ApiKey = typeof apiKeys.$inferSelect;
export type NewApiKey = typeof apiKeys.$inferInsert;

export type Thread = typeof threads.$inferSelect;
export type NewThread = typeof threads.$inferInsert;

export type Message = typeof messages.$inferSelect;
export type NewMessage = typeof messages.$inferInsert;

export type Run = typeof runs.$inferSelect;
export type NewRun = typeof runs.$inferInsert;

export type RunStep = typeof runSteps.$inferSelect;
export type NewRunStep = typeof runSteps.$inferInsert;

export type ToolCall = typeof toolCalls.$inferSelect;
export type NewToolCall = typeof toolCalls.$inferInsert;

export type AgentType = typeof agentTypes.$inferSelect;
export type NewAgentType = typeof agentTypes.$inferInsert;

export type Tool = typeof tools.$inferSelect;
export type NewTool = typeof tools.$inferInsert;

export type InviteCode = typeof inviteCodes.$inferSelect;
export type NewInviteCode = typeof inviteCodes.$inferInsert;

export type Setting = typeof settings.$inferSelect;
export type NewSetting = typeof settings.$inferInsert;

export type JobQueue = typeof jobQueue.$inferSelect;
export type NewJobQueue = typeof jobQueue.$inferInsert;
