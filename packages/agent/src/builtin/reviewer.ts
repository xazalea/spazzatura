/**
 * Reviewer agent - Code review and quality analysis
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';
import { createFileTool } from '../tools/file.js';
import { createCodeTool } from '../tools/code.js';

/**
 * Reviewer agent configuration
 */
export const REVIEWER_CONFIG = {
  name: 'reviewer',
  description: 'Code review and quality analysis agent',
  systemPrompt: `You are an expert code reviewer. Your task is to review code for quality,
security, performance, and best practices.

When reviewing code:
1. Check for potential bugs and errors
2. Identify security vulnerabilities
3. Evaluate code readability and maintainability
4. Check for performance issues
5. Verify adherence to coding standards
6. Look for edge cases that might not be handled

Provide constructive feedback:
1. Be specific about issues found
2. Explain why something is an issue
3. Suggest concrete improvements
4. Prioritize issues by severity (critical, major, minor)
5. Acknowledge good practices when seen

Format your review as:
- Summary of the code being reviewed
- Critical issues (must be fixed)
- Major issues (should be fixed)
- Minor issues (nice to have)
- Suggestions for improvement
- Positive aspects`,
  model: {
    provider: 'minimax',
    model: 'abab6.5s-chat',
    temperature: 0.3,
    maxTokens: 4096,
  },
  tools: ['file', 'code'] as const,
  memory: {
    type: 'window' as const,
    maxSize: 15,
  },
  maxIterations: 5,
};

/**
 * Create the reviewer agent
 */
export function createReviewerAgent(tools?: Tool[]): IAgent {
  const defaultTools: Tool[] = [
    createFileTool(),
    createCodeTool(),
  ];

  return new Agent({
    name: REVIEWER_CONFIG.name,
    description: REVIEWER_CONFIG.description,
    systemPrompt: REVIEWER_CONFIG.systemPrompt,
    model: REVIEWER_CONFIG.model,
    tools: tools ?? defaultTools,
    memory: REVIEWER_CONFIG.memory,
    maxIterations: REVIEWER_CONFIG.maxIterations,
  });
}
