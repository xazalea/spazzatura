# @spazzatura/skill

Skills system for Spazzatura.

## Overview

This package provides a modular skills system for extending Spazzatura's capabilities.

## Installation

```bash
pnpm add @spazzatura/skill
```

## Usage

```typescript
import { SkillRegistry, ISkill, SkillConfig } from '@spazzatura/skill';

// Define a skill
const codeReviewSkill: ISkill = {
  id: 'code-review',
  config: {
    id: 'code-review',
    name: 'Code Review',
    version: '1.0.0',
    description: 'Review code for quality and best practices',
    category: 'review',
    mode: 'sync',
  },
  async execute(context) {
    // Implementation
    return { success: true, output: 'Review complete' };
  },
  validate(params) {
    return true;
  },
};

// Register and use
const registry = new SkillRegistry();
registry.register(codeReviewSkill);

const result = await registry.execute('code-review', {
  files: ['src/index.ts'],
});
```

## Skill Categories

- `coding` - Code generation and modification
- `analysis` - Code analysis and insights
- `review` - Code review and quality
- `testing` - Test generation and execution
- `documentation` - Documentation generation
- `workflow` - Workflow automation
- `custom` - Custom skills

## License

MIT
