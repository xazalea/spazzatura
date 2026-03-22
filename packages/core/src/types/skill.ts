/**
 * Skill types for the modular skills system
 */

/**
 * Skill identifier
 */
export type SkillId = string;

/**
 * Skill version following semver
 */
export type SkillVersion = string;

/**
 * Skill category for organization
 */
export type SkillCategory = 
  | 'coding'
  | 'analysis'
  | 'review'
  | 'testing'
  | 'documentation'
  | 'workflow'
  | 'custom';

/**
 * Skill execution mode
 */
export type SkillMode = 
  | 'sync'
  | 'async'
  | 'streaming';

/**
 * Skill parameter definition
 */
export interface SkillParameter {
  readonly name: string;
  readonly type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  readonly description: string;
  readonly required: boolean;
  readonly default?: unknown;
  readonly enum?: readonly string[];
}

/**
 * Skill configuration
 */
export interface SkillConfig {
  readonly id: SkillId;
  readonly name: string;
  readonly version: SkillVersion;
  readonly description: string;
  readonly category: SkillCategory;
  readonly author?: string;
  readonly tags?: readonly string[];
  readonly parameters?: readonly SkillParameter[];
  readonly mode: SkillMode;
  readonly timeout?: number;
  readonly dependencies?: readonly SkillId[];
}

/**
 * Skill execution context
 */
export interface SkillContext {
  readonly sessionId: string;
  readonly workingDirectory: string;
  readonly parameters: Record<string, unknown>;
  readonly environment: Record<string, string>;
  readonly logger: SkillLogger;
}

/**
 * Skill logger interface
 */
export interface SkillLogger {
  debug(message: string, ...args: readonly unknown[]): void;
  info(message: string, ...args: readonly unknown[]): void;
  warn(message: string, ...args: readonly unknown[]): void;
  error(message: string, ...args: readonly unknown[]): void;
}

/**
 * Skill execution result
 */
export interface SkillResult {
  readonly success: boolean;
  readonly output?: unknown;
  readonly artifacts?: readonly SkillArtifact[];
  readonly duration: number;
  readonly error?: string;
}

/**
 * Skill artifact (generated file, output, etc.)
 */
export interface SkillArtifact {
  readonly type: 'file' | 'text' | 'json' | 'markdown';
  readonly name: string;
  readonly content: string;
  readonly path?: string;
}

/**
 * Skill metadata for marketplace
 */
export interface SkillMetadata extends SkillConfig {
  readonly downloads?: number;
  readonly rating?: number;
  readonly reviews?: number;
  readonly lastUpdated: Date;
  readonly homepage?: string;
  readonly repository?: string;
  readonly license?: string;
}

/**
 * Skill interface that all skills must implement
 */
export interface ISkill {
  readonly id: SkillId;
  readonly config: SkillConfig;
  
  execute(context: SkillContext): Promise<SkillResult>;
  validate(parameters: Record<string, unknown>): boolean;
}

/**
 * Skill registry interface
 */
export interface ISkillRegistry {
  register(skill: ISkill): void;
  unregister(skillId: SkillId): void;
  get(skillId: SkillId): ISkill | undefined;
  list(filter?: SkillFilter): readonly SkillMetadata[];
}

/**
 * Skill filter for searching
 */
export interface SkillFilter {
  readonly category?: SkillCategory;
  readonly tags?: readonly string[];
  readonly query?: string;
}
