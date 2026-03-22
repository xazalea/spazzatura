/**
 * README template
 */

import type { BuiltinTemplate } from '../types.js';

export const readme: BuiltinTemplate = {
  id: 'readme',
  aliases: ['readme-md', 'documentation'],
  template: {
    name: 'readme',
    version: '1.0.0',
    description: 'README.md with badges and sections',
    author: 'Spazzatura',
    tags: ['readme', 'documentation', 'markdown'],
    category: 'documentation',
    variables: [
      {
        name: 'projectName',
        type: 'string',
        description: 'Name of the project',
        required: true,
      },
      {
        name: 'description',
        type: 'string',
        description: 'Project description',
        required: true,
      },
      {
        name: 'author',
        type: 'string',
        description: 'Author name',
        required: false,
      },
      {
        name: 'license',
        type: 'select',
        description: 'License type',
        required: false,
        default: 'MIT',
        options: [
          { label: 'MIT', value: 'MIT' },
          { label: 'Apache 2.0', value: 'Apache-2.0' },
          { label: 'ISC', value: 'ISC' },
          { label: 'GPL 3.0', value: 'GPL-3.0' },
          { label: 'BSD 3-Clause', value: 'BSD-3-Clause' },
          { label: 'Unlicense', value: 'Unlicense' },
        ],
      },
      {
        name: 'includeBadges',
        type: 'boolean',
        description: 'Include status badges',
        required: false,
        default: true,
      },
      {
        name: 'includeTOC',
        type: 'boolean',
        description: 'Include table of contents',
        required: false,
        default: true,
      },
      {
        name: 'includeInstall',
        type: 'boolean',
        description: 'Include installation section',
        required: false,
        default: true,
      },
      {
        name: 'includeUsage',
        type: 'boolean',
        description: 'Include usage section',
        required: false,
        default: true,
      },
      {
        name: 'includeAPI',
        type: 'boolean',
        description: 'Include API documentation section',
        required: false,
        default: false,
      },
      {
        name: 'includeContributing',
        type: 'boolean',
        description: 'Include contributing section',
        required: false,
        default: true,
      },
      {
        name: 'includeTests',
        type: 'boolean',
        description: 'Include tests section',
        required: false,
        default: true,
      },
      {
        name: 'includeChangelog',
        type: 'boolean',
        description: 'Include changelog link',
        required: false,
        default: true,
      },
      {
        name: 'packageManager',
        type: 'select',
        description: 'Package manager',
        required: false,
        default: 'npm',
        options: [
          { label: 'npm', value: 'npm' },
          { label: 'yarn', value: 'yarn' },
          { label: 'pnpm', value: 'pnpm' },
          { label: 'bun', value: 'bun' },
        ],
      },
      {
        name: 'nodeVersion',
        type: 'string',
        description: 'Minimum Node.js version',
        required: false,
        default: '18',
      },
    ],
    files: [
      {
        path: 'README.md',
        content: `# {{projectName}}

{{description}}

{{#if includeBadges}}
[![License](https://img.shields.io/badge/license-{{license}}-blue.svg)](LICENSE)
[![Node Version](https://img.shields.io/badge/node-%3E%3D{{nodeVersion}}-brightgreen.svg)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.0+-blue.svg)](https://www.typescriptlang.org/)
{{#if author}}
[![Author](https://img.shields.io/badge/author-{{author}}-orange.svg)](https://github.com/{{author}})
{{/if}}

{{/if}}
{{#if includeTOC}}
## Table of Contents

- [Installation](#installation)
- [Usage](#usage)
{{#if includeAPI}}- [API](#api){{/if}}
{{#if includeTests}}- [Testing](#testing){{/if}}
- [Contributing](#contributing)
- [License](#license)

{{/if}}
{{#if includeInstall}}
## Installation

\`\`\`bash
{{#if (eq packageManager "npm")}}npm install {{projectName}}
{{else if (eq packageManager "yarn")}}yarn add {{projectName}}
{{else if (eq packageManager "pnpm")}}pnpm add {{projectName}}
{{else if (eq packageManager "bun")}}bun add {{projectName}}
{{/if}}
\`\`\`

### Requirements

- Node.js >= {{nodeVersion}}
{{#if (eq packageManager "pnpm")}}- pnpm >= 8.0.0{{/if}}
{{#if (eq packageManager "yarn")}}- yarn >= 1.22.0{{/if}}

{{/if}}
{{#if includeUsage}}
## Usage

### Basic Example

\`\`\`typescript
import { something } from '{{projectName}}';

// Your code here
const result = something();
console.log(result);
\`\`\`

### Advanced Usage

\`\`\`typescript
import { advanced } from '{{projectName}}';

// Advanced usage example
const config = {
  // configuration options
};

advanced(config);
\`\`\`

{{/if}}
{{#if includeAPI}}
## API

### \`functionName(param: Type): ReturnType\`

Description of what this function does.

**Parameters:**

- \`param\` (Type): Description of the parameter

**Returns:**

- \`ReturnType\`: Description of the return value

**Example:**

\`\`\`typescript
const result = functionName('value');
\`\`\`

{{/if}}
{{#if includeTests}}
## Testing

\`\`\`bash
{{#if (eq packageManager "npm")}}npm test
{{else if (eq packageManager "yarn")}}yarn test
{{else if (eq packageManager "pnpm")}}pnpm test
{{else if (eq packageManager "bun")}}bun test
{{/if}}
\`\`\`

### Running Tests with Coverage

\`\`\`bash
{{#if (eq packageManager "npm")}}npm run test:coverage
{{else if (eq packageManager "yarn")}}yarn test:coverage
{{else if (eq packageManager "pnpm")}}pnpm test:coverage
{{else if (eq packageManager "bun")}}bun test:coverage
{{/if}}
\`\`\`

{{/if}}
{{#if includeContributing}}
## Contributing

Contributions are welcome! Please read our [Contributing Guide](CONTRIBUTING.md) for details on our code of conduct and the process for submitting pull requests.

### Development Setup

1. Clone the repository:
   \`\`\`bash
   git clone https://github.com/{{#if author}}{{author}}{{else}}your-org{{/if}}/{{projectName}}.git
   cd {{projectName}}
   \`\`\`

2. Install dependencies:
   \`\`\`bash
   {{#if (eq packageManager "npm")}}npm install
   {{else if (eq packageManager "yarn")}}yarn install
   {{else if (eq packageManager "pnpm")}}pnpm install
   {{else if (eq packageManager "bun")}}bun install
   {{/if}}
   \`\`\`

3. Run the development server:
   \`\`\`bash
   {{#if (eq packageManager "npm")}}npm run dev
   {{else if (eq packageManager "yarn")}}yarn dev
   {{else if (eq packageManager "pnpm")}}pnpm dev
   {{else if (eq packageManager "bun")}}bun dev
   {{/if}}
   \`\`\`

{{/if}}
{{#if includeChangelog}}
## Changelog

See [CHANGELOG.md](CHANGELOG.md) for a list of changes.

{{/if}}
## License

This project is licensed under the {{license}} License - see the [LICENSE](LICENSE) file for details.

{{#if author}}
## Author

**{{author}}**
- GitHub: [@{{author}}](https://github.com/{{author}})
{{/if}}
`,
      },
    ],
  },
};

export default readme;
