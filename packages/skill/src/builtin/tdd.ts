import type { ISkill, SkillConfig, SkillContext, SkillResult } from '@spazzatura/core';

const config: SkillConfig = {
  id: 'tdd',
  name: 'Test-Driven Development',
  version: '1.0.0',
  description: 'RED-GREEN-REFACTOR cycle. Write failing test first, then minimal code to pass.',
  category: 'testing',
  author: 'superpowers',
  tags: ['tdd', 'testing', 'red-green-refactor'],
  mode: 'async',
  parameters: [
    { name: 'feature', type: 'string', description: 'Feature or bugfix to implement via TDD', required: true },
  ],
};

export const tddSkill: ISkill = {
  id: config.id,
  config,

  validate(parameters: Record<string, unknown>): boolean {
    return typeof parameters['feature'] === 'string';
  },

  async execute(context: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const feature = String(context.parameters['feature'] ?? '');
    context.logger.info(`TDD cycle for: ${feature}`);

    const output = [
      `# TDD: ${feature}`,
      '',
      '## RED Phase',
      '- Write a failing test that describes the desired behavior',
      '- Run test — confirm it FAILS (if it passes, the test is wrong)',
      '',
      '## GREEN Phase',
      '- Write the MINIMUM code to make the test pass',
      '- No refactoring yet — just make it green',
      '',
      '## REFACTOR Phase',
      '- Clean up code while keeping tests green',
      '- Remove duplication, improve naming',
      '',
      '## Rule',
      'Never skip watching the test fail. That is the whole point.',
    ].join('\n');

    return {
      success: true,
      output,
      duration: Date.now() - start,
      artifacts: [{ type: 'markdown', name: 'tdd-guide.md', content: output }],
    };
  },
};
