/**
 * Logger utility for Spazzatura
 */

/**
 * Log level types
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'silent';

/**
 * Logger configuration
 */
export interface LoggerConfig {
  readonly level: LogLevel;
  readonly prefix?: string;
  readonly timestamp?: boolean;
  readonly colorize?: boolean;
}

/**
 * Default logger configuration
 */
const DEFAULT_CONFIG: LoggerConfig = {
  level: 'info',
  timestamp: true,
  colorize: true,
};

/**
 * Log level priority mapping
 */
const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
  silent: 4,
};

/**
 * ANSI color codes for terminal output
 */
const COLORS = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  cyan: '\x1b[36m',
} as const;

/**
 * Logger class for consistent logging across the application
 */
export class Logger {
  private readonly config: LoggerConfig;

  constructor(config: Partial<LoggerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Log a debug message
   */
  debug(message: string, ...args: readonly unknown[]): void {
    this.log('debug', message, args);
  }

  /**
   * Log an info message
   */
  info(message: string, ...args: readonly unknown[]): void {
    this.log('info', message, args);
  }

  /**
   * Log a warning message
   */
  warn(message: string, ...args: readonly unknown[]): void {
    this.log('warn', message, args);
  }

  /**
   * Log an error message
   */
  error(message: string, ...args: readonly unknown[]): void {
    this.log('error', message, args);
  }

  /**
   * Create a child logger with a prefix
   */
  child(prefix: string): Logger {
    return new Logger({
      ...this.config,
      prefix: this.config.prefix ? `${this.config.prefix}:${prefix}` : prefix,
    });
  }

  /**
   * Internal log method
   */
  private log(level: LogLevel, message: string, args: readonly unknown[]): void {
    if (LOG_LEVELS[level] < LOG_LEVELS[this.config.level]) {
      return;
    }

    const parts: string[] = [];

    // Add timestamp
    if (this.config.timestamp) {
      const timestamp = new Date().toISOString();
      parts.push(this.config.colorize ? `${COLORS.dim}${timestamp}${COLORS.reset}` : timestamp);
    }

    // Add level
    const levelStr = level.toUpperCase().padEnd(5);
    if (this.config.colorize) {
      const color = this.getLevelColor(level);
      parts.push(`${color}${levelStr}${COLORS.reset}`);
    } else {
      parts.push(levelStr);
    }

    // Add prefix
    if (this.config.prefix) {
      parts.push(`[${this.config.prefix}]`);
    }

    // Add message
    parts.push(message);

    // Output to appropriate stream
    const output = parts.join(' ');
    const formattedArgs = args.length > 0 ? args : undefined;

    if (level === 'error') {
      console.error(output, ...(formattedArgs ?? []));
    } else {
      console.log(output, ...(formattedArgs ?? []));
    }
  }

  /**
   * Get color for log level
   */
  private getLevelColor(level: LogLevel): string {
    switch (level) {
      case 'debug':
        return COLORS.cyan;
      case 'info':
        return COLORS.blue;
      case 'warn':
        return COLORS.yellow;
      case 'error':
        return COLORS.red;
      default:
        return COLORS.reset;
    }
  }
}

/**
 * Default logger instance
 */
export const logger = new Logger();

/**
 * Create a new logger with custom configuration
 */
export function createLogger(config: Partial<LoggerConfig>): Logger {
  return new Logger(config);
}
