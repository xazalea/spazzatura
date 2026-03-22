import type { ISkill, SkillConfig, SkillContext, SkillResult } from '@spazzatura/core';
import { writeFileSync, mkdirSync } from 'fs';
import { join } from 'path';

const config: SkillConfig = {
  id: 'write-plan',
  name: 'Write Plan',
  version: '1.0.0',
  description: 'Create a detailed implementation plan before touching code.',
  category: 'workflow',
  author: 'superpowers',
  tags: ['planning', 'architecture'],
  mode: 'async',
  parameters: [
    { name: 'goal', type: 'string', description: 'What needs to be built', required: true },
    { name: 'output', type: 'string', description: 'Output path for the plan file', required: false },
  ],
};

export const writePlanSkill: ISkill = {
  id: config.id,
  config,

  validate(parameters: Record<string, unknown>): boolean {
    return typeof parameters['goal'] === 'string';
  },

  async execute(context: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const goal = String(context.parameters['goal'] ?? '');
    const outputPath = context.parameters['output'] as string | undefined;

    context.logger.info(`Writing plan for: ${goal}`);

    const date = new Date().toISOString().slice(0, 10);
    const slug = goal.toLowerCase().replace(/[^a-z0-9]+/g, '-').slice(0, 40);
    const planContent = [
      `# Plan: ${goal}`,
      `Date: ${date}`,
      '',
      '## Goal',
      goal,
      '',
      '## Steps',
      '1. [ ] Understand the existing codebase',
      '2. [ ] Identify files to create/modify',
      '3. [ ] Implement changes incrementally',
      '4. [ ] Run tests at each step',
      '5. [ ] Verify the complete solution',
      '',
      '## Files to Change',
      '<!-- List files here -->',
      '',
      '## Risks',
      '<!-- List potential issues here -->',
    ].join('\n');

    if (outputPath) {
      try {
        mkdirSync(join(context.workingDirectory, 'docs', 'plans'), { recursive: true });
        const filePath = join(context.workingDirectory, outputPath);
        writeFileSync(filePath, planContent, 'utf-8');
        context.logger.info(`Plan saved to ${filePath}`);
      } catch (e) {
        context.logger.warn(`Could not save plan: ${String(e)}`);
      }
    }

    const defaultPath = `docs/plans/${date}-${slug}.md`;

    return {
      success: true,
      output: planContent,
      duration: Date.now() - start,
      artifacts: [{ type: 'markdown', name: outputPath ?? defaultPath, content: planContent }],
    };
  },
};
