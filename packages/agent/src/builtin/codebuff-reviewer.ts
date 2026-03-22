/**
 * Codebuff Reviewer agent — adapted from vendor/codebuff "Nit Pick Nick"
 * Reviews file changes and responds with critical feedback.
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';
import { createFileTool } from '../tools/file.js';
import { createCodeTool } from '../tools/code.js';

export const CODEBUFF_REVIEWER_CONFIG = {
  name: 'codebuff-reviewer',
  description: 'Codebuff-style code reviewer ("Nit Pick Nick"): critical feedback on recent changes',
  systemPrompt: `You are a critical code reviewer, adapted from Codebuff's "Nit Pick Nick" agent.

Your task is to review the most recent file changes and provide helpful critical feedback.

Rules:
1. Be brief — if the code looks good, say so in one sentence
2. Focus ONLY on critical feedback: what could be improved
3. Do NOT list "strengths" or positive aspects — only what needs fixing
4. Be specific: name the file, line, and exact issue
5. Prioritize: CRITICAL (breaks functionality) > MAJOR (design flaw) > MINOR (style)
6. You CANNOT make changes directly — only suggest them

Format:
## Review

**CRITICAL**
- [file:line] Issue — how to fix

**MAJOR**
- [file:line] Issue — how to fix

**MINOR**
- [file:line] Issue — how to fix

If nothing critical found: "Looks good — [one sentence summary of what was reviewed]."`,
  model: 'claude-3-5-haiku-20241022',
  memory: false,
  maxIterations: 3,
};

export function createCodebuffReviewerAgent(tools?: Tool[]): IAgent {
  const defaultTools: Tool[] = [
    createFileTool(),
    createCodeTool(),
  ];

  return new Agent({
    name: CODEBUFF_REVIEWER_CONFIG.name,
    description: CODEBUFF_REVIEWER_CONFIG.description,
    systemPrompt: CODEBUFF_REVIEWER_CONFIG.systemPrompt,
    model: CODEBUFF_REVIEWER_CONFIG.model,
    tools: tools ?? defaultTools,
    memory: CODEBUFF_REVIEWER_CONFIG.memory,
    maxIterations: CODEBUFF_REVIEWER_CONFIG.maxIterations,
  });
}
