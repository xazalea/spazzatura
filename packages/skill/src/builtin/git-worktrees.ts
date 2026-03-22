import type { ISkill, SkillConfig, SkillContext, SkillResult } from '@spazzatura/core';
import { execSync } from 'child_process';

const config: SkillConfig = {
  id: 'git-worktrees',
  name: 'Git Worktrees',
  version: '1.0.0',
  description: 'Create isolated git worktrees for feature development without polluting current workspace.',
  category: 'workflow',
  author: 'superpowers',
  tags: ['git', 'isolation', 'worktree'],
  mode: 'async',
  parameters: [
    { name: 'branch', type: 'string', description: 'Branch name for the new worktree', required: true },
    { name: 'base', type: 'string', description: 'Base branch (default: main)', required: false },
  ],
};

export const gitWorktreesSkill: ISkill = {
  id: config.id,
  config,

  validate(parameters: Record<string, unknown>): boolean {
    return typeof parameters['branch'] === 'string' && (parameters['branch'] as string).length > 0;
  },

  async execute(context: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const branch = String(context.parameters['branch']);
    const base = String(context.parameters['base'] ?? 'main');

    let worktreePath = '';
    let created = false;

    try {
      worktreePath = `/tmp/worktree-${branch.replace(/[^a-z0-9-]/gi, '-')}`;
      execSync(`git worktree add -b ${branch} ${worktreePath} ${base}`, {
        cwd: context.workingDirectory,
        encoding: 'utf-8',
      });
      created = true;
      context.logger.info(`Worktree created at ${worktreePath}`);
    } catch (e) {
      context.logger.error(`Failed to create worktree: ${String(e)}`);
    }

    const output = created
      ? [
          `# Git Worktree: ${branch}`,
          '',
          `Path: \`${worktreePath}\``,
          `Base: \`${base}\``,
          '',
          '## Usage',
          `\`cd ${worktreePath}\` — work in isolation`,
          '`git worktree list` — see all worktrees',
          `\`git worktree remove ${worktreePath}\` — cleanup when done`,
        ].join('\n')
      : `Failed to create worktree for branch '${branch}'. Check logs.`;

    return {
      success: created,
      output,
      duration: Date.now() - start,
      ...(created ? { artifacts: [{ type: 'text' as const, name: 'worktree-path', content: worktreePath }] } : {}),
    };
  },
};
