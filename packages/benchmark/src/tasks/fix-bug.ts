/**
 * Fix Bug benchmark tasks
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { BenchmarkTask, BenchmarkResult, CheckResult } from './types.js';
import { runTsc } from '../checks.js';

export const fixBugTasks: BenchmarkTask[] = [
  {
    id: 'fix-async-race',
    name: 'Fix Async Race Condition',
    description: 'Fix a race condition in async state management code',
    category: 'fix-bug',

    async setup(workDir: string) {
      await mkdir(join(workDir, 'src'), { recursive: true });
      await writeFile(join(workDir, 'src', 'cache.ts'), [
        '// BUG: Race condition — multiple concurrent calls fetch the same data',
        'const cache = new Map<string, unknown>();',
        '',
        'export async function getOrFetch<T>(key: string, fetcher: () => Promise<T>): Promise<T> {',
        '  if (cache.has(key)) {',
        '    return cache.get(key) as T;',
        '  }',
        '  // BUG: Between the check above and set below, another call can also miss cache',
        '  const value = await fetcher();',
        '  cache.set(key, value);',
        '  return value;',
        '}',
      ].join('\n'));
      await writeFile(join(workDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true },
        include: ['src'],
      }, null, 2));
    },

    async verify(workDir: string, output: string): Promise<BenchmarkResult> {
      const checks: CheckResult[] = [];

      const tscResult = await runTsc(workDir);
      checks.push({ name: 'TypeScript compiles', passed: tscResult.passed });

      const { readFile } = await import('fs/promises');
      const content = await readFile(join(workDir, 'src', 'cache.ts'), 'utf-8').catch(() => '');

      // Check if inflight/pending promise map is used
      const hasInflight = content.includes('Promise') && (
        content.includes('pending') || content.includes('inflight') || content.includes('inFlight') ||
        content.includes('Map<string, Promise') || content.includes('promises')
      );
      checks.push({ name: 'Uses inflight promise deduplication', passed: hasInflight });

      const mentionsRace = output.toLowerCase().includes('race') || output.toLowerCase().includes('concurrent') || output.toLowerCase().includes('dedup');
      checks.push({ name: 'Explains the race condition', passed: mentionsRace });

      const passed = checks.filter(c => c.passed).length;
      const score = Math.round((passed / checks.length) * 100);
      return { success: score >= 66, score, checks };
    },
  },

  {
    id: 'fix-memory-leak',
    name: 'Fix Memory Leak',
    description: 'Fix an event listener memory leak in a class',
    category: 'fix-bug',

    async setup(workDir: string) {
      await mkdir(join(workDir, 'src'), { recursive: true });
      await writeFile(join(workDir, 'src', 'widget.ts'), [
        'import { EventEmitter } from "events";',
        '',
        'const globalEmitter = new EventEmitter();',
        '',
        '// BUG: Every Widget instance adds a listener but never removes it',
        'export class Widget {',
        '  private value = 0;',
        '',
        '  constructor(private readonly name: string) {',
        '    // This leaks — listener is never cleaned up when widget is destroyed',
        '    globalEmitter.on("update", () => {',
        '      this.value++;',
        '    });',
        '  }',
        '',
        '  getValue(): number {',
        '    return this.value;',
        '  }',
        '',
        '  // TODO: Add a destroy() method that cleans up properly',
        '}',
      ].join('\n'));
      await writeFile(join(workDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true },
        include: ['src'],
      }, null, 2));
    },

    async verify(workDir: string, _output: string): Promise<BenchmarkResult> {
      const checks: CheckResult[] = [];

      const tscResult = await runTsc(workDir);
      checks.push({ name: 'TypeScript compiles', passed: tscResult.passed });

      const { readFile } = await import('fs/promises');
      const content = await readFile(join(workDir, 'src', 'widget.ts'), 'utf-8').catch(() => '');

      const hasDestroy = content.includes('destroy') || content.includes('[Symbol.dispose]');
      checks.push({ name: 'Adds destroy/cleanup method', passed: hasDestroy });

      const hasOff = content.includes('.off(') || content.includes('.removeListener(') || content.includes('removeAllListeners');
      checks.push({ name: 'Removes event listener', passed: hasOff });

      const passed = checks.filter(c => c.passed).length;
      const score = Math.round((passed / checks.length) * 100);
      return { success: score >= 66, score, checks };
    },
  },
];
