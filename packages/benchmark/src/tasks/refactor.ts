/**
 * Refactor benchmark tasks
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { BenchmarkTask, BenchmarkResult } from './types.js';
import { runTsc } from '../checks.js';

export const refactorTasks: BenchmarkTask[] = [
  {
    id: 'extract-service',
    name: 'Extract Service Layer',
    description: 'Extract business logic from a bloated controller into a service class',
    category: 'refactor',

    async setup(workDir: string) {
      await mkdir(join(workDir, 'src'), { recursive: true });
      await writeFile(join(workDir, 'src', 'user-controller.ts'), [
        'import { readFile, writeFile } from "fs/promises";',
        '',
        '// This controller is doing too much — it contains business logic, DB access, and validation',
        'export async function createUser(data: { name: string; email: string; age: number }) {',
        '  // Validation (should be extracted)',
        '  if (!data.name || data.name.length < 2) throw new Error("Name too short");',
        '  if (!data.email.includes("@")) throw new Error("Invalid email");',
        '  if (data.age < 0 || data.age > 150) throw new Error("Invalid age");',
        '',
        '  // "DB access" (should be extracted)',
        '  const raw = await readFile("users.json", "utf-8").catch(() => "[]");',
        '  const users: typeof data[] = JSON.parse(raw);',
        '  const exists = users.some(u => u.email === data.email);',
        '  if (exists) throw new Error("Email already exists");',
        '',
        '  // Business logic (should be extracted)',
        '  const normalised = { ...data, name: data.name.trim(), email: data.email.toLowerCase() };',
        '  users.push(normalised);',
        '  await writeFile("users.json", JSON.stringify(users, null, 2));',
        '',
        '  return normalised;',
        '}',
      ].join('\n'));
      await writeFile(join(workDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true },
        include: ['src'],
      }, null, 2));
    },

    async verify(workDir: string, _output: string): Promise<BenchmarkResult> {
      const checks = [];
      const { existsSync } = await import('fs');

      const tscResult = await runTsc(workDir);
      checks.push({ name: 'TypeScript compiles', passed: tscResult.passed });

      // Check if a service file was created
      const hasService = existsSync(join(workDir, 'src', 'user-service.ts')) ||
                         existsSync(join(workDir, 'src', 'userService.ts')) ||
                         existsSync(join(workDir, 'src', 'users.service.ts'));
      checks.push({ name: 'Created service file', passed: hasService });

      // Controller should be simpler now
      const { readFile } = await import('fs/promises');
      const controllerContent = await readFile(join(workDir, 'src', 'user-controller.ts'), 'utf-8').catch(() => '');
      const controllerIsShorter = controllerContent.split('\n').length < 25;
      checks.push({ name: 'Controller is simplified', passed: controllerIsShorter });

      const passed = checks.filter(c => c.passed).length;
      const score = Math.round((passed / checks.length) * 100);
      return { success: score >= 66, score, checks };
    },
  },
];
