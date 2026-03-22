/**
 * React component template
 */

import type { BuiltinTemplate } from '../types.js';

export const reactComponent: BuiltinTemplate = {
  id: 'react-component',
  aliases: ['react', 'component'],
  template: {
    name: 'react-component',
    version: '1.0.0',
    description: 'React component with TypeScript',
    author: 'Spazzatura',
    tags: ['react', 'typescript', 'component'],
    category: 'frontend',
    variables: [
      {
        name: 'componentName',
        type: 'string',
        description: 'Name of the component (PascalCase)',
        required: true,
        validation: {
          pattern: '^[A-Z][a-zA-Z0-9]*$',
          message: 'Component name must be PascalCase (e.g., MyComponent)',
        },
      },
      {
        name: 'style',
        type: 'select',
        description: 'Styling approach',
        default: 'css',
        required: true,
        options: [
          { label: 'CSS', value: 'css' },
          { label: 'SCSS', value: 'scss' },
          { label: 'Styled Components', value: 'styled-components' },
          { label: 'Tailwind', value: 'tailwind' },
        ],
      },
      {
        name: 'includeTest',
        type: 'boolean',
        description: 'Include a test file',
        default: true,
        required: false,
      },
      {
        name: 'includeStory',
        type: 'boolean',
        description: 'Include a Storybook story',
        default: false,
        required: false,
      },
    ],
    files: [
      {
        path: 'src/components/{{componentName}}/{{componentName}}.tsx',
        content: `import React from 'react';
{{#if (eq style 'css')}}import './{{componentName}}.css';{{/if}}
{{#if (eq style 'scss')}}import './{{componentName}}.scss';{{/if}}
{{#if (eq style 'styled-components')}}import { Container } from './styles';{{/if}}

export interface {{componentName}}Props {
  /** Add props here */
  children?: React.ReactNode;
}

/**
 * {{componentName}} component
 */
export const {{componentName}}: React.FC<{{componentName}}Props> = ({ children }) => {
  return (
    {{#if (eq style 'tailwind')}}<div className="{{kebabCase componentName}}">
      {children}
    </div>{{/if}}{{#if (eq style 'styled-components')}}<Container>
      {children}
    </Container>{{/if}}{{#if (eq style 'css')}}<div className="{{kebabCase componentName}}">
      {children}
    </div>{{/if}}{{#if (eq style 'scss')}}<div className="{{kebabCase componentName}}">
      {children}
    </div>{{/if}}
  );
};

export default {{componentName}};
`,
      },
      {
        path: 'src/components/{{componentName}}/{{componentName}}.css',
        content: `{{kebabCase componentName}} {
  /* Add styles here */
}
`,
        condition: "{{style === 'css'}}",
      },
      {
        path: 'src/components/{{componentName}}/{{componentName}}.scss',
        content: `{{kebabCase componentName}} {
  /* Add styles here */
}
`,
        condition: "{{style === 'scss'}}",
      },
      {
        path: 'src/components/{{componentName}}/styles.ts',
        content: `import styled from 'styled-components';

export const Container = styled.div\`
  /* Add styles here */
\`;
`,
        condition: "{{style === 'styled-components'}}",
      },
      {
        path: 'src/components/{{componentName}}/{{componentName}}.test.tsx',
        content: `import { render, screen } from '@testing-library/react';
import { {{componentName}} } from './{{componentName}}';

describe('{{componentName}}', () => {
  it('renders correctly', () => {
    render(<{{componentName}}>Test</{{componentName}}>);
    expect(screen.getByText('Test')).toBeInTheDocument();
  });
});
`,
        condition: '{{includeTest}}',
      },
      {
        path: 'src/components/{{componentName}}/{{componentName}}.stories.tsx',
        content: `import type { Meta, StoryObj } from '@storybook/react';
import { {{componentName}} } from './{{componentName}}';

const meta: Meta<typeof {{componentName}}> = {
  title: 'Components/{{componentName}}',
  component: {{componentName}},
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof {{componentName}}>;

export const Default: Story = {
  args: {
    children: '{{componentName}}',
  },
};
`,
        condition: '{{includeStory}}',
      },
      {
        path: 'src/components/{{componentName}}/index.ts',
        content: `export { {{componentName}} } from './{{componentName}}';
export type { {{componentName}}Props } from './{{componentName}}';
`,
      },
    ],
  },
};
