/**
 * Benchmark task types
 */

export interface BenchmarkTask {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly category: 'implement-feature' | 'fix-bug' | 'write-tests' | 'refactor' | 'explain-code';
  /** Setup function — creates a temp workspace with the input files */
  setup(workDir: string): Promise<void>;
  /** Verification function — checks if the output meets success criteria */
  verify(workDir: string, output: string): Promise<BenchmarkResult>;
}

export interface BenchmarkResult {
  readonly success: boolean;
  readonly score: number; // 0-100
  readonly checks: readonly CheckResult[];
  readonly error?: string;
}

export interface CheckResult {
  readonly name: string;
  readonly passed: boolean;
  readonly detail?: string;
}

export interface RunResult {
  readonly taskId: string;
  readonly tool: string;
  readonly output: string;
  readonly durationMs: number;
  readonly result: BenchmarkResult;
  readonly error?: string;
}

export interface BenchmarkReport {
  readonly timestamp: string;
  readonly tasks: readonly TaskReport[];
  readonly summary: Summary;
}

export interface TaskReport {
  readonly taskId: string;
  readonly taskName: string;
  readonly category: string;
  readonly spazzatura: RunResult;
  readonly claudeCode?: RunResult;
  readonly winner: 'spazzatura' | 'claude-code' | 'tie';
}

export interface Summary {
  readonly totalTasks: number;
  readonly spazzaturaWins: number;
  readonly claudeCodeWins: number;
  readonly ties: number;
  readonly spazzaturaAvgScore: number;
  readonly claudeCodeAvgScore: number;
  readonly spazzaturaWinsCategories: readonly string[];
}
