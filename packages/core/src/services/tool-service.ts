import { eq, desc } from "drizzle-orm";
import { tools } from "@ants/store";
import type { Tool, NewTool } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { NotFoundError, ValidationError } from "../lib/errors";

type ToolType = NewTool["type"];

interface ToolRegisterInput {
  name: string;
  description: string;
  type: ToolType;
  parametersSchema?: Record<string, unknown> | null;
}

interface ToolUpdateInput {
  name?: string;
  description?: string;
  parametersSchema?: Record<string, unknown> | null;
}

interface ToolListOptions {
  limit?: number;
}

interface ToolService {
  register(input: ToolRegisterInput): Promise<Tool>;
  list(options?: ToolListOptions): Promise<Tool[]>;
  getById(id: string): Promise<Tool | null>;
  update(id: string, input: ToolUpdateInput): Promise<Tool>;
  deactivate(id: string): Promise<Tool>;
}

export function createToolService(db: PostgresJsDatabase): ToolService {
  async function register(input: ToolRegisterInput): Promise<Tool> {
    if (!input.name?.trim()) {
      throw new ValidationError("Tool name must not be empty");
    }

    const [tool] = await db
      .insert(tools)
      .values({
        name: input.name.trim(),
        description: input.description ?? "",
        type: input.type,
        parametersSchema: input.parametersSchema ?? null,
        active: true,
      })
      .returning();

    return tool;
  }

  async function list(options: ToolListOptions = {}): Promise<Tool[]> {
    const limit = options.limit ?? 100;
    return db
      .select()
      .from(tools)
      .where(eq(tools.active, true))
      .orderBy(desc(tools.createdAt))
      .limit(limit);
  }

  async function getById(id: string): Promise<Tool | null> {
    const [tool] = await db
      .select()
      .from(tools)
      .where(eq(tools.id, id));

    return tool ?? null;
  }

  async function update(id: string, input: ToolUpdateInput): Promise<Tool> {
    const existing = await getById(id);
    if (!existing) {
      throw new NotFoundError("Tool", id);
    }

    const updates: Partial<Tool> = {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.parametersSchema !== undefined && { parametersSchema: input.parametersSchema }),
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(tools)
      .set(updates)
      .where(eq(tools.id, id))
      .returning();

    return updated;
  }

  async function deactivate(id: string): Promise<Tool> {
    const existing = await getById(id);
    if (!existing) {
      throw new NotFoundError("Tool", id);
    }

    const [updated] = await db
      .update(tools)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(tools.id, id))
      .returning();

    return updated;
  }

  return { register, list, getById, update, deactivate };
}
