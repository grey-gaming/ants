import type { ZodType } from "zod";
import type { Tool, ToolResult } from "../types/tool";

export abstract class BaseTool<S extends ZodType> implements Tool {
  abstract name: string;
  abstract description: string;
  abstract parameters: S;

  async execute(input: unknown): Promise<ToolResult> {
    const result = this.parameters.safeParse(input);

    if (!result.success) {
      const errors = result.error.issues
        .map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`)
        .join("; ");
      return { success: false, error: `Validation failed: ${errors}` };
    }

    return this._execute(result.data);
  }

  protected abstract _execute(input: S["_output"]): Promise<ToolResult>;
}
