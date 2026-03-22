import type { ISkill, SkillConfig, SkillContext, SkillResult } from '@spazzatura/core';
import { execSync } from 'child_process';

const config: SkillConfig = {
  id: 'code-review',
  name: 'Code Review',
  version: '1.0.0',
  description: 'Systematic pre-review checklist before merging work.',
  category: 'review',
  author: 'superpowers',
  tags: ['review', 'quality', 'checklist'],
  mode: 'async',
  parameters: [
    { name: 'branch', type: 'string', description: 'Branch to review (default: current)', required: false },
  ],
};

export const codeReviewSkill: ISkill = {
  id: config.id,
  config,

  validate(_parameters: Record<string, unknown>): boolean {
    return true;
  },

  async execute(context: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const branch = (context.parameters['branch'] as string | undefined) ?? 'HEAD';

    let diffSummary = '';
    try {
      diffSummary = execSync(`git diff --stat ${branch}~1..${branch}`, {
        cwd: context.workingDirectory,
        encoding: 'utf-8',
      }).trim();
    } catch {
      diffSummary = '(could not get diff — not a git repo or no commits)';
    }

    const output = [
      `# Code Review: ${branch}`,
      '',
      '## Diff Summary',
      diffSummary || '(no changes)',
      '',
      '## Checklist',
      '- [ ] Tests pass',
      '- [ ] No new lint errors',
      '- [ ] No hardcoded secrets or credentials',
      '- [ ] Error paths handled',
      '- [ ] Types are correct (no `any` without justification)',
      '- [ ] No dead code left behind',
      '- [ ] Commit message is clear',
      '- [ ] PR description explains the "why"',
    ].join('\n');

    return {
      success: true,
      output,
      duration: Date.now() - start,
      artifacts: [{ type: 'markdown', name: 'code-review-checklist.md', content: output }],
    };
  },
};
