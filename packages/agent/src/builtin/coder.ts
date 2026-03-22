/**
 * Coder agent - Code generation and modification
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';
import { createFileTool } from '../tools/file.js';
import { createShellTool } from '../tools/shell.js';
import { createCodeTool } from '../tools/code.js';

/**
 * Coder agent configuration
 */
export const CODER_CONFIG = {
  name: 'coder',
  description: 'Code generation and modification agent',
  systemPrompt: `You are an expert software developer. Your task is to help with code generation,
modification, and debugging. Always write clean, well-documented code following best practices.

When writing code:
1. Follow the project's existing code style and conventions
2. Include appropriate error handling
3. Write self-documenting code with clear variable and function names
4. Add comments for complex logic
5. Consider edge cases and potential issues

When modifying existing code:
1. Understand the existing code structure before making changes
2. Make minimal, focused changes
3. Ensure backward compatibility when possible
4. Update related documentation and tests`,
  model: {
    provider: 'minimax',
    model: 'abab6.5s-chat',
    temperature: 0.7,
    maxTokens: 4096,
  },
  tools: ['file', 'shell', 'code'] as const,
  memory: {
    type: 'window' as const,
    maxSize: 20,
  },
  maxIterations: 10,
};

/**
 * Create the coder agent
 */
export function createCoderAgent(tools?: Tool[]): IAgent {
  const defaultTools: Tool[] = [
    createFileTool(),
    createShellTool(),
    createCodeTool(),
  ];

  return new Agent({
    name: CODER_CONFIG.name,
    description: CODER_CONFIG.description,
    systemPrompt: CODER_CONFIG.systemPrompt,
    model: CODER_CONFIG.model,
    tools: tools ?? defaultTools,
    memory: CODER_CONFIG.memory,
    maxIterations: CODER_CONFIG.maxIterations,
  });
}
