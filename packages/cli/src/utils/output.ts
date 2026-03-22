/**
 * Output utilities
 * Formatted output for CLI
 */

import chalk from 'chalk';
import { formatJSON } from '../ui/highlight.js';

/**
 * Output format type
 */
export type OutputFormat = 'colorful' | 'plain' | 'json';

/**
 * Output manager
 */
class OutputManager {
  private format: OutputFormat = 'colorful';
  private quiet: boolean = false;
  
  setFormat(format: OutputFormat): void {
    this.format = format;
  }
  
  setQuiet(quiet: boolean): void {
    this.quiet = quiet;
  }
  
  /**
   * Print info message
   */
  info(message: string): void {
    if (this.quiet) return;
    
    if (this.format === 'json') {
      this.json({ type: 'info', message });
    } else {
      console.log(message);
    }
  }
  
  /**
   * Print success message
   */
  success(message: string): void {
    if (this.quiet) return;
    
    if (this.format === 'json') {
      this.json({ type: 'success', message });
    } else if (this.format === 'colorful') {
      console.log(chalk.green('✓ ') + message);
    } else {
      console.log(`✓ ${message}`);
    }
  }
  
  /**
   * Print warning message
   */
  warn(message: string): void {
    if (this.quiet) return;
    
    if (this.format === 'json') {
      this.json({ type: 'warning', message });
    } else if (this.format === 'colorful') {
      console.log(chalk.yellow('⚠ ') + message);
    } else {
      console.log(`⚠ ${message}`);
    }
  }
  
  /**
   * Print error message
   */
  error(message: string): void {
    if (this.format === 'json') {
      this.json({ type: 'error', message });
    } else if (this.format === 'colorful') {
      console.error(chalk.red('✗ ') + message);
    } else {
      console.error(`✗ ${message}`);
    }
  }
  
  /**
   * Print debug message
   */
  debug(message: string): void {
    if (this.quiet) return;
    
    if (this.format === 'json') {
      this.json({ type: 'debug', message });
    } else if (this.format === 'colorful') {
      console.log(chalk.dim('[debug] ' + message));
    } else {
      console.log(`[debug] ${message}`);
    }
  }
  
  /**
   * Print JSON data
   */
  json(data: unknown): void {
    if (this.format === 'colorful') {
      console.log(formatJSON(data as string | object));
    } else {
      console.log(JSON.stringify(data, null, 2));
    }
  }
  
  /**
   * Print a newline
   */
  newline(): void {
    if (this.quiet) return;
    console.log();
  }
  
  /**
   * Clear the screen
   */
  clear(): void {
    if (this.quiet) return;
    console.clear();
  }
  
  /**
   * Print a header
   */
  header(text: string): void {
    if (this.quiet) return;
    
    if (this.format === 'colorful') {
      console.log(chalk.cyan.bold(`\n${text}`));
      console.log(chalk.dim('─'.repeat(50)));
    } else {
      console.log(`\n${text}`);
      console.log('─'.repeat(50));
    }
  }
  
  /**
   * Print a subheader
   */
  subheader(text: string): void {
    if (this.quiet) return;
    
    if (this.format === 'colorful') {
      console.log(chalk.bold(`\n${text}`));
    } else {
      console.log(`\n${text}`);
    }
  }
  
  /**
   * Print a list
   */
  list(items: string[], ordered: boolean = false): void {
    if (this.quiet) return;
    
    items.forEach((item, i) => {
      const prefix = ordered ? `${i + 1}.` : '•';
      
      if (this.format === 'colorful') {
        console.log(chalk.cyan(`${prefix} `) + item);
      } else {
        console.log(`${prefix} ${item}`);
      }
    });
  }
  
  /**
   * Print a key-value pair
   */
  kv(key: string, value: string): void {
    if (this.quiet) return;
    
    if (this.format === 'colorful') {
      console.log(`${chalk.bold(key)}: ${value}`);
    } else {
      console.log(`${key}: ${value}`);
    }
  }
  
  /**
   * Print a table
   */
  table(headers: string[], rows: string[][]): void {
    if (this.quiet) return;
    
    // Calculate column widths
    const widths = headers.map((h, i) => {
      return Math.max(h.length, ...rows.map(r => (r[i] || '').length));
    });
    
    // Print header
    const headerLine = headers.map((h, i) => h.padEnd(widths[i])).join('  ');
    if (this.format === 'colorful') {
      console.log(chalk.bold(headerLine));
    } else {
      console.log(headerLine);
    }
    
    // Print separator
    console.log(widths.map(w => '─'.repeat(w)).join('  '));
    
    // Print rows
    for (const row of rows) {
      const line = row.map((cell, i) => (cell || '').padEnd(widths[i])).join('  ');
      console.log(line);
    }
  }
  
  /**
   * Print raw output (bypasses formatting)
   */
  raw(message: string): void {
    console.log(message);
  }
}

// Export singleton instance
export const output = new OutputManager();

// Export class for testing
export { OutputManager };
