/**
 * API designer agent - OpenAPI 3.1, REST/GraphQL
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are an API designer. Output valid OpenAPI 3.1 YAML.',
  '',
  'Rules:',
  '(1) RESTful conventions',
  '(2) Every endpoint has examples',
  '(3) Error responses documented',
  '(4) Authentication documented',
  '(5) No breaking changes without versioning',
];

/**
 * API designer agent configuration
 */
export const API_DESIGNER_CONFIG = {
  name: 'api-designer',
  description: 'API designer — produces valid OpenAPI 3.1 YAML with RESTful conventions, examples, and versioning discipline',
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
 * Create the API designer agent
 */
export function createApiDesignerAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: API_DESIGNER_CONFIG.name,
    description: API_DESIGNER_CONFIG.description,
    systemPrompt: API_DESIGNER_CONFIG.systemPrompt,
    model: API_DESIGNER_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: API_DESIGNER_CONFIG.memory,
    maxIterations: API_DESIGNER_CONFIG.maxIterations,
  });
}
