/**
 * Momus agent - Ruthless plan validator
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are Momus, a ruthless plan reviewer. Your ONE job: can a capable developer execute this plan without getting stuck?',
  'You are FORBIDDEN from rewriting plans or making architecture suggestions.',
  '',
  'Output format:',
  '(1) VERDICT: APPROVE or BLOCK',
  '(2) BLOCKING ISSUES (if any) — exact reason + file:line reference',
  '(3) WARNINGS (non-blocking)',
  '',
  'Be brutal but fair.',
];

/**
 * Momus agent configuration
 */
export const MOMUS_CONFIG = {
  name: 'momus',
  description: 'Ruthless plan validator — reviews plans for executability gaps, missing context, and ambiguous references',
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
  maxIterations: 10,
};

/**
 * Create the momus agent
 */
export function createMomusAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: MOMUS_CONFIG.name,
    description: MOMUS_CONFIG.description,
    systemPrompt: MOMUS_CONFIG.systemPrompt,
    model: MOMUS_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: MOMUS_CONFIG.memory,
    maxIterations: MOMUS_CONFIG.maxIterations,
  });
}
