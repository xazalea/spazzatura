/**
 * CLI types for Spazzatura
 */

/**
 * CLI command definition
 */
export interface Command {
  readonly name: string;
  readonly description: string;
  readonly aliases?: readonly string[];
  readonly arguments?: readonly CommandArgument[];
  readonly options?: readonly CommandOption[];
  readonly subcommands?: readonly Command[];
  readonly handler?: CommandHandler;
}

/**
 * Command argument
 */
export interface CommandArgument {
  readonly name: string;
  readonly description: string;
  readonly required: boolean;
  readonly variadic?: boolean;
}

/**
 * Command option
 */
export interface CommandOption {
  readonly name: string;
  readonly shortName?: string;
  readonly description: string;
  readonly type?: 'string' | 'boolean' | 'number';
  readonly default?: unknown;
  readonly required?: boolean;
}

/**
 * Command handler function
 */
export type CommandHandler = (context: CommandContext) => Promise<void> | void;

/**
 * Command execution context
 */
export interface CommandContext {
  readonly args: readonly string[];
  readonly options: Record<string, unknown>;
  readonly workingDirectory: string;
  readonly stdin: NodeJS.ReadableStream;
  readonly stdout: NodeJS.WritableStream;
  readonly stderr: NodeJS.WritableStream;
}

/**
 * CLI configuration
 */
export interface CLIConfig {
  readonly name: string;
  readonly version: string;
  readonly description: string;
  readonly commands: readonly Command[];
}
