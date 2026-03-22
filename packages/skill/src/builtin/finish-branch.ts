import type { ISkill, SkillConfig, SkillContext, SkillResult } from '@spazzatura/core';
import { execSync } from 'child_process';

const config: SkillConfig = {
  id: 'finish-branch',
  name: 'Finish Branch',
  version: '1.0.0',
  description: 'Structured workflow to complete a development branch: merge, PR, or cleanup.',
  category: 'workflow',
  author: 'superpowers',
  tags: ['git', 'merge', 'pr', 'cleanup'],
  mode: 'async',
  parameters: [
    { name: 'strategy', type: 'string', description: 'merge | pr | squash', required: false, default: 'pr', enum: ['merge', 'pr', 'squash'] },
  ],
};

export const finishBranchSkill: ISkill = {
  id: config.id,
  config,

  validate(_parameters: Record<string, unknown>): boolean {
    return true;
  },

  async execute(context: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const strategy = String(context.parameters['strategy'] ?? 'pr');

    let currentBranch = 'unknown';
    let status = '';
    try {
      currentBranch = execSync('git branch --show-current', {
        cwd: context.workingDirectory, encoding: 'utf-8',
      }).trim();
      status = execSync('git status --short', {
        cwd: context.workingDirectory, encoding: 'utf-8',
      }).trim();
    } catch { /* ignore */ }

    const output = [
      `# Finish Branch: ${currentBranch}`,
      `Strategy: ${strategy}`,
      '',
      status ? `## Uncommitted Changes\n\`\`\`\n${status}\n\`\`\`` : '## Status: clean',
      '',
      '## Checklist Before Finishing',
      '- [ ] All tests pass',
      '- [ ] No lint errors',
      '- [ ] Commits are clean and descriptive',
      '- [ ] Feature works end-to-end',
      '',
      strategy === 'pr'
        ? '## Next: Create Pull Request\n`gh pr create --title "..." --body "..."`'
        : strategy === 'merge'
          ? '## Next: Merge to main\n`git checkout main && git merge --no-ff ' + currentBranch + '`'
          : '## Next: Squash and merge\n`git checkout main && git merge --squash ' + currentBranch + '`',
    ].join('\n');

    return {
      success: true,
      output,
      duration: Date.now() - start,
      artifacts: [{ type: 'markdown', name: 'finish-branch.md', content: output }],
    };
  },
};
