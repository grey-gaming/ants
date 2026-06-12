import type { ZodType } from "zod";

export interface Tool {
  name: string;
  description: string;
  execute(input: unknown): Promise<ToolResult>;
}

export interface ToolDefinition {
  name: string;
  description: string;
  parameters: ZodType;
}

export interface ToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}
