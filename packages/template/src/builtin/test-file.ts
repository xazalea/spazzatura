/**
 * Test file template for Jest/Vitest
 */

import type { BuiltinTemplate } from '../types.js';

export const testFile: BuiltinTemplate = {
  id: 'test-file',
  aliases: ['test', 'spec'],
  template: {
    name: 'test-file',
    version: '1.0.0',
    description: 'Jest/Vitest test file with TypeScript',
    author: 'Spazzatura',
    tags: ['test', 'jest', 'vitest', 'typescript'],
    category: 'testing',
    variables: [
      {
        name: 'testName',
        type: 'string',
        description: 'Name of the test suite (PascalCase)',
        required: true,
        validation: {
          pattern: '^[A-Z][a-zA-Z0-9]*$',
          message: 'Test name must be PascalCase',
        },
      },
      {
        name: 'framework',
        type: 'select',
        description: 'Testing framework',
        required: true,
        default: 'vitest',
        options: [
          { label: 'Vitest', value: 'vitest' },
          { label: 'Jest', value: 'jest' },
        ],
      },
      {
        name: 'testType',
        type: 'select',
        description: 'Type of test',
        required: true,
        default: 'unit',
        options: [
          { label: 'Unit Test', value: 'unit' },
          { label: 'Integration Test', value: 'integration' },
          { label: 'End-to-End Test', value: 'e2e' },
        ],
      },
      {
        name: 'subject',
        type: 'string',
        description: 'Path to the module being tested (relative to test file)',
        required: false,
        default: '../src/module',
      },
      {
        name: 'includeMocks',
        type: 'boolean',
        description: 'Include mock setup',
        required: false,
        default: false,
      },
      {
        name: 'includeCoverage',
        type: 'boolean',
        description: 'Include coverage comments',
        required: false,
        default: false,
      },
      {
        name: 'testMethods',
        type: 'multiselect',
        description: 'Test methods to include',
        required: false,
        default: ['describe', 'it'],
        options: [
          { label: 'describe blocks', value: 'describe' },
          { label: 'it blocks', value: 'it' },
          { label: 'beforeEach', value: 'beforeEach' },
          { label: 'afterEach', value: 'afterEach' },
          { label: 'beforeAll', value: 'beforeAll' },
          { label: 'afterAll', value: 'afterAll' },
        ],
      },
    ],
    files: [
      {
        path: '{{#if (eq testType "e2e")}}e2e/{{else if (eq testType "integration")}}integration/{{else}}unit/{{/if}}{{kebabCase testName}}.test.ts',
        content: `/**
 * @file {{testName}} tests
 * @description {{#if (eq testType "unit")}}Unit tests for {{/if}}{{#if (eq testType "integration")}}Integration tests for {{/if}}{{#if (eq testType "e2e")}}End-to-end tests for {{/if}}{{testName}}
{{#if includeCoverage}} * @coverage {{/if}}
 */
{{#if (eq framework "vitest")}}
import { describe, it, expect{{#if (includes testMethods "beforeEach")}}, beforeEach{{/if}}{{#if (includes testMethods "afterEach")}}, afterEach{{/if}}{{#if (includes testMethods "beforeAll")}}, beforeAll{{/if}}{{#if (includes testMethods "afterAll")}}, afterAll{{/if}}{{#if includeMocks}}, vi {{/if}}} from 'vitest';
{{else}}
import { describe, it, expect{{#if (includes testMethods "beforeEach")}}, beforeEach{{/if}}{{#if (includes testMethods "afterEach")}}, afterEach{{/if}}{{#if (includes testMethods "beforeAll")}}, beforeAll{{/if}}{{#if (includes testMethods "afterAll")}}, afterAll{{/if}}{{#if includeMocks}}, jest {{/if}}} from '@jest/globals';
{{/if}}
{{#if subject}}
import { {{testName}} } from '{{subject}}';
{{/if}}
{{#if includeMocks}}
{{#if (eq framework "vitest")}}
// Mock implementations
vi.mock('{{subject}}', () => ({
  {{testName}}: vi.fn(),
}));
{{else}}
// Mock implementations
jest.mock('{{subject}}', () => ({
  {{testName}}: jest.fn(),
}));
{{/if}}

{{/if}}
{{#if (includes testMethods "describe")}}
describe('{{testName}}', () => {
{{#if (includes testMethods "beforeAll")}}
  beforeAll(() => {
    // Setup before all tests
  });

{{/if}}
{{#if (includes testMethods "beforeEach")}}
  beforeEach(() => {
    // Setup before each test
  });

{{/if}}
{{#if (includes testMethods "afterEach")}}
  afterEach(() => {
    // Cleanup after each test
  });

{{/if}}
{{#if (includes testMethods "afterAll")}}
  afterAll(() => {
    // Cleanup after all tests
  });

{{/if}}
{{#if (includes testMethods "it")}}
  it('should be defined', () => {
    expect({{testName}}).toBeDefined();
  });

  it('should work correctly', () => {
    // Arrange
    const input = 'test';

    // Act
    const result = {{testName}}(input);

    // Assert
    expect(result).toBe('expected');
  });
{{/if}}

  // Add more tests here
});
{{/if}}
{{#if (not (includes testMethods "describe"))}}
{{#if (includes testMethods "it")}}
it('should work correctly', () => {
  expect({{testName}}).toBeDefined();
});
{{/if}}
{{/if}}
`,
      },
    ],
  },
};

export default testFile;
