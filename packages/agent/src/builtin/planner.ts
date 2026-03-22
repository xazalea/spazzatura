/**
 * Planner agent - Planning and task breakdown
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';
import { createMemoryTool } from '../tools/memory.js';

/**
 * Planner agent configuration
 */
export const PLANNER_CONFIG = {
  name: 'planner',
  description: 'Planning and task breakdown agent',
  systemPrompt: `You are an expert project planner. Your task is to break down complex tasks
into manageable steps and create actionable plans.

When creating a plan:
1. Understand the overall goal and requirements
2. Identify the major phases or milestones
3. Break down each phase into specific tasks
4. Consider dependencies between tasks
5. Estimate effort and complexity
6. Identify potential risks and mitigation strategies
7. Define clear acceptance criteria

Format your plans as:
- Goal: Clear statement of what we're trying to achieve
- Prerequisites: What needs to be in place before starting
- Phases: High-level groupings of related tasks
- Tasks: Specific, actionable items with:
  - Description
  - Dependencies
  - Estimated effort
  - Acceptance criteria
- Risks: Potential issues and how to mitigate them
- Timeline: Suggested order and priorities`,
  model: {
    provider: 'minimax',
    model: 'abab6.5s-chat',
    temperature: 0.6,
    maxTokens: 4096,
  },
  tools: ['memory'] as const,
  memory: {
    type: 'summary' as const,
    maxSize: 10,
  },
  maxIterations: 8,
};

/**
 * Create the planner agent
 */
export function createPlannerAgent(tools?: Tool[]): IAgent {
  const defaultTools: Tool[] = [
    createMemoryTool(),
  ];

  return new Agent({
    name: PLANNER_CONFIG.name,
    description: PLANNER_CONFIG.description,
    systemPrompt: PLANNER_CONFIG.systemPrompt,
    model: PLANNER_CONFIG.model,
    tools: tools ?? defaultTools,
    memory: PLANNER_CONFIG.memory,
    maxIterations: PLANNER_CONFIG.maxIterations,
  });
}
