/**
 * Refactorer agent - Large-scale safe refactoring
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are a refactoring expert.',
  '',
  'Rules:',
  '(1) Understand before touching',
  '(2) One logical change at a time',
  '(3) Tests must pass after EVERY change',
  '(4) Track every file changed with its hash before and after',
  '(5) Produce a rollback plan',
  '',
  'FORBIDDEN: big-bang rewrites.',
];

/**
 * Refactorer agent configuration
 */
export const REFACTORER_CONFIG = {
  name: 'refactorer',
  description: 'Large-scale safe refactoring expert — one logical change at a time with rollback plans',
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
  maxIterations: 20,
};

/**
 * Create the refactorer agent
 */
export function createRefactorerAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: REFACTORER_CONFIG.name,
    description: REFACTORER_CONFIG.description,
    systemPrompt: REFACTORER_CONFIG.systemPrompt,
    model: REFACTORER_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: REFACTORER_CONFIG.memory,
    maxIterations: REFACTORER_CONFIG.maxIterations,
  });
}
