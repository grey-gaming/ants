import { eq, count } from 'drizzle-orm';
import { agentTypes } from '@ants/store';
import type { AgentType, NewAgentType } from '@ants/store';
import { NotFoundError, ValidationError } from '../lib/errors';
import { generateId } from '../lib/utils';

/**
 * CRUD service for agent_types table.
 */
class AgentService {
  public async create(input: Omit<NewAgentType, 'id' | 'createdAt' | 'updatedAt'> & { toolIds?: string[] | null }): Promise<AgentType> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    if (!input.name || !input.name.trim()) {
      throw new ValidationError('Agent name is required');
     }

    if (!input.description || !input.description.trim()) {
      throw new ValidationError('Agent description is required');
     }

    const [agent] = await $db.insert(agentTypes).values({
      id: generateId(),
      name: input.name.trim(),
      tier: input.tier,
      description: input.description.trim(),
      modelConfig: input.modelConfig ?? null,
      capabilities: input.capabilities ?? null,
      toolIds: input.toolIds ?? null,
      active: input.active ?? true,
     }).returning();

    return agent;
    }

  public async getById(id: string): Promise<AgentType | null> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [agent] = await $db.select().from(agentTypes).where(eq(agentTypes.id, id));
    return agent ?? null;
    }

  public async getByName(name: string): Promise<AgentType | null> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [agent] = await $db.select().from(agentTypes).where(eq(agentTypes.name, name));
    return agent ?? null;
    }

  public async list(options?: { activeOnly?: boolean }): Promise<AgentType[]> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const { activeOnly = true } = options ?? {};

    if (activeOnly) {
      return $db
          .select()
          .from(agentTypes)
          .where(eq(agentTypes.active, true));
      }

    return $db.select().from(agentTypes);
    }

  public async update(id: string, input: Partial<NewAgentType>): Promise<AgentType> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError('AgentType', id);
      }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) {
      if (!input.name.trim()) throw new ValidationError('Agent name cannot be empty');
      updates.name = input.name.trim();
      }

    if (input.tier !== undefined) updates.tier = input.tier;
    if (input.description !== undefined) updates.description = input.description;
    if (input.modelConfig !== undefined) updates.modelConfig = input.modelConfig;
    if (input.capabilities !== undefined) updates.capabilities = input.capabilities;
    if (input.toolIds !== undefined) updates.toolIds = input.toolIds;
    if (input.active !== undefined) updates.active = input.active;

    const [agent] = await $db.update(agentTypes).set(updates).where(eq(agentTypes.id, id)).returning();
    return agent;
    }

  public async remove(id: string): Promise<void> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError('AgentType', id);
      }

    await $db.delete(agentTypes).where(eq(agentTypes.id, id));
    }

  public async count(): Promise<number> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [row] = await $db.select({ count: count() }).from(agentTypes);
    return Number(row.count);
    }
}

export const agentService = new AgentService();
