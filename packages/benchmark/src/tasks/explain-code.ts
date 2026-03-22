/**
 * Explain Code benchmark tasks
 */

import { writeFile, mkdir } from 'fs/promises';
import { join } from 'path';
import type { BenchmarkTask, BenchmarkResult } from './types.js';

export const explainCodeTasks: BenchmarkTask[] = [
  {
    id: 'explain-scheduler',
    name: 'Explain Scheduler Algorithm',
    description: 'Explain a non-obvious job scheduler implementation',
    category: 'explain-code',

    async setup(workDir: string) {
      await mkdir(join(workDir, 'src'), { recursive: true });
      await writeFile(join(workDir, 'src', 'scheduler.ts'), [
        '// Explain what this scheduler does and why it uses these data structures',
        'export class PriorityScheduler<T> {',
        '  private heap: Array<{ job: T; priority: number; seq: number }> = [];',
        '  private seq = 0;',
        '',
        '  push(job: T, priority: number): void {',
        '    this.heap.push({ job, priority, seq: this.seq++ });',
        '    this.siftUp(this.heap.length - 1);',
        '  }',
        '',
        '  pop(): T | undefined {',
        '    if (this.heap.length === 0) return undefined;',
        '    this.swap(0, this.heap.length - 1);',
        '    const item = this.heap.pop()!;',
        '    this.siftDown(0);',
        '    return item.job;',
        '  }',
        '',
        '  private siftUp(i: number): void {',
        '    while (i > 0) {',
        '      const parent = (i - 1) >> 1;',
        '      if (this.compare(i, parent) < 0) break;',
        '      this.swap(i, parent);',
        '      i = parent;',
        '    }',
        '  }',
        '',
        '  private siftDown(i: number): void {',
        '    const n = this.heap.length;',
        '    while (true) {',
        '      let best = i;',
        '      const l = 2 * i + 1, r = 2 * i + 2;',
        '      if (l < n && this.compare(l, best) > 0) best = l;',
        '      if (r < n && this.compare(r, best) > 0) best = r;',
        '      if (best === i) break;',
        '      this.swap(i, best);',
        '      i = best;',
        '    }',
        '  }',
        '',
        '  private compare(a: number, b: number): number {',
        '    const ha = this.heap[a]!; const hb = this.heap[b]!;',
        '    if (ha.priority !== hb.priority) return ha.priority - hb.priority;',
        '    return hb.seq - ha.seq; // FIFO for equal priorities',
        '  }',
        '',
        '  private swap(a: number, b: number): void {',
        '    [this.heap[a], this.heap[b]] = [this.heap[b]!, this.heap[a]!];',
        '  }',
        '}',
      ].join('\n'));
    },

    async verify(_workDir: string, output: string): Promise<BenchmarkResult> {
      const checks = [];
      const lower = output.toLowerCase();

      checks.push({ name: 'Mentions heap/priority queue', passed: lower.includes('heap') || lower.includes('priority queue') });
      checks.push({ name: 'Explains FIFO for equal priorities', passed: lower.includes('fifo') || (lower.includes('equal') && lower.includes('order')) });
      checks.push({ name: 'Explains sift up/down', passed: lower.includes('sift') || (lower.includes('bubble') && lower.includes('up')) });
      checks.push({ name: 'Explains O(log n) complexity', passed: lower.includes('log n') || lower.includes('o(log') || lower.includes('logarithm') });
      checks.push({ name: 'Explains sequence counter purpose', passed: lower.includes('seq') || lower.includes('sequence') || lower.includes('tiebreak') });

      const passed = checks.filter(c => c.passed).length;
      const score = Math.round((passed / checks.length) * 100);
      return { success: score >= 60, score, checks };
    },
  },
];
