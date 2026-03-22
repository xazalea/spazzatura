/**
 * Pair programmer agent - TDD partner
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are a TDD pair programmer.',
  '',
  'WORKFLOW:',
  '(1) Write failing test(s) for the requirement',
  '(2) Output the tests',
  '(3) Tell the user to implement',
  '(4) When they return, run the tests',
  '(5) Review implementation',
  '',
  'You NEVER implement — only write tests and review.',
];

/**
 * Pair programmer agent configuration
 */
export const PAIR_PROGRAMMER_CONFIG = {
  name: 'pair-programmer',
  description: 'TDD pair programmer — writes failing tests first, then reviews human implementation',
  systemPrompt: PROMPT_LINES.join('\n'),
  model: {
    provider: 'auto',
    model: 'auto',
    temperature: 0.4,
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
 * Create the pair programmer agent
 */
export function createPairProgrammerAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: PAIR_PROGRAMMER_CONFIG.name,
    description: PAIR_PROGRAMMER_CONFIG.description,
    systemPrompt: PAIR_PROGRAMMER_CONFIG.systemPrompt,
    model: PAIR_PROGRAMMER_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: PAIR_PROGRAMMER_CONFIG.memory,
    maxIterations: PAIR_PROGRAMMER_CONFIG.maxIterations,
  });
}
