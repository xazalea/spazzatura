/**
 * Benchmark runner — runs tasks against Spazzatura and Claude Code, produces a report
 */

import { mkdir, mkdtemp, rm, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import { execa } from 'execa';
import type { BenchmarkTask, RunResult, BenchmarkReport, TaskReport, Summary } from './tasks/types.js';
import { implementFeatureTasks } from './tasks/implement-feature.js';
import { fixBugTasks } from './tasks/fix-bug.js';
import { writeTestsTasks } from './tasks/write-tests.js';
import { refactorTasks } from './tasks/refactor.js';
import { explainCodeTasks } from './tasks/explain-code.js';

const ALL_TASKS: readonly BenchmarkTask[] = [
  ...implementFeatureTasks,
  ...fixBugTasks,
  ...writeTestsTasks,
  ...refactorTasks,
  ...explainCodeTasks,
];

/**
 * Run a single task using spazzatura CLI
 */
async function runWithSpazzatura(task: BenchmarkTask, workDir: string): Promise<RunResult> {
  const start = Date.now();
  try {
    const prompt = `${task.description}\n\nWork in the directory: ${workDir}`;
    const result = await execa('spazzatura', ['chat', prompt], {
      timeout: 120000,
      cwd: workDir,
    });

    const output = result.stdout + result.stderr;
    const durationMs = Date.now() - start;
    const benchResult = await task.verify(workDir, output);

    return {
      taskId: task.id,
      tool: 'spazzatura',
      output,
      durationMs,
      result: benchResult,
    };
  } catch (error) {
    return {
      taskId: task.id,
      tool: 'spazzatura',
      output: '',
      durationMs: Date.now() - start,
      result: { success: false, score: 0, checks: [] },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run a single task using Claude Code (claude CLI)
 */
async function runWithClaudeCode(task: BenchmarkTask, workDir: string): Promise<RunResult | undefined> {
  // Check if claude CLI is available
  try {
    await execa('claude', ['--version'], { timeout: 5000 });
  } catch {
    return undefined; // Claude Code not installed
  }

  const start = Date.now();
  try {
    const prompt = `${task.description}\n\nWork in the directory: ${workDir}`;
    const result = await execa('claude', ['-p', prompt], {
      timeout: 120000,
      cwd: workDir,
    });

    const output = result.stdout + result.stderr;
    const durationMs = Date.now() - start;
    const benchResult = await task.verify(workDir, output);

    return {
      taskId: task.id,
      tool: 'claude-code',
      output,
      durationMs,
      result: benchResult,
    };
  } catch (error) {
    return {
      taskId: task.id,
      tool: 'claude-code',
      output: '',
      durationMs: Date.now() - start,
      result: { success: false, score: 0, checks: [] },
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Run all benchmark tasks and produce a report
 */
export async function runBenchmark(options: {
  tasks?: string[];
  outputFile?: string;
  verbose?: boolean;
} = {}): Promise<BenchmarkReport> {
  const tasks = options.tasks
    ? ALL_TASKS.filter(t => options.tasks!.includes(t.id))
    : ALL_TASKS;

  const taskReports: TaskReport[] = [];

  for (const task of tasks) {
    if (options.verbose) {
      console.log(`\nRunning: ${task.name} (${task.id})`);
    }

    // Create isolated work directories
    const spazzaturaDir = await mkdtemp(join(tmpdir(), `bench-spaz-${task.id}-`));
    const claudeDir = await mkdtemp(join(tmpdir(), `bench-claude-${task.id}-`));

    try {
      await task.setup(spazzaturaDir);
      await task.setup(claudeDir);

      const [spazzaturaResult, claudeResult] = await Promise.all([
        runWithSpazzatura(task, spazzaturaDir),
        runWithClaudeCode(task, claudeDir),
      ]);

      const winner = determineWinner(spazzaturaResult, claudeResult);

      if (options.verbose) {
        console.log(`  Spazzatura: ${spazzaturaResult.result.score}/100 (${spazzaturaResult.durationMs}ms)`);
        if (claudeResult) {
          console.log(`  Claude Code: ${claudeResult.result.score}/100 (${claudeResult.durationMs}ms)`);
        }
        console.log(`  Winner: ${winner}`);
      }

      taskReports.push({
        taskId: task.id,
        taskName: task.name,
        category: task.category,
        spazzatura: spazzaturaResult,
        ...(claudeResult !== undefined ? { claudeCode: claudeResult } : {}),
        winner,
      });
    } finally {
      await rm(spazzaturaDir, { recursive: true, force: true });
      await rm(claudeDir, { recursive: true, force: true });
    }
  }

  const summary = computeSummary(taskReports);
  const report: BenchmarkReport = {
    timestamp: new Date().toISOString(),
    tasks: taskReports,
    summary,
  };

  if (options.outputFile) {
    await mkdir(join(options.outputFile, '..'), { recursive: true }).catch(() => {});
    await writeFile(options.outputFile, JSON.stringify(report, null, 2));
    await writeFile(options.outputFile.replace('.json', '.md'), formatMarkdownReport(report));
  }

  return report;
}

function determineWinner(spaz: RunResult, claude: RunResult | undefined): 'spazzatura' | 'claude-code' | 'tie' {
  if (!claude) return 'spazzatura';
  if (spaz.result.score > claude.result.score) return 'spazzatura';
  if (claude.result.score > spaz.result.score) return 'claude-code';
  return 'tie';
}

function computeSummary(reports: TaskReport[]): Summary {
  const spazWins = reports.filter(r => r.winner === 'spazzatura').length;
  const claudeWins = reports.filter(r => r.winner === 'claude-code').length;
  const ties = reports.filter(r => r.winner === 'tie').length;

  const spazAvg = reports.length > 0
    ? reports.reduce((s, r) => s + r.spazzatura.result.score, 0) / reports.length
    : 0;

  const claudeReports = reports.filter(r => r.claudeCode !== undefined);
  const claudeAvg = claudeReports.length > 0
    ? claudeReports.reduce((s, r) => s + (r.claudeCode?.result.score ?? 0), 0) / claudeReports.length
    : 0;

  const categories = [...new Set(reports.filter(r => r.winner === 'spazzatura').map(r => r.category))];

  return {
    totalTasks: reports.length,
    spazzaturaWins: spazWins,
    claudeCodeWins: claudeWins,
    ties,
    spazzaturaAvgScore: Math.round(spazAvg),
    claudeCodeAvgScore: Math.round(claudeAvg),
    spazzaturaWinsCategories: categories,
  };
}

function formatMarkdownReport(report: BenchmarkReport): string {
  const s = report.summary;
  const lines = [
    '# Spazzatura Benchmark Report',
    '',
    `**Date**: ${report.timestamp}`,
    '',
    '## Summary',
    '',
    `| Metric | Spazzatura | Claude Code |`,
    `|--------|-----------|-------------|`,
    `| Wins | ${s.spazzaturaWins} | ${s.claudeCodeWins} |`,
    `| Avg Score | ${s.spazzaturaAvgScore}/100 | ${s.claudeCodeAvgScore}/100 |`,
    `| Ties | ${s.ties} | - |`,
    '',
    s.spazzaturaWins >= 3
      ? '**RESULT: Spazzatura wins! ≥3 categories won.**'
      : `**RESULT: Need ${3 - s.spazzaturaWins} more wins to declare victory.**`,
    '',
    '## Task Results',
    '',
    '| Task | Category | Spazzatura | Claude Code | Winner |',
    '|------|----------|-----------|-------------|--------|',
    ...report.tasks.map(t =>
      `| ${t.taskName} | ${t.category} | ${t.spazzatura.result.score}/100 | ${t.claudeCode?.result.score ?? 'N/A'}/100 | ${t.winner} |`
    ),
    '',
    '## Category Wins',
    '',
    s.spazzaturaWinsCategories.length > 0
      ? `Spazzatura wins in: ${s.spazzaturaWinsCategories.join(', ')}`
      : 'No category wins yet.',
  ];

  return lines.join('\n');
}

// CLI entry point
if (process.argv[1]?.endsWith('runner.js')) {
  const verbose = process.argv.includes('--verbose') || process.argv.includes('-v');
  const outputFile = process.argv.find(a => a.startsWith('--output='))?.split('=')[1]
    ?? 'benchmark-results.json';

  runBenchmark({ verbose, outputFile }).then(report => {
    const s = report.summary;
    console.log('\n=== BENCHMARK COMPLETE ===');
    console.log(`Spazzatura: ${s.spazzaturaWins} wins, avg ${s.spazzaturaAvgScore}/100`);
    console.log(`Claude Code: ${s.claudeCodeWins} wins, avg ${s.claudeCodeAvgScore}/100`);
    console.log(`Ties: ${s.ties}`);
    console.log(`\nReport saved to: ${outputFile}`);
    if (s.spazzaturaWins >= 3) {
      console.log('\n🎉 Spazzatura wins on ≥3 categories!');
    }
  }).catch(console.error);
}
