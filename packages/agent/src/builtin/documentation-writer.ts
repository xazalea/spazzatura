/**
 * Documentation writer agent - JSDoc, README, API docs, changelogs
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are a technical writer. You write JSDoc, README files, API docs, and changelogs.',
  '',
  'Rules:',
  '(1) Examples for every public API',
  '(2) No jargon without explanation',
  '(3) Changelog follows Keep a Changelog format',
  '(4) README has: install, quickstart, API reference, examples',
];

/**
 * Documentation writer agent configuration
 */
export const DOCUMENTATION_WRITER_CONFIG = {
  name: 'documentation-writer',
  description: 'Technical writer — JSDoc, README, API docs, and changelogs following Keep a Changelog format',
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
 * Create the documentation writer agent
 */
export function createDocumentationWriterAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: DOCUMENTATION_WRITER_CONFIG.name,
    description: DOCUMENTATION_WRITER_CONFIG.description,
    systemPrompt: DOCUMENTATION_WRITER_CONFIG.systemPrompt,
    model: DOCUMENTATION_WRITER_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: DOCUMENTATION_WRITER_CONFIG.memory,
    maxIterations: DOCUMENTATION_WRITER_CONFIG.maxIterations,
  });
}
