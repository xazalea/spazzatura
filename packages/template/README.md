# @spazzatura/template

Template engine for Spazzatura.

## Overview

This package provides template rendering capabilities for code generation and output formatting.

## Installation

```bash
pnpm add @spazzatura/template
```

## Usage

```typescript
import { TemplateRegistry } from '@spazzatura/template';

const registry = new TemplateRegistry();

// Register a template
registry.register({
  id: 'component',
  name: 'React Component',
  format: 'handlebars',
  source: 'string',
  content: `
import React from 'react';

export interface {{pascalCase name}}Props {
  {{#each props}}
  {{name}}: {{type}};
  {{/each}}
}

export const {{pascalCase name}}: React.FC<{{pascalCase name}}Props> = (props) => {
  return <div>{{name}}</div>;
};
`,
  variables: [
    { name: 'name', type: 'string', required: true },
    { name: 'props', type: 'array', required: false },
  ],
});

// Render the template
const result = await registry.render('component', {
  variables: {
    name: 'Button',
    props: [{ name: 'label', type: 'string' }],
  },
});
```

## Supported Formats

- Handlebars
- Mustache
- EJS
- Liquid

## License

MIT
