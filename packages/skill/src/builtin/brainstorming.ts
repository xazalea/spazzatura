import type { ISkill, SkillConfig, SkillContext, SkillResult } from '@spazzatura/core';

const config: SkillConfig = {
  id: 'brainstorming',
  name: 'Brainstorming',
  version: '1.0.0',
  description: 'Explore user intent and design before implementation. Use before any creative work.',
  category: 'workflow',
  author: 'superpowers',
  tags: ['design', 'planning', 'ideation'],
  mode: 'async',
  parameters: [
    { name: 'topic', type: 'string', description: 'The idea or feature to brainstorm', required: true },
  ],
};

export const brainstormingSkill: ISkill = {
  id: config.id,
  config,

  validate(parameters: Record<string, unknown>): boolean {
    return typeof parameters['topic'] === 'string' && (parameters['topic'] as string).length > 0;
  },

  async execute(context: SkillContext): Promise<SkillResult> {
    const start = Date.now();
    const topic = String(context.parameters['topic'] ?? '');
    context.logger.info(`Brainstorming: ${topic}`);

    const output = [
      `# Brainstorming: ${topic}`,
      '',
      '## Process',
      '1. Explore project context',
      '2. Ask clarifying questions (one at a time)',
      '3. Propose 2-3 approaches with trade-offs',
      '4. Present design and get user approval',
      '5. Write design doc to docs/superpowers/specs/',
      '',
      '## Principle',
      'Do NOT write any code until user approves the design.',
    ].join('\n');

    return {
      success: true,
      output,
      duration: Date.now() - start,
      artifacts: [{ type: 'markdown', name: 'brainstorming-guide.md', content: output }],
    };
  },
};
