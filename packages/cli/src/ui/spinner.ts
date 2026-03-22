/**
 * Spinner UI component
 * Loading spinner using ora
 */

import ora, { Ora } from 'ora';
import chalk from 'chalk';

/**
 * Spinner instance
 */
let currentSpinner: Ora | null = null;

/**
 * Create and start a spinner
 */
export function createSpinner(text: string): Ora {
  if (currentSpinner) {
    currentSpinner.stop();
  }
  
  currentSpinner = ora({
    text,
    spinner: 'dots',
    color: 'cyan',
  });
  
  return currentSpinner;
}

/**
 * Stop current spinner with success
 */
export function spinnerSuccess(text?: string): void {
  if (currentSpinner) {
    currentSpinner.succeed(text);
    currentSpinner = null;
  }
}

/**
 * Stop current spinner with failure
 */
export function spinnerFail(text?: string): void {
  if (currentSpinner) {
    currentSpinner.fail(text);
    currentSpinner = null;
  }
}

/**
 * Stop current spinner with warning
 */
export function spinnerWarn(text?: string): void {
  if (currentSpinner) {
    currentSpinner.warn(text);
    currentSpinner = null;
  }
}

/**
 * Stop current spinner with info
 */
export function spinnerInfo(text?: string): void {
  if (currentSpinner) {
    currentSpinner.info(text);
    currentSpinner = null;
  }
}

/**
 * Stop current spinner
 */
export function spinnerStop(): void {
  if (currentSpinner) {
    currentSpinner.stop();
    currentSpinner = null;
  }
}

/**
 * Update spinner text
 */
export function spinnerUpdate(text: string): void {
  if (currentSpinner) {
    currentSpinner.text = text;
  }
}

/**
 * Create a progress spinner with steps
 */
export class ProgressSpinner {
  private spinner: Ora;
  private current: number = 0;
  private total: number;
  
  constructor(total: number, initialText: string = 'Processing') {
    this.total = total;
    this.spinner = ora({
      text: `${initialText} (0/${total})`,
      spinner: 'dots',
      color: 'cyan',
    });
  }
  
  start(): this {
    this.spinner.start();
    return this;
  }
  
  step(text?: string): this {
    this.current++;
    const progress = chalk.dim(`(${this.current}/${this.total})`);
    this.spinner.text = text ? `${text} ${progress}` : `Processing ${progress}`;
    
    if (this.current >= this.total) {
      this.spinner.succeed();
    }
    
    return this;
  }
  
  succeed(text?: string): void {
    this.spinner.succeed(text);
  }
  
  fail(text?: string): void {
    this.spinner.fail(text);
  }
  
  stop(): void {
    this.spinner.stop();
  }
}

/**
 * Create a countdown spinner
 */
export async function countdownSpinner(
  seconds: number,
  text: string = 'Waiting'
): Promise<void> {
  const spinner = ora({
    text: `${text} (${seconds}s)`,
    spinner: 'dots',
    color: 'yellow',
  }).start();
  
  for (let i = seconds; i > 0; i--) {
    spinner.text = `${text} (${i}s)`;
    await new Promise(resolve => setTimeout(resolve, 1000));
  }
  
  spinner.succeed(`${text} (done)`);
}
