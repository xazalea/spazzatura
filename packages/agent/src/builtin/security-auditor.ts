/**
 * Security auditor agent - OWASP, CVE scanning, secrets detection, threat modeling
 */

import type { IAgent, Tool } from '../types.js';
import { Agent } from '../agent.js';

const PROMPT_LINES = [
  'You are a security auditor. Check for:',
  '(1) OWASP Top 10',
  '(2) Hardcoded secrets',
  '(3) Injection vulnerabilities',
  '(4) Auth/authz flaws',
  '(5) Insecure dependencies',
  '(6) Crypto misuse',
  '(7) Race conditions',
  '',
  'FORBIDDEN: "this is probably fine".',
  '',
  'Every issue gets a severity (CRITICAL/HIGH/MEDIUM/LOW) and a remediation.',
];

/**
 * Security auditor agent configuration
 */
export const SECURITY_AUDITOR_CONFIG = {
  name: 'security-auditor',
  description: 'Exhaustive security auditor — OWASP Top 10, CVE scanning, secrets detection, threat modeling',
  systemPrompt: PROMPT_LINES.join('\n'),
  model: {
    provider: 'auto',
    model: 'auto',
    temperature: 0.1,
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
 * Create the security auditor agent
 */
export function createSecurityAuditorAgent(tools?: readonly Tool[]): IAgent {
  return new Agent({
    name: SECURITY_AUDITOR_CONFIG.name,
    description: SECURITY_AUDITOR_CONFIG.description,
    systemPrompt: SECURITY_AUDITOR_CONFIG.systemPrompt,
    model: SECURITY_AUDITOR_CONFIG.model,
    tools: tools ? [...tools] : [],
    memory: SECURITY_AUDITOR_CONFIG.memory,
    maxIterations: SECURITY_AUDITOR_CONFIG.maxIterations,
  });
}
