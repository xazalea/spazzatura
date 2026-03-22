/**
 * Implement Feature benchmark tasks
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';
import type { BenchmarkTask, BenchmarkResult } from './types.js';
import { runTsc, runEslint } from '../checks.js';

export const implementFeatureTasks: BenchmarkTask[] = [
  {
    id: 'add-pagination',
    name: 'Add Pagination',
    description: 'Add pagination to a list endpoint in a simple Express app',
    category: 'implement-feature',

    async setup(workDir: string) {
      await mkdir(join(workDir, 'src'), { recursive: true });
      await writeFile(join(workDir, 'src', 'app.ts'), [
        'import express from "express";',
        'const app = express();',
        'const items = Array.from({ length: 100 }, (_, i) => ({ id: i + 1, name: `Item ${i + 1}` }));',
        '',
        '// TODO: Add pagination support (page, limit query params)',
        'app.get("/items", (req, res) => {',
        '  res.json(items);',
        '});',
        '',
        'export default app;',
      ].join('\n'));
      await writeFile(join(workDir, 'package.json'), JSON.stringify({
        name: 'test-app',
        type: 'module',
        dependencies: { express: '^4.18.0' },
        devDependencies: { typescript: '^5.3.0', '@types/express': '^4.17.0', '@types/node': '^20.0.0' },
      }, null, 2));
      await writeFile(join(workDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true },
        include: ['src'],
      }, null, 2));
    },

    async verify(workDir: string, output: string): Promise<BenchmarkResult> {
      const checks = [];

      // Check 1: TypeScript compiles
      const tscResult = await runTsc(workDir);
      checks.push({ name: 'TypeScript compiles', passed: tscResult.passed, detail: tscResult.detail });

      // Check 2: Pagination params mentioned in output
      const hasPagination = output.includes('page') && output.includes('limit');
      checks.push({ name: 'Uses page/limit params', passed: hasPagination });

      // Check 3: File was modified
      const appPath = join(workDir, 'src', 'app.ts');
      if (existsSync(appPath)) {
        const { readFile } = await import('fs/promises');
        const content = await readFile(appPath, 'utf-8');
        const hasSlice = content.includes('slice') || content.includes('splice') || content.includes('skip');
        checks.push({ name: 'Implements slicing logic', passed: hasSlice });
      } else {
        checks.push({ name: 'Implements slicing logic', passed: false, detail: 'File not found' });
      }

      const passed = checks.filter(c => c.passed).length;
      const score = Math.round((passed / checks.length) * 100);
      return { success: score >= 66, score, checks };
    },
  },

  {
    id: 'add-auth-middleware',
    name: 'Add Auth Middleware',
    description: 'Add JWT authentication middleware to an Express router',
    category: 'implement-feature',

    async setup(workDir: string) {
      await mkdir(join(workDir, 'src'), { recursive: true });
      await writeFile(join(workDir, 'src', 'router.ts'), [
        'import { Router } from "express";',
        'const router = Router();',
        '',
        '// TODO: Add JWT auth middleware that reads Authorization: Bearer <token>',
        '// Attach decoded user to req.user, return 401 if invalid',
        '',
        'router.get("/profile", (req, res) => {',
        '  res.json({ message: "Profile data" });',
        '});',
        '',
        'export default router;',
      ].join('\n'));
      await writeFile(join(workDir, 'package.json'), JSON.stringify({
        name: 'test-auth',
        type: 'module',
        dependencies: { express: '^4.18.0', jsonwebtoken: '^9.0.0' },
        devDependencies: { typescript: '^5.3.0', '@types/express': '^4.17.0', '@types/jsonwebtoken': '^9.0.0', '@types/node': '^20.0.0' },
      }, null, 2));
      await writeFile(join(workDir, 'tsconfig.json'), JSON.stringify({
        compilerOptions: { target: 'ES2022', module: 'NodeNext', moduleResolution: 'NodeNext', strict: true },
        include: ['src'],
      }, null, 2));
    },

    async verify(workDir: string, output: string): Promise<BenchmarkResult> {
      const checks = [];

      const tscResult = await runTsc(workDir);
      checks.push({ name: 'TypeScript compiles', passed: tscResult.passed, detail: tscResult.detail });

      const hasJwt = output.toLowerCase().includes('jwt') || output.includes('jsonwebtoken') || output.includes('Bearer');
      checks.push({ name: 'Uses JWT', passed: hasJwt });

      const has401 = output.includes('401') || output.toLowerCase().includes('unauthorized');
      checks.push({ name: 'Returns 401 on failure', passed: has401 });

      const routerPath = join(workDir, 'src', 'router.ts');
      if (existsSync(routerPath)) {
        const { readFile } = await import('fs/promises');
        const content = await readFile(routerPath, 'utf-8');
        const hasMiddleware = content.includes('middleware') || content.includes('next(') || content.includes('use(');
        checks.push({ name: 'Implements middleware pattern', passed: hasMiddleware });
      } else {
        checks.push({ name: 'Implements middleware pattern', passed: false });
      }

      const passed = checks.filter(c => c.passed).length;
      const score = Math.round((passed / checks.length) * 100);
      return { success: score >= 75, score, checks };
    },
  },
];
