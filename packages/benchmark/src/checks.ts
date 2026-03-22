/**
 * Common verification utilities for benchmark tasks
 */

import { execa } from 'execa';

export interface CheckResult {
  readonly passed: boolean;
  readonly detail?: string;
}

/**
 * Run TypeScript compiler check
 */
export async function runTsc(workDir: string): Promise<CheckResult> {
  try {
    await execa('npx', ['tsc', '--noEmit'], {
      cwd: workDir,
      timeout: 30000,
    });
    return { passed: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { passed: false, detail: msg.slice(0, 500) };
  }
}

/**
 * Run ESLint check
 */
export async function runEslint(workDir: string, files = 'src'): Promise<CheckResult> {
  try {
    await execa('npx', ['eslint', files, '--format', 'compact'], {
      cwd: workDir,
      timeout: 30000,
    });
    return { passed: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { passed: false, detail: msg.slice(0, 500) };
  }
}

/**
 * Run tests with vitest
 */
export async function runTests(workDir: string): Promise<CheckResult> {
  try {
    await execa('npx', ['vitest', 'run', '--reporter=verbose'], {
      cwd: workDir,
      timeout: 60000,
    });
    return { passed: true };
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    return { passed: false, detail: msg.slice(0, 500) };
  }
}

/**
 * Check if a file exists and contains a pattern
 */
export async function fileContains(filePath: string, pattern: string | RegExp): Promise<boolean> {
  try {
    const { readFile } = await import('fs/promises');
    const content = await readFile(filePath, 'utf-8');
    if (typeof pattern === 'string') return content.includes(pattern);
    return pattern.test(content);
  } catch {
    return false;
  }
}
