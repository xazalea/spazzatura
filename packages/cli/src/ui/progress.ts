/**
 * Progress indicators UI component
 * Progress bars and status displays
 */

import chalk from 'chalk';

/**
 * Progress bar options
 */
export interface ProgressBarOptions {
  width?: number;
  complete?: string;
  incomplete?: string;
  showPercentage?: boolean;
  showCount?: boolean;
}

/**
 * Create a progress bar
 */
export function createProgressBar(
  current: number,
  total: number,
  options: ProgressBarOptions = {}
): string {
  const {
    width = 40,
    complete = '█',
    incomplete = '░',
    showPercentage = true,
    showCount = false,
  } = options;

  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const completeWidth = Math.round((percentage / 100) * width);
  const incompleteWidth = width - completeWidth;

  const bar = chalk.green(complete.repeat(completeWidth)) + 
              chalk.dim(incomplete.repeat(incompleteWidth));

  let label = '';
  if (showPercentage && showCount) {
    label = ` ${percentage.toFixed(1)}% (${current}/${total})`;
  } else if (showPercentage) {
    label = ` ${percentage.toFixed(1)}%`;
  } else if (showCount) {
    label = ` (${current}/${total})`;
  }

  return `[${bar}]${label}`;
}

/**
 * Progress bar class for streaming updates
 */
export class ProgressBar {
  private current: number = 0;
  private total: number;
  private options: ProgressBarOptions;
  private startTime: number | null = null;
  
  constructor(total: number, options: ProgressBarOptions = {}) {
    this.total = total;
    this.options = options;
  }
  
  start(): this {
    this.startTime = Date.now();
    this.render();
    return this;
  }
  
  update(current: number): this {
    this.current = Math.min(current, this.total);
    this.render();
    return this;
  }
  
  increment(amount: number = 1): this {
    return this.update(this.current + amount);
  }
  
  complete(): void {
    this.current = this.total;
    this.render();
    process.stdout.write('\n');
  }
  
  private render(): void {
    const bar = createProgressBar(this.current, this.total, this.options);
    const elapsed = this.startTime ? ((Date.now() - this.startTime) / 1000).toFixed(1) : '0.0';
    const eta = this.calculateETA();
    
    process.stdout.write(`\r${bar} ${chalk.dim(`[${elapsed}s elapsed, ${eta}s remaining]`)}`);
  }
  
  private calculateETA(): string {
    if (!this.startTime || this.current === 0) {
      return '-';
    }
    
    const elapsed = (Date.now() - this.startTime) / 1000;
    const rate = this.current / elapsed;
    const remaining = (this.total - this.current) / rate;
    
    return remaining.toFixed(1);
  }
}

/**
 * Multi-progress display
 */
export class MultiProgress {
  private bars: Map<string, ProgressBar> = new Map();
  
  add(name: string, total: number, options: ProgressBarOptions = {}): void {
    this.bars.set(name, new ProgressBar(total, options));
  }
  
  start(name: string): void {
    const bar = this.bars.get(name);
    if (bar) {
      bar.start();
    }
  }
  
  update(name: string, current: number): void {
    const bar = this.bars.get(name);
    if (bar) {
      bar.update(current);
    }
  }
  
  complete(name: string): void {
    const bar = this.bars.get(name);
    if (bar) {
      bar.complete();
    }
  }
  
  render(): string {
    const lines: string[] = [];
    
    for (const [name, bar] of this.bars) {
      lines.push(`${chalk.cyan(name)}: ${createProgressBar(0, 100)}`);
    }
    
    return lines.join('\n');
  }
}

/**
 * Status indicator
 */
export type Status = 'pending' | 'running' | 'success' | 'warning' | 'error';

export function statusIcon(status: Status): string {
  const icons = {
    pending: chalk.dim('○'),
    running: chalk.cyan('●'),
    success: chalk.green('✓'),
    warning: chalk.yellow('⚠'),
    error: chalk.red('✗'),
  };
  
  return icons[status];
}

/**
 * Task list display
 */
export interface TaskItem {
  name: string;
  status: Status;
  message?: string;
}

export function formatTaskList(tasks: TaskItem[]): string {
  const lines: string[] = [];
  
  for (const task of tasks) {
    const icon = statusIcon(task.status);
    const name = task.status === 'running' 
      ? chalk.cyan(task.name)
      : task.status === 'success'
        ? chalk.dim(task.name)
        : task.name;
    
    let line = `${icon} ${name}`;
    
    if (task.message) {
      line += ` ${chalk.dim(task.message)}`;
    }
    
    lines.push(line);
  }
  
  return lines.join('\n');
}

/**
 * Spinner frames for progress
 */
const SPINNER_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];

/**
 * Animated spinner text
 */
export function spinnerText(frame: number, text: string): string {
  const icon = chalk.cyan(SPINNER_FRAMES[frame % SPINNER_FRAMES.length]);
  return `${icon} ${text}`;
}

/**
 * Simple progress indicator
 */
export class SimpleProgress {
  private frame: number = 0;
  private text: string;
  
  constructor(text: string) {
    this.text = text;
  }
  
  render(): string {
    const output = spinnerText(this.frame, this.text);
    this.frame++;
    return output;
  }
  
  update(text: string): void {
    this.text = text;
  }
}

/**
 * Download progress formatter
 */
export function formatDownloadProgress(
  downloaded: number,
  total: number,
  speed?: number
): string {
  const bar = createProgressBar(downloaded, total, { showCount: true });
  
  const formatBytes = (bytes: number): string => {
    const units = ['B', 'KB', 'MB', 'GB'];
    let unit = 0;
    let size = bytes;
    
    while (size >= 1024 && unit < units.length - 1) {
      size /= 1024;
      unit++;
    }
    
    return `${size.toFixed(1)} ${units[unit]}`;
  };
  
  let info = `${formatBytes(downloaded)} / ${formatBytes(total)}`;
  
  if (speed) {
    info += ` (${formatBytes(speed)}/s)`;
  }
  
  return `${bar}\n${chalk.dim(info)}`;
}
