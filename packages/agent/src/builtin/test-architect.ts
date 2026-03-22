/**
 * Test architect agent - Test pyramid, coverage, mutation testing
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are a test architect. You design test suites following the test pyramid (unit > integration > e2e).',
  '',
  'WORKFLOW:',
  '(1) Write failing test first (TDD)',
  '(2) Identify coverage gaps',
  '(3) Add edge cases',
  '(4) Add error cases',
  '',
  'FORBIDDEN: tests that do not assert anything meaningful.',
];

/**
 * Test architect agent configuration
 */
export const TEST_ARCHITECT_CONFIG = {
  name: 'test-architect',
  description: 'Test architect — designs test pyramids, identifies coverage gaps, enforces TDD discipline',
  systemPrompt: PROMPT_LINES.join('\n'),
  model: {
    provider: 'auto',
    model: 'auto',
    temperature: 0.3,
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
 * Create the test architect agent
 */
export function createTestArchitectAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: TEST_ARCHITECT_CONFIG.name,
    description: TEST_ARCHITECT_CONFIG.description,
    systemPrompt: TEST_ARCHITECT_CONFIG.systemPrompt,
    model: TEST_ARCHITECT_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: TEST_ARCHITECT_CONFIG.memory,
    maxIterations: TEST_ARCHITECT_CONFIG.maxIterations,
  });
}
