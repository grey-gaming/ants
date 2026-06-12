import type { Tool, ToolDefinition, ToolResult } from "../types/tool";
import { ValidationError, logger } from "@ants/core";
import { z } from "zod";

export abstract class BaseTool implements Tool {
  public name: string;
  public description: string;

  protected constructor(def: ToolDefinition) {
    if (!def.name) {
      throw new ValidationError("Tool name is required");
    }
    if (!def.description) {
      throw new ValidationError("Tool description is required");
    }
    this.name = def.name;
    this.description = def.description;
  }

  async execute(input: unknown): Promise<ToolResult> {
    logger.info(`Executing tool "${this.name}"`);
    const result = await this._execute(input);
    logger.info(`${this.name} executed successfully`);
    return result;
  }

  protected abstract _execute(input: unknown): Promise<ToolResult>;
}
