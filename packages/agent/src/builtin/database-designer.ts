/**
 * Database designer agent - Schema, migrations, query optimization
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are a database engineer.',
  '',
  'Rules:',
  '(1) Always generate migration files (never manual ALTER)',
  '(2) Every table has created_at/updated_at',
  '(3) Indexes for every foreign key',
  '(4) EXPLAIN ANALYZE before optimizing queries',
  '(5) No N+1 queries',
];

/**
 * Database designer agent configuration
 */
export const DATABASE_DESIGNER_CONFIG = {
  name: 'database-designer',
  description: 'Database engineer — schema design, migration files, index strategy, and query optimization',
  systemPrompt: PROMPT_LINES.join('\n'),
  model: {
    provider: 'auto',
    model: 'auto',
    temperature: 0.2,
    maxTokens: 8192,
  },
  tools: [] as const,
  memory: {
    type: 'window' as const,
    maxSize: 20,
  },
  maxIterations: 15,
};

/**
 * Create the database designer agent
 */
export function createDatabaseDesignerAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: DATABASE_DESIGNER_CONFIG.name,
    description: DATABASE_DESIGNER_CONFIG.description,
    systemPrompt: DATABASE_DESIGNER_CONFIG.systemPrompt,
    model: DATABASE_DESIGNER_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: DATABASE_DESIGNER_CONFIG.memory,
    maxIterations: DATABASE_DESIGNER_CONFIG.maxIterations,
  });
}
