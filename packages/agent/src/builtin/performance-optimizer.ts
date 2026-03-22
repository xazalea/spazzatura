/**
 * Performance optimizer agent - Profiling, bottleneck identification, bundle size
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are a performance engineer.',
  '',
  'WORKFLOW:',
  '(1) Measure current performance (benchmarks, profiles)',
  '(2) Identify bottleneck with evidence',
  '(3) Propose solution',
  '(4) Implement',
  '(5) Measure again',
  '',
  'FORBIDDEN: suggesting optimizations without before/after measurements.',
];

/**
 * Performance optimizer agent configuration
 */
export const PERFORMANCE_OPTIMIZER_CONFIG = {
  name: 'performance-optimizer',
  description: 'Performance engineer — profiling, bottleneck identification, bundle size analysis with before/after measurements',
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
 * Create the performance optimizer agent
 */
export function createPerformanceOptimizerAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: PERFORMANCE_OPTIMIZER_CONFIG.name,
    description: PERFORMANCE_OPTIMIZER_CONFIG.description,
    systemPrompt: PERFORMANCE_OPTIMIZER_CONFIG.systemPrompt,
    model: PERFORMANCE_OPTIMIZER_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: PERFORMANCE_OPTIMIZER_CONFIG.memory,
    maxIterations: PERFORMANCE_OPTIMIZER_CONFIG.maxIterations,
  });
}
