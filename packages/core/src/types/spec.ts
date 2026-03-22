/**
 * Specification types for spec-driven development
 */

/**
 * Spec format types
 */
export type SpecFormat = 'yaml' | 'markdown' | 'json';

/**
 * Spec status
 */
export type SpecStatus = 
  | 'draft'
  | 'review'
  | 'approved'
  | 'implemented'
  | 'deprecated';

/**
 * Spec severity level
 */
export type SpecSeverity = 'must' | 'should' | 'may';

/**
 * Spec identifier
 */
export type SpecId = string;

/**
 * Specification metadata
 */
export interface SpecMetadata {
  readonly id: SpecId;
  readonly title: string;
  readonly version: string;
  readonly status: SpecStatus;
  readonly authors?: readonly string[];
  readonly created: Date;
  readonly updated: Date;
  readonly tags?: readonly string[];
}

/**
 * Requirement specification
 */
export interface Requirement {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly severity: SpecSeverity;
  readonly acceptance?: readonly AcceptanceCriteria[];
  readonly dependencies?: readonly string[];
}

/**
 * Acceptance criteria for a requirement
 */
export interface AcceptanceCriteria {
  readonly id: string;
  readonly given: string;
  readonly when: string;
  readonly then: string;
}

/**
 * Specification section
 */
export interface SpecSection {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly requirements?: readonly Requirement[];
  readonly subsections?: readonly SpecSection[];
}

/**
 * Full specification document
 */
export interface SpecDocument {
  readonly metadata: SpecMetadata;
  readonly description: string;
  readonly sections: readonly SpecSection[];
  readonly glossary?: Record<string, string>;
  readonly references?: readonly string[];
}

/**
 * Spec validation result
 */
export interface SpecValidationResult {
  readonly valid: boolean;
  readonly errors: readonly SpecError[];
  readonly warnings: readonly SpecWarning[];
}

/**
 * Spec validation error
 */
export interface SpecError {
  readonly code: string;
  readonly message: string;
  readonly location?: SpecLocation;
}

/**
 * Spec validation warning
 */
export interface SpecWarning {
  readonly code: string;
  readonly message: string;
  readonly location?: SpecLocation;
}

/**
 * Location in a spec document
 */
export interface SpecLocation {
  readonly line: number;
  readonly column: number;
  readonly section?: string;
}

/**
 * Spec sync status for bidirectional sync
 */
export interface SpecSyncStatus {
  readonly specId: SpecId;
  readonly lastSync: Date;
  readonly specModified: boolean;
  readonly codeModified: boolean;
  readonly conflicts?: readonly SpecConflict[];
}

/**
 * Spec conflict during sync
 */
export interface SpecConflict {
  readonly type: 'requirement' | 'section' | 'metadata';
  readonly id: string;
  readonly specValue: unknown;
  readonly codeValue: unknown;
  readonly resolution?: 'spec' | 'code' | 'manual';
}

/**
 * Spec engine interface
 */
export interface ISpecEngine {
  parse(content: string, format: SpecFormat): Promise<SpecDocument>;
  validate(spec: SpecDocument): Promise<SpecValidationResult>;
  sync(spec: SpecDocument, codePath: string): Promise<SpecSyncStatus>;
  generate(spec: SpecDocument, template: string): Promise<string>;
}
