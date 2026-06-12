import type { Tool, ToolResult } from "../types/tool";
import { logger } from "@ants/core";
import type { ZodType } from "zod";

export abstract class BaseTool<T extends ZodType = ZodType> implements Tool {
  public name!: string;
  public description!: string;
  public parameters!: T;

  protected constructor(def?: { name: string; description: string }) {
    if (def) {
      this.name = def.name;
      this.description = def.description;
    }
  }

  async execute(input: unknown): Promise<ToolResult> {
    logger.info("tools", `Executing tool "${this.name}"`);
    const parsed = this.parameters?.safeParse(input);
    if (parsed && !parsed.success) {
      return { success: false, error: `Validation failed: ${parsed.error.message}` };
    }
    const result = await this._execute(parsed?.data ?? input);
    logger.info("tools", `${this.name} executed successfully`);
    return result;
  }

  protected abstract _execute(input: unknown): Promise<ToolResult>;
}
