/**
 * Write Tests benchmark tasks
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { BenchmarkTask, BenchmarkResult } from './types.js';

export const writeTestsTasks: BenchmarkTask[] = [
  {
    id: 'test-calculator',
    name: 'Write Tests for Calculator',
    description: 'Write comprehensive unit tests for a calculator module',
    category: 'write-tests',

    async setup(workDir: string) {
      await mkdir(join(workDir, 'src'), { recursive: true });
      await writeFile(join(workDir, 'src', 'calculator.ts'), [
        'export function add(a: number, b: number): number { return a + b; }',
        'export function subtract(a: number, b: number): number { return a - b; }',
        'export function multiply(a: number, b: number): number { return a * b; }',
        'export function divide(a: number, b: number): number {',
        '  if (b === 0) throw new Error("Division by zero");',
        '  return a / b;',
        '}',
        'export function power(base: number, exp: number): number { return Math.pow(base, exp); }',
        'export function sqrt(n: number): number {',
        '  if (n < 0) throw new Error("Cannot sqrt negative number");',
        '  return Math.sqrt(n);',
        '}',
      ].join('\n'));
      await writeFile(join(workDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true },
        include: ['src'],
      }, null, 2));
    },

    async verify(workDir: string, output: string): Promise<BenchmarkResult> {
      const checks = [];

      const { readFile } = await import('fs/promises');
      const { existsSync } = await import('fs');

      // Look for test file
      const testPaths = ['src/calculator.test.ts', 'src/calculator.spec.ts', 'calculator.test.ts'];
      let testContent = '';
      for (const p of testPaths) {
        if (existsSync(join(workDir, p))) {
          testContent = await readFile(join(workDir, p), 'utf-8');
          break;
        }
      }
      if (!testContent) testContent = output; // fallback: check output itself

      const hasDivideByZero = testContent.includes('zero') || testContent.includes('division');
      checks.push({ name: 'Tests division by zero', passed: hasDivideByZero });

      const hasNegativeSqrt = testContent.includes('negative') || (testContent.includes('sqrt') && testContent.includes('throw'));
      checks.push({ name: 'Tests negative sqrt', passed: hasNegativeSqrt });

      const hasDescribeOrTest = testContent.includes('describe(') || testContent.includes('test(') || testContent.includes('it(');
      checks.push({ name: 'Uses test framework', passed: hasDescribeOrTest });

      const hasEdgeCases = testContent.includes('0') && (testContent.includes('NaN') || testContent.includes('Infinity') || hasDivideByZero);
      checks.push({ name: 'Tests edge cases', passed: hasEdgeCases });

      const passed = checks.filter(c => c.passed).length;
      const score = Math.round((passed / checks.length) * 100);
      return { success: score >= 75, score, checks };
    },
  },
];
