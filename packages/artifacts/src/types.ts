/**
 * Artifact types for Spazzatura
 */

/**
 * Artifact identifier
 */
export type ArtifactId = string;

/**
 * Artifact type
 */
export type ArtifactType = 
  | 'file'
  | 'code'
  | 'document'
  | 'image'
  | 'data'
  | 'log'
  | 'report';

/**
 * Artifact status
 */
export type ArtifactStatus = 'pending' | 'created' | 'modified' | 'deleted';

/**
 * Artifact metadata
 */
export interface ArtifactMetadata {
  readonly id: ArtifactId;
  readonly type: ArtifactType;
  readonly name: string;
  readonly description?: string;
  readonly mimeType?: string;
  readonly size?: number;
  readonly createdAt: Date;
  readonly modifiedAt: Date;
  readonly tags?: readonly string[];
  readonly status: ArtifactStatus;
}

/**
 * Artifact content
 */
export interface Artifact {
  readonly metadata: ArtifactMetadata;
  readonly content: string | Buffer;
  readonly path?: string;
}

/**
 * Artifact storage configuration
 */
export interface ArtifactStorageConfig {
  readonly basePath: string;
  readonly maxFileSize?: number;
  readonly retentionDays?: number;
  readonly compress?: boolean;
}

/**
 * Artifact filter for searching
 */
export interface ArtifactFilter {
  readonly type?: ArtifactType;
  readonly status?: ArtifactStatus;
  readonly tags?: readonly string[];
  readonly createdAfter?: Date;
  readonly createdBefore?: Date;
  readonly modifiedAfter?: Date;
  readonly modifiedBefore?: Date;
}

/**
 * Artifact version
 */
export interface ArtifactVersion {
  readonly version: number;
  readonly metadata: ArtifactMetadata;
  readonly content: string | Buffer;
  readonly createdAt: Date;
  readonly createdBy?: string;
  readonly changeDescription?: string;
}

/**
 * Artifact manager interface
 */
export interface IArtifactManager {
  create(artifact: Omit<Artifact, 'metadata'> & { metadata: Partial<ArtifactMetadata> }): Promise<Artifact>;
  read(id: ArtifactId): Promise<Artifact | null>;
  update(id: ArtifactId, content: string | Buffer): Promise<Artifact>;
  delete(id: ArtifactId): Promise<void>;
  list(filter?: ArtifactFilter): Promise<readonly ArtifactMetadata[]>;
  getVersion(id: ArtifactId, version: number): Promise<ArtifactVersion | null>;
  listVersions(id: ArtifactId): Promise<readonly ArtifactVersion[]>;
}
