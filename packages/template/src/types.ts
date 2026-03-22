/**
 * Template types for Spazzatura
 * Inspired by codebuff's template system with undo/redo support
 */

/**
 * Template identifier
 */
export type TemplateId = string;

/**
 * Template format
 */
export type TemplateFormat = 'handlebars' | 'mustache' | 'ejs' | 'liquid' | 'builtin';

/**
 * Template source type
 */
export type TemplateSource = 'file' | 'string' | 'url' | 'npm' | 'git' | 'builtin';

/**
 * Validation rule for template variables
 */
export interface ValidationRule {
  /** Regex pattern to match */
  pattern?: string | undefined;
  /** Custom error message */
  message?: string | undefined;
  /** Minimum value (for numbers) or length (for strings) */
  min?: number | undefined;
  /** Maximum value (for numbers) or length (for strings) */
  max?: number | undefined;
  /** Custom validation function name */
  custom?: string | undefined;
}

/**
 * Select option for select/multiselect types
 */
export interface SelectOption {
  label: string;
  value: string | number | boolean;
}

/**
 * Template variable definition
 */
export interface TemplateVariable {
  /** Variable name */
  name: string;
  /** Variable type */
  type: 'string' | 'number' | 'boolean' | 'select' | 'multiselect';
  /** Description for prompts */
  description?: string | undefined;
  /** Default value */
  default?: unknown;
  /** Whether the variable is required */
  required: boolean;
  /** Validation rules */
  validation?: ValidationRule | undefined;
  /** Options for select/multiselect types */
  options?: SelectOption[] | undefined;
  /** Group for organizing variables */
  group?: string | undefined;
}

/**
 * Template content generator function
 */
export type TemplateContentGenerator = (variables: Record<string, unknown>) => string;

/**
 * File write mode
 */
export type FileWriteMode = 'create' | 'overwrite' | 'append' | 'prepend';

/**
 * Template file definition
 */
export interface TemplateFile {
  /** Output file path (supports {{variable}} syntax) */
  path: string;
  /** File content (string or generator function) */
  content: string | TemplateContentGenerator;
  /** Conditional inclusion (evaluated expression) */
  condition?: string | undefined;
  /** File write mode */
  mode?: FileWriteMode | undefined;
  /** File permissions (Unix mode) */
  permissions?: string | undefined;
  /** Whether to skip if file exists */
  skipIfExists?: boolean | undefined;
  /** Transform to apply to content */
  transform?: 'none' | 'prettier' | 'eslint-fix' | undefined;
}

/**
 * Hook context passed to hook functions
 */
export interface HookContext {
  /** Template name */
  templateName: string;
  /** Resolved variables */
  variables: Record<string, unknown>;
  /** Files to be generated */
  files: GeneratedFile[];
  /** Working directory */
  cwd: string;
  /** Additional data */
  data?: Record<string, unknown> | undefined;
}

/**
 * Hook function type
 */
export type HookFunction = (context: HookContext) => Promise<void> | void;

/**
 * Template hooks for lifecycle events
 */
export interface TemplateHooks {
  /** Called before generation starts */
  beforeGenerate?: HookFunction | undefined;
  /** Called after generation completes */
  afterGenerate?: HookFunction | undefined;
  /** Called before each file is written */
  beforeFileWrite?: HookFunction | undefined;
  /** Called after each file is written */
  afterFileWrite?: HookFunction | undefined;
}

/**
 * Template metadata
 */
export interface TemplateMeta {
  /** Template name */
  name: string;
  /** Template version */
  version: string;
  /** Template description */
  description?: string | undefined;
  /** Template author */
  author?: string | undefined;
  /** Template tags for search */
  tags?: string[] | undefined;
  /** Template license */
  license?: string | undefined;
  /** Repository URL */
  repository?: string | undefined;
  /** Homepage URL */
  homepage?: string | undefined;
  /** Minimum Spazzatura version */
  minVersion?: string | undefined;
  /** Keywords for search */
  keywords?: string[] | undefined;
}

/**
 * Complete template definition
 */
export interface Template extends TemplateMeta {
  /** Unique template identifier */
  id?: string | undefined;
  /** Template format */
  format?: TemplateFormat | undefined;
  /** Template source */
  source?: TemplateSource | undefined;
  /** Template variables */
  variables?: TemplateVariable[] | undefined;
  /** Files to generate */
  files: TemplateFile[];
  /** Lifecycle hooks */
  hooks?: TemplateHooks | undefined;
  /** Required templates */
  dependencies?: string[];
  /** Incompatible templates */
  conflicts?: string[];
  /** Category for organization */
  category?: string;
  /** Priority for ordering */
  priority?: number;
}

/**
 * Generated file with tracking info
 */
export interface GeneratedFile {
  /** Resolved file path */
  path: string;
  /** Generated content */
  content: string;
  /** Original content (for undo) */
  originalContent?: string | undefined;
  /** Action taken */
  action: 'create' | 'modify' | 'delete' | 'skip';
  /** Whether the file was actually written */
  written?: boolean | undefined;
  /** Error if write failed */
  error?: Error | undefined;
}

/**
 * Generation result with full tracking
 */
export interface GenerationResult {
  /** Unique generation ID */
  id: string;
  /** Template name used */
  template: string;
  /** Variables used */
  variables: Record<string, unknown>;
  /** Generated files */
  files: GeneratedFile[];
  /** Generation timestamp */
  timestamp: Date;
  /** Whether this generation was undone */
  undone: boolean;
  /** Working directory */
  cwd: string;
  /** Duration in milliseconds */
  duration?: number | undefined;
  /** Error if generation failed */
  error?: Error | undefined;
}

/**
 * Template filter for searching
 */
export interface TemplateFilter {
  /** Filter by tags */
  tags?: string[];
  /** Filter by author */
  author?: string;
  /** Filter by category */
  category?: string;
  /** Search query */
  query?: string;
}

/**
 * Template render context
 */
export interface TemplateContext {
  /** Variable values */
  variables: Record<string, unknown>;
  /** Partial templates */
  partials?: Record<string, string> | undefined;
  /** Helper functions */
  helpers?: Record<string, (...args: unknown[]) => unknown> | undefined;
  /** Current working directory */
  cwd?: string | undefined;
  /** Dry run mode */
  dryRun?: boolean | undefined;
  /** Force overwrite */
  force?: boolean | undefined;
}

/**
 * Template render result
 */
export interface TemplateResult {
  /** Rendered content */
  content: string;
  /** Template format */
  format: TemplateFormat;
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Template engine interface
 */
export interface ITemplateEngine {
  /** Template format */
  readonly format: TemplateFormat;
  
  /**
   * Compile a template string
   */
  compile(template: string): (context: TemplateContext) => string;
  
  /**
   * Render a template with context
   */
  render(template: string, context: TemplateContext): string;
  
  /**
   * Register a partial template
   */
  registerPartial(name: string, content: string): void;
  
  /**
   * Register a helper function
   */
  registerHelper(name: string, fn: (...args: unknown[]) => unknown): void;
  
  /**
   * Check if a template has conditional blocks
   */
  hasConditionals(template: string): boolean;
  
  /**
   * Check if a template has loops
   */
  hasLoops(template: string): boolean;
}

/**
 * Template registry interface
 */
export interface ITemplateRegistry {
  /**
   * Register a template
   */
  register(template: Template): void;
  
  /**
   * Unregister a template
   */
  unregister(templateId: TemplateId): void;
  
  /**
   * Get a template by ID or name
   */
  get(templateId: TemplateId): Template | undefined;
  
  /**
   * List all registered templates
   */
  list(): TemplateId[];
  
  /**
   * Search templates with filter
   */
  search(filter: TemplateFilter): Template[];
}

/**
 * Template loader interface
 */
export interface ITemplateLoader {
  /**
   * Load template from file
   */
  fromFile(path: string): Promise<Template>;
  
  /**
   * Load template from string
   */
  fromString(content: string, format?: 'yaml' | 'json' | 'markdown'): Promise<Template>;
  
  /**
   * Load template from URL
   */
  fromUrl(url: string): Promise<Template>;
  
  /**
   * Load template from npm package
   */
  fromNpm(packageName: string): Promise<Template>;
  
  /**
   * Load template from git repository
   */
  fromGit(repository: string, options?: { branch?: string; path?: string }): Promise<Template>;
}

/**
 * Template validator interface
 */
export interface ITemplateValidator {
  /**
   * Validate a template definition
   */
  validate(template: unknown): ValidationResult;
  
  /**
   * Validate template variables
   */
  validateVariables(template: Template, variables: Record<string, unknown>): ValidationResult;
  
  /**
   * Validate a file path
   */
  validatePath(path: string, variables: Record<string, unknown>): ValidationResult;
}

/**
 * Validation result
 */
export interface ValidationResult {
  /** Whether validation passed */
  valid: boolean;
  /** Validation errors */
  errors: ValidationError[];
  /** Validation warnings */
  warnings: ValidationWarning[];
}

/**
 * Validation error
 */
export interface ValidationError {
  /** Error code */
  code: string;
  /** Error message */
  message: string;
  /** Field that failed validation */
  field?: string;
  /** Error value */
  value?: unknown;
}

/**
 * Validation warning
 */
export interface ValidationWarning {
  /** Warning code */
  code: string;
  /** Warning message */
  message: string;
  /** Field that triggered warning */
  field?: string;
}

/**
 * History entry for undo/redo
 */
export interface HistoryEntry {
  /** Generation result */
  generation: GenerationResult;
  /** Undo stack position */
  position: number;
}

/**
 * History manager interface
 */
export interface IHistoryManager {
  /**
   * Record a generation
   */
  record(generation: GenerationResult): void;
  
  /**
   * Undo the last generation
   */
  undo(): Promise<GenerationResult | undefined>;
  
  /**
   * Redo a previously undone generation
   */
  redo(): Promise<GenerationResult | undefined>;
  
  /**
   * Get history entries
   */
  getHistory(): GenerationResult[];
  
  /**
   * Clear all history
   */
  clear(): void;
  
  /**
   * Check if undo is available
   */
  canUndo(): boolean;
  
  /**
   * Check if redo is available
   */
  canRedo(): boolean;
  
  /**
   * Get current position in history
   */
  getPosition(): number;
  
  /**
   * Set maximum history size
   */
  setMaxSize(size: number): void;
}

/**
 * Prompt options for interactive mode
 */
export interface PromptOptions {
  /** Skip prompts and use defaults */
  nonInteractive?: boolean;
  /** Pre-filled variable values */
  defaults?: Record<string, unknown>;
  /** Variables to skip */
  skip?: string[];
  /** Custom prompt message */
  message?: string;
}

/**
 * Prompt result
 */
export interface PromptResult {
  /** Variable values */
  variables: Record<string, unknown>;
  /** Whether prompts were shown */
  interactive: boolean;
  /** Skipped variables */
  skipped?: string[];
}

/**
 * Template manager interface
 */
export interface ITemplateManager extends ITemplateRegistry {
  /**
   * Generate files from a template
   */
  generate(
    templateId: TemplateId,
    variables: Record<string, unknown>,
    options?: GenerateOptions
  ): Promise<GenerationResult>;
  
  /**
   * Preview generation without writing files
   */
  preview(
    templateId: TemplateId,
    variables: Record<string, unknown>
  ): Promise<GeneratedFile[]>;
  
  /**
   * Undo a generation
   */
  undo(generationId?: string): Promise<void>;
  
  /**
   * Redo a generation
   */
  redo(generationId?: string): Promise<void>;
  
  /**
   * Get generation history
   */
  getHistory(): GenerationResult[];
  
  /**
   * Prompt for variable values
   */
  promptForVariables(
    templateId: TemplateId,
    options?: PromptOptions
  ): Promise<PromptResult>;
}

/**
 * Generation options
 */
export interface GenerateOptions {
  /** Working directory */
  cwd?: string;
  /** Dry run mode (don't write files) */
  dryRun?: boolean;
  /** Force overwrite existing files */
  force?: boolean;
  /** Skip confirmation prompts */
  yes?: boolean;
  /** Variables to skip */
  skipVariables?: string[];
  /** Custom hooks to run */
  hooks?: Partial<TemplateHooks>;
}

/**
 * Built-in template definition
 */
export interface BuiltinTemplate {
  /** Template ID */
  id: string;
  /** Template definition */
  template: Template;
  /** Template aliases */
  aliases?: string[];
}

/**
 * Helper function type for template engine
 */
export type TemplateHelperFn = (...args: unknown[]) => string;

/**
 * Common template helpers
 */
export interface TemplateHelpers {
  upper: TemplateHelperFn;
  lower: TemplateHelperFn;
  camelCase: TemplateHelperFn;
  pascalCase: TemplateHelperFn;
  kebabCase: TemplateHelperFn;
  snakeCase: TemplateHelperFn;
  capitalize: TemplateHelperFn;
  trim: TemplateHelperFn;
  default: TemplateHelperFn;
  eq: TemplateHelperFn;
  ne: TemplateHelperFn;
  lt: TemplateHelperFn;
  gt: TemplateHelperFn;
  lte: TemplateHelperFn;
  gte: TemplateHelperFn;
  and: TemplateHelperFn;
  or: TemplateHelperFn;
  not: TemplateHelperFn;
}
