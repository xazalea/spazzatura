/**
 * @spazzatura/benchmark
 * Benchmark suite comparing Spazzatura vs Claude Code
 */

export { runBenchmark } from './runner.js';
export type {
  BenchmarkTask,
  BenchmarkResult,
  BenchmarkReport,
  RunResult,
  TaskReport,
  Summary,
} from './tasks/types.js';
export { implementFeatureTasks } from './tasks/implement-feature.js';
export { fixBugTasks } from './tasks/fix-bug.js';
export { writeTestsTasks } from './tasks/write-tests.js';
export { refactorTasks } from './tasks/refactor.js';
export { explainCodeTasks } from './tasks/explain-code.js';
