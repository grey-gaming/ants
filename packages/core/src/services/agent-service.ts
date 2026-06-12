import { eq, and, desc } from "drizzle-orm";
import { agentTypes } from "@ants/store";
import type { AgentType, NewAgentType } from "@ants/store";
import type { PostgresJsDatabase } from "drizzle-orm/postgres-js";
import { NotFoundError, ValidationError } from "../lib/errors";

type AgentTier = NewAgentType["tier"];

interface AgentRegisterInput {
  name: string;
  tier: AgentTier;
  description?: string;
  modelConfig?: Record<string, unknown> | null;
  capabilities?: Record<string, unknown> | null;
  toolIds?: string[] | null;
}

interface AgentUpdateInput {
  name?: string;
  description?: string;
  modelConfig?: Record<string, unknown> | null;
  capabilities?: Record<string, unknown> | null;
  toolIds?: string[] | null;
}

interface AgentListOptions {
  limit?: number;
}

interface AgentService {
  register(input: AgentRegisterInput): Promise<AgentType>;
  list(options?: AgentListOptions): Promise<AgentType[]>;
  getById(id: string): Promise<AgentType | null>;
  update(id: string, input: AgentUpdateInput): Promise<AgentType>;
  deactivate(id: string): Promise<AgentType>;
}

export function createAgentService(db: PostgresJsDatabase): AgentService {
  async function register(input: AgentRegisterInput): Promise<AgentType> {
    if (!input.name?.trim()) {
      throw new ValidationError("Agent name must not be empty");
    }

    const [agent] = await db
      .insert(agentTypes)
      .values({
        name: input.name.trim(),
        tier: input.tier,
        description: input.description ?? "",
        modelConfig: input.modelConfig ?? null,
        capabilities: input.capabilities ?? null,
        toolIds: input.toolIds ?? null,
        active: true,
      })
      .returning();

    return agent;
  }

  async function list(options: AgentListOptions = {}): Promise<AgentType[]> {
    const limit = options.limit ?? 100;
    return db
      .select()
      .from(agentTypes)
      .where(eq(agentTypes.active, true))
      .orderBy(desc(agentTypes.createdAt))
      .limit(limit);
  }

  async function getById(id: string): Promise<AgentType | null> {
    const [agent] = await db
      .select()
      .from(agentTypes)
      .where(eq(agentTypes.id, id));

    return agent ?? null;
  }

  async function update(id: string, input: AgentUpdateInput): Promise<AgentType> {
    const existing = await getById(id);
    if (!existing) {
      throw new NotFoundError("AgentType", id);
    }

    const updates: Partial<AgentType> = {
      ...(input.name !== undefined && { name: input.name.trim() }),
      ...(input.description !== undefined && { description: input.description }),
      ...(input.modelConfig !== undefined && { modelConfig: input.modelConfig }),
      ...(input.capabilities !== undefined && { capabilities: input.capabilities }),
      ...(input.toolIds !== undefined && { toolIds: input.toolIds }),
      updatedAt: new Date(),
    };

    const [updated] = await db
      .update(agentTypes)
      .set(updates)
      .where(eq(agentTypes.id, id))
      .returning();

    return updated;
  }

  async function deactivate(id: string): Promise<AgentType> {
    const existing = await getById(id);
    if (!existing) {
      throw new NotFoundError("AgentType", id);
    }

    const [updated] = await db
      .update(agentTypes)
      .set({ active: false, updatedAt: new Date() })
      .where(eq(agentTypes.id, id))
      .returning();

    return updated;
  }

  return { register, list, getById, update, deactivate };
}
