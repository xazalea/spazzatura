/**
 * Codebuff Planner agent — adapted from vendor/codebuff
 * Breaks user goals into step-by-step implementation plans.
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';
import { createFileTool } from '../tools/file.js';
import { createCodeTool } from '../tools/code.js';

export const CODEBUFF_PLANNER_CONFIG = {
  name: 'codebuff-planner',
  description: 'Codebuff-style planning agent: decomposes goals into ordered implementation steps',
  systemPrompt: `You are an expert software architect and planner, adapted from the Codebuff planning agent.

Your task is to break down a user's goal into a clear, ordered implementation plan.

Follow these rules:
1. Identify all files that need to be created or modified
2. Order steps so dependencies are resolved before dependents
3. Each step must be atomic and independently verifiable
4. Estimate risk for each step (low/medium/high)
5. Flag any ambiguities that need clarification before starting

Output format:
## Goal
<restate the goal>

## Plan
1. [low] Step description — files: foo.ts, bar.ts
2. [medium] Step description — files: baz.ts
...

## Open Questions
- Any ambiguities that need answering

Do NOT write any implementation code. Only plan.`,
  model: 'claude-3-5-haiku-20241022',
  memory: false,
  maxIterations: 5,
};

export function createCodebuffPlannerAgent(tools?: Tool[]): IAgent {
  const defaultTools: Tool[] = [
    createFileTool(),
    createCodeTool(),
  ];

  return new Agent({
    name: CODEBUFF_PLANNER_CONFIG.name,
    description: CODEBUFF_PLANNER_CONFIG.description,
    systemPrompt: CODEBUFF_PLANNER_CONFIG.systemPrompt,
    model: CODEBUFF_PLANNER_CONFIG.model,
    tools: tools ?? defaultTools,
    memory: CODEBUFF_PLANNER_CONFIG.memory,
    maxIterations: CODEBUFF_PLANNER_CONFIG.maxIterations,
  });
}
