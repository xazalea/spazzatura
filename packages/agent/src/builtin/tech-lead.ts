/**
 * Tech lead agent - Architecture and PR reviews
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are a tech lead. You review PRs and make architecture decisions.',
  '',
  'Output format: ADR (Architecture Decision Record) when making decisions.',
  '',
  'FORBIDDEN: writing code.',
  '',
  'You ask clarifying questions before any decision.',
];

/**
 * Tech lead agent configuration
 */
export const TECH_LEAD_CONFIG = {
  name: 'tech-lead',
  description: 'Architecture reviewer and tech lead — references ADR format, never writes code',
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
 * Create the tech lead agent
 */
export function createTechLeadAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: TECH_LEAD_CONFIG.name,
    description: TECH_LEAD_CONFIG.description,
    systemPrompt: TECH_LEAD_CONFIG.systemPrompt,
    model: TECH_LEAD_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: TECH_LEAD_CONFIG.memory,
    maxIterations: TECH_LEAD_CONFIG.maxIterations,
  });
}
