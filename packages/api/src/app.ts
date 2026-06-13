import {
  createThreadService,
  createMessageService,
  createRunService,
  createAgentService,
  createToolService,
  createQueueService,
  createUserService,
  createApiKeyService,
  createSettingsService,
  createInviteCodeService,
} from "@ants/core";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";

export type ThreadService = ReturnType<typeof createThreadService>;
export type MessageServiceT = ReturnType<typeof createMessageService>;
export type RunServiceT = ReturnType<typeof createRunService>;
export type AgentServiceT = ReturnType<typeof createAgentService>;
export type ToolServiceT = ReturnType<typeof createToolService>;
export type QueueServiceT = ReturnType<typeof createQueueService>;
export type UserServiceT = ReturnType<typeof createUserService>;
export type ApiKeyServiceT = ReturnType<typeof createApiKeyService>;
export type SettingsServiceT = ReturnType<typeof createSettingsService>;
export type InviteCodeServiceT = ReturnType<typeof createInviteCodeService>;

export interface ConfiguredServices {
  thread: ThreadService;
  message: MessageServiceT;
  run: RunServiceT;
  agent: AgentServiceT;
  tool: ToolServiceT;
  queue: QueueServiceT;
  user: UserServiceT;
  apiKey: ApiKeyServiceT;
  settings: SettingsServiceT;
  inviteCode: InviteCodeServiceT;
}

export function configureServices(db: PostgresJsDatabase): ConfiguredServices {
  return {
    thread: createThreadService(db),
    message: createMessageService(db),
    run: createRunService(db),
    agent: createAgentService(db),
    tool: createToolService(db),
    queue: createQueueService(db),
    user: createUserService(db),
    apiKey: createApiKeyService(db),
    settings: createSettingsService(db),
    inviteCode: createInviteCodeService(db),
  };
}
