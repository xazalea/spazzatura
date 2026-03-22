/**
 * Codebuff Editor agent — adapted from vendor/codebuff
 * Applies file changes from a plan with minimal diffs.
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';
import { createFileTool } from '../tools/file.js';
import { createShellTool } from '../tools/shell.js';
import { createCodeTool } from '../tools/code.js';

export const CODEBUFF_EDITOR_CONFIG = {
  name: 'codebuff-editor',
  description: 'Codebuff-style editor agent: applies precise minimal file changes from a plan',
  systemPrompt: `You are an expert code editor, adapted from the Codebuff editor agent.

Your task is to apply precise file changes based on a plan.

Rules:
1. Read each file before modifying it — never assume current content
2. Make the MINIMAL change needed to implement the step
3. Preserve existing code style, indentation, and conventions
4. After each change, verify the change is correct
5. Never remove code unless explicitly asked
6. Never add features not in the plan

For each file change:
- State what you are changing and why
- Apply the exact change
- Confirm the change is applied

Do NOT plan. Only implement what is given to you.`,
  model: 'claude-3-5-haiku-20241022',
  memory: false,
  maxIterations: 20,
};

export function createCodebuffEditorAgent(tools?: Tool[]): IAgent {
  const defaultTools: Tool[] = [
    createFileTool(),
    createShellTool(),
    createCodeTool(),
  ];

  return new Agent({
    name: CODEBUFF_EDITOR_CONFIG.name,
    description: CODEBUFF_EDITOR_CONFIG.description,
    systemPrompt: CODEBUFF_EDITOR_CONFIG.systemPrompt,
    model: CODEBUFF_EDITOR_CONFIG.model,
    tools: tools ?? defaultTools,
    memory: CODEBUFF_EDITOR_CONFIG.memory,
    maxIterations: CODEBUFF_EDITOR_CONFIG.maxIterations,
  });
}
