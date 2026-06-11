import { config } from "./config";

export type LogLevel = "debug" | "info" | "warn" | "error";

const levelPriority: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  service: string;
  trace_id: string | null;
  user_id: string | null;
  thread_id: string | null;
  run_id: string | null;
  agent_type: string | null;
  message: string;
  details?: Record<string, unknown>;
}

function shouldLog(level: LogLevel): boolean {
  return levelPriority[level] >= levelPriority[config.logLevel];
}

export function log(
  level: LogLevel,
  service: string,
  message: string,
  context?: {
    trace_id?: string;
    user_id?: string;
    thread_id?: string;
    run_id?: string;
    agent_type?: string;
    details?: Record<string, unknown>;
  },
): void {
  if (!shouldLog(level)) return;

  const entry: LogEntry = {
    timestamp: new Date().toISOString(),
    level,
    service,
    trace_id: context?.trace_id ?? null,
    user_id: context?.user_id ?? null,
    thread_id: context?.thread_id ?? null,
    run_id: context?.run_id ?? null,
    agent_type: context?.agent_type ?? null,
    message,
    details: context?.details,
  };

  process.stdout.write(JSON.stringify(entry) + "\n");
}

export const logger = {
  debug: (service: string, message: string, context?: Parameters<typeof log>[3]) =>
    log("debug", service, message, context),
  info: (service: string, message: string, context?: Parameters<typeof log>[3]) =>
    log("info", service, message, context),
  warn: (service: string, message: string, context?: Parameters<typeof log>[3]) =>
    log("warn", service, message, context),
  error: (service: string, message: string, context?: Parameters<typeof log>[3]) =>
    log("error", service, message, context),
};
