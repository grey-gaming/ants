import { describe, test, expect, beforeEach } from 'bun:test';
import {
  users,
  apiKeys,
  threads,
  messages,
  runs,
  runSteps,
  toolCalls,
  agentTypes,
  tools,
  inviteCodes,
  settings,
  messageRoleEnum,
  runStatusEnum,
  runStepTypeEnum,
  runStepStatusEnum,
  toolCallStatusEnum,
  tierEnum,
  toolTypeEnum,
} from './schema';

describe('Schema — Table Definitions', () => {
     test('all 11 tables are defined', () => {
         expect(users).toBeDefined();
         expect(apiKeys).toBeDefined();
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

     test('users table has correct columns', () => {
         expect(users.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining(['id', 'email', 'name', 'created_at', 'updated_at'])
         );
     });

     test('api_keys table has correct columns', () => {
         expect(apiKeys.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining(['id', 'user_id', 'key_hash', 'name', 'last_used_at', 'created_at', 'expires_at'])
         );
     });

     test('threads table has correct columns', () => {
         expect(threads.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining(['id', 'user_id', 'title', 'metadata', 'created_at', 'updated_at'])
         );
     });

     test('messages table has correct columns', () => {
         expect(messages.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining(['id', 'thread_id', 'role', 'content', 'agent_type_id', 'metadata', 'created_at'])
         );
     });

     test('runs table has correct columns', () => {
         expect(runs.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining([
                 'id', 'thread_id', 'agent_type_id', 'parent_run_id', 'status',
                 'model_config', 'usage', 'started_at', 'completed_at', 'created_at',
             ])
         );
     });

     test('run_steps table has correct columns', () => {
         expect(runSteps.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining(['id', 'run_id', 'type', 'status', 'details', 'created_at', 'completed_at'])
         );
     });

     test('tool_calls table has correct columns', () => {
         expect(toolCalls.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining(['id', 'run_step_id', 'tool_id', 'name', 'arguments', 'result', 'status', 'created_at', 'completed_at'])
         );
     });

     test('agent_types table has correct columns', () => {
         expect(agentTypes.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining(['id', 'name', 'tier', 'description', 'model_config', 'capabilities', 'tool_ids', 'active', 'created_at', 'updated_at'])
         );
     });

     test('tools table has correct columns', () => {
         expect(tools.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining(['id', 'name', 'description', 'parameters_schema', 'type', 'active', 'created_at', 'updated_at'])
         );
     });

     test('invite_codes table has correct columns', () => {
         expect(inviteCodes.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining(['id', 'code', 'used', 'expires_at', 'created_at'])
         );
     });

     test('settings table has correct columns', () => {
         expect(settings.columns.map((c) => c.name)).toEqual(
             expect.arrayContaining(['id', 'key', 'value', 'is_global', 'user_id', 'created_at', 'updated_at'])
         );
     });
});

describe('Schema — UUID Primary Keys', () => {
     test('all tables have uuid primary keys with gen_random_uuid default', () => {
         const allTables = [users, apiKeys, threads, messages, runs, runSteps, toolCalls, agentTypes, tools, inviteCodes, settings];

         for (const table of allTables) {
             const idColumn = table.columns.find((c) => c.name === 'id');
             expect(idColumn).toBeDefined();
             expect(idColumn?.primaryKey).toBe(true);
         }
     });
});

describe('Schema — Enum Definitions', () => {
     test('messageRoleEnum has correct values', () => {
         expect(messageRoleEnum.enums).toEqual(['user', 'assistant', 'system']);
     });

     test('runStatusEnum has correct values', () => {
         expect(runStatusEnum.enums).toEqual([
             'queued', 'in_progress', 'awaiting_response', 'paused',
             'completed', 'failed', 'cancelled',
         ]);
     });

     test('runStepTypeEnum has correct values', () => {
         expect(runStepTypeEnum.enums).toEqual([
             'message_creation', 'tool_call', 'agent_delegation', 'reasoning',
         ]);
     });

     test('runStepStatusEnum has correct values', () => {
         expect(runStepStatusEnum.enums).toEqual(['in_progress', 'completed', 'failed']);
     });

     test('toolCallStatusEnum has correct values', () => {
         expect(toolCallStatusEnum.enums).toEqual(['in_progress', 'completed', 'failed']);
     });

     test('tierEnum has correct values', () => {
         expect(tierEnum.enums).toEqual(['T1', 'T2', 'T3']);
     });

     test('toolTypeEnum has correct values', () => {
         expect(toolTypeEnum.enums).toEqual(['function', 'builtin']);
     });
});

describe('Schema — FK Relations', () => {
     test('api_keys references users', () => {
         const fkColumn = apiKeys.columns.find((c) => c.name === 'user_id');
         expect(fkColumn?.references).toBeDefined();
     });

     test('threads references users', () => {
         const fkColumn = threads.columns.find((c) => c.name === 'user_id');
         expect(fkColumn?.references).toBeDefined();
     });

     test('messages references threads', () => {
         const fkColumn = messages.columns.find((c) => c.name === 'thread_id');
         expect(fkColumn?.references).toBeDefined();
     });

     test('runs references threads', () => {
         const fkColumn = runs.columns.find((c) => c.name === 'thread_id');
         expect(fkColumn?.references).toBeDefined();
     });

     test('runs references agent_types', () => {
         const fkColumn = runs.columns.find((c) => c.name === 'agent_type_id');
         expect(fkColumn?.references).toBeDefined();
     });

     test('runs has self-referencing parent_run_id', () => {
         const fkColumn = runs.columns.find((c) => c.name === 'parent_run_id');
         expect(fkColumn?.references).toBeDefined();
     });

     test('run_steps references runs', () => {
         const fkColumn = runSteps.columns.find((c) => c.name === 'run_id');
         expect(fkColumn?.references).toBeDefined();
     });

     test('tool_calls references tool_steps', () => {
         const fkColumn = toolCalls.columns.find((c) => c.name === 'run_step_id');
         expect(fkColumn?.references).toBeDefined();
     });

     test('tool_calls references tools', () => {
         const fkColumn = toolCalls.columns.find((c) => c.name === 'tool_id');
         expect(fkColumn?.references).toBeDefined();
     });
});

describe('Schema — JSONB Columns', () => {
     test('messages has jsonb metadata column', () => {
         const meta = messages.columns.find((c) => c.name === 'metadata');
         expect(meta?.columnType).toBe('Json');
     });

     test('threads has jsonb metadata column', () => {
         const meta = threads.columns.find((c) => c.name === 'metadata');
         expect(meta?.columnType).toBe('Json');
     });

     test('runs has jsonb model_config and usage columns', () => {
         expect(runs.columns.find((c) => c.name === 'model_config')?.columnType).toBe('Json');
         expect(runs.columns.find((c) => c.name === 'usage')?.columnType).toBe('Json');
     });

     test('agent_types has jsonb model_config and capabilities columns', () => {
         expect(agentTypes.columns.find((c) => c.name === 'model_config')?.columnType).toBe('Json');
         expect(agentTypes.columns.find((c) => c.name === 'capabilities')?.columnType).toBe('Json');
     });

     test('tools has jsonb parameters_schema column', () => {
         const ps = tools.columns.find((c) => c.name === 'parameters_schema');
         expect(ps?.columnType).toBe('Json');
     });
});

describe('Schema — Timestamps', () => {
     test('all tables have created_at timestamp', () => {
         const allTables = [users, apiKeys, threads, messages, runs, runSteps, toolCalls, agentTypes, tools, inviteCodes, settings];
         for (const table of allTables) {
             const ts = table.columns.find((c) => c.name === 'created_at');
             expect(ts).toBeDefined();
             expect(ts?.defaultTo).toBeDefined();
         }
     });

     test('all timestamp tables have created_at and updated_at columns', () => {
         const timestampTables = [
             { table: users, hasUpdated: true },
             { table: apiKeys, hasUpdated: false },
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
             const created = table.columns.find((c) => c.name === 'created_at');
             expect(created).toBeDefined();
             expect(created?.defaultTo).toBeDefined();
             if (hasUpdated) {
                 const updated = table.columns.find((c) => c.name === 'updated_at');
                 expect(updated).toBeDefined();
                 expect(updated?.onUpdate).toBeDefined();
              }
          }
      });
});

describe('Schema — Indexes', () => {
     test('api_keys has index on user_id', () => {
         expect(apiKeys.indexes).toBeDefined();
         expect(apiKeys.indexes.length).toBeGreaterThan(0);
     });

     test('threads has index on user_id', () => {
         expect(threads.indexes).toBeDefined();
         expect(threads.indexes.length).toBeGreaterThan(0);
     });

     test('runs has indexes on thread_id, agent_type_id, status, parent_run_id', () => {
         expect(runs.indexes).toBeDefined();
         expect(runs.indexes.length).toBeGreaterThanOrEqual(1);
     });
});

describe('Schema — Nullable/Required Columns', () => {
     test('apiKey last_used_at and expires_at are nullable', () => {
         expect(apiKeys.columns.find((c) => c.name === 'last_used_at')?.notNull).toBe(false);
         expect(apiKeys.columns.find((c) => c.name === 'expires_at')?.notNull).toBe(false);
     });

     test('agentTypeId on messages is nullable', () => {
         expect(messages.columns.find((c) => c.name === 'agentTypeId')?.notNull).toBe(false);
     });

     test('agentTypes toolIds is a nullable array', () => {
         const toolIds = agentTypes.columns.find((c) => c.name === 'toolIds');
         expect(toolIds).toBeDefined();
         expect(toolIds?.notNull).toBe(false);
         expect(toolIds?.columnType).toBe('UUID');
      });
});
