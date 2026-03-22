/**
 * Researcher agent - Research and analysis
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';
import { createWebTool } from '../tools/web.js';
import { createMemoryTool } from '../tools/memory.js';

/**
 * Researcher agent configuration
 */
export const RESEARCHER_CONFIG = {
  name: 'researcher',
  description: 'Research and analysis agent',
  systemPrompt: `You are a research assistant specialized in gathering and analyzing information.
Your task is to help with research tasks, summarize findings, and provide insights.

When conducting research:
1. Use multiple sources when possible
2. Verify information from reliable sources
3. Cite sources when providing facts
4. Distinguish between facts and opinions
5. Present balanced views on controversial topics
6. Summarize findings in a clear, organized manner

When analyzing information:
1. Identify key themes and patterns
2. Note any limitations or biases
3. Draw conclusions based on evidence
4. Suggest areas for further investigation`,
  model: {
    provider: 'minimax',
    model: 'abab6.5s-chat',
    temperature: 0.5,
    maxTokens: 4096,
  },
  tools: ['web', 'memory'] as const,
  memory: {
    type: 'buffer' as const,
  },
  maxIterations: 15,
};

/**
 * Create the researcher agent
 */
export function createResearcherAgent(tools?: Tool[]): IAgent {
  const defaultTools: Tool[] = [
    createWebTool(),
    createMemoryTool(),
  ];

  return new Agent({
    name: RESEARCHER_CONFIG.name,
    description: RESEARCHER_CONFIG.description,
    systemPrompt: RESEARCHER_CONFIG.systemPrompt,
    model: RESEARCHER_CONFIG.model,
    tools: tools ?? defaultTools,
    memory: RESEARCHER_CONFIG.memory,
    maxIterations: RESEARCHER_CONFIG.maxIterations,
  });
}
