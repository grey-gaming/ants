import { eq, count } from 'drizzle-orm';
import { tools } from '@ants/store';
import type { Tool, NewTool } from '@ants/store';
import { NotFoundError, ValidationError } from '../lib/errors';
import { generateId } from '../lib/utils';

/**
 * CRUD service for tools table.
 */
class ToolService {
  public async create(input: Omit<NewTool, 'id' | 'createdAt' | 'updatedAt'>): Promise<Tool> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    if (!input.name || !input.name.trim()) {
      throw new ValidationError('Tool name is required');
     }

    if (!input.description || !input.description.trim()) {
      throw new ValidationError('Tool description is required');
     }

    const [tool] = await $db.insert(tools).values({
      id: generateId(),
      name: input.name.trim(),
      description: input.description.trim(),
      parametersSchema: input.parametersSchema ?? null,
      type: input.type,
      active: true,
     }).returning();

    return tool;
    }

  public async getById(id: string): Promise<Tool | null> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [tool] = await $db.select().from(tools).where(eq(tools.id, id));
    return tool ?? null;
    }

  public async getByName(name: string): Promise<Tool | null> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [tool] = await $db.select().from(tools).where(eq(tools.name, name));
    return tool ?? null;
    }

  public async list(options?: { activeOnly?: boolean }): Promise<Tool[]> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const { activeOnly = true } = options ?? {};

    if (activeOnly) {
      return $db.select().from(tools).where(eq(tools.active, true));
      }

    return $db.select().from(tools);
    }

  public async update(id: string, input: Partial<NewTool>): Promise<Tool> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError('Tool', id);
      }

    const updates: Record<string, unknown> = { updatedAt: new Date() };

    if (input.name !== undefined) {
      if (!input.name.trim()) throw new ValidationError('Tool name cannot be empty');
      updates.name = input.name.trim();
      }

    if (input.description !== undefined) updates.description = input.description;
    if (input.parametersSchema !== undefined) updates.parametersSchema = input.parametersSchema;
    if (input.type !== undefined) updates.type = input.type;
    if (input.active !== undefined) updates.active = input.active;

    const [tool] = await $db.update(tools).set(updates).where(eq(tools.id, id)).returning();
    return tool;
    }

  public async remove(id: string): Promise<void> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const existing = await this.getById(id);
    if (!existing) {
      throw new NotFoundError('Tool', id);
      }

    await $db.delete(tools).where(eq(tools.id, id));
    }

  public async count(): Promise<number> {
    const { $db } = await import('@ants/store');
    if (!$db) throw new Error('Database not initialized');

    const [row] = await $db.select({ count: count() }).from(tools);
    return Number(row.count);
    }
}

export const toolService = new ToolService();
