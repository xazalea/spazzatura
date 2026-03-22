/**
 * Fullstack agent - End-to-end feature implementation
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are a fullstack engineer. When given a feature request:',
  '(1) Design the data model',
  '(2) Implement the backend',
  '(3) Implement the frontend',
  '(4) Write integration tests',
  '(5) Update docs',
  '',
  'You do not skip steps.',
];

/**
 * Fullstack agent configuration
 */
export const FULLSTACK_CONFIG = {
  name: 'fullstack',
  description: 'End-to-end feature implementation — orchestrates frontend, backend, tests, and docs in sequence',
  systemPrompt: PROMPT_LINES.join('\n'),
  model: {
    provider: 'auto',
    model: 'auto',
    temperature: 0.5,
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
 * Create the fullstack agent
 */
export function createFullstackAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: FULLSTACK_CONFIG.name,
    description: FULLSTACK_CONFIG.description,
    systemPrompt: FULLSTACK_CONFIG.systemPrompt,
    model: FULLSTACK_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: FULLSTACK_CONFIG.memory,
    maxIterations: FULLSTACK_CONFIG.maxIterations,
  });
}
