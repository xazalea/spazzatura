import { exec } from 'child_process';
import { promisify } from 'util';

const execAsync = promisify(exec);

export class AutoTasker {
  private taskIndex = 0;
  private readonly tasks: Array<() => Promise<string>> = [];

  constructor() {
    this.tasks = [
      () => this.runGitStatus(),
      () => this.runLintCheck(),
      () => this.getFileTree(),
    ];
  }

  async runGitStatus(): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync('git status --short', {
        timeout: 10_000,
      });
      const out = (stdout + stderr).trim();
      return out.length > 0 ? `Git status:\n${out}` : 'Git status: clean working tree (^_^)';
    } catch {
      return 'Git status: not a git repo or git not found';
    }
  }

  async runLintCheck(): Promise<string> {
    try {
      const { stdout, stderr } = await execAsync('pnpm lint', {
        timeout: 30_000,
      });
      const out = (stdout + stderr).trim();
      return `Lint check:\n${out.slice(0, 500)}`;
    } catch (err) {
      const msg = err instanceof Error ? err.message.slice(0, 300) : 'unknown error';
      return `Lint check found issues:\n${msg}`;
    }
  }

  async getFileTree(): Promise<string> {
    try {
      const { stdout } = await execAsync('ls -la', { timeout: 5_000 });
      return `File tree:\n${stdout.trim().slice(0, 500)}`;
    } catch {
      return 'Could not read file tree';
    }
  }

  async runNextTask(): Promise<string> {
    const task = this.tasks[this.taskIndex % this.tasks.length];
    this.taskIndex++;
    return task ? task() : 'No tasks available';
  }
}
