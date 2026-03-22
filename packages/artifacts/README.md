# @spazzatura/artifacts

Output management for Spazzatura.

## Overview

This package provides artifact management for storing, versioning, and retrieving generated outputs.

## Installation

```bash
pnpm add @spazzatura/artifacts
```

## Usage

```typescript
import { ArtifactManager } from '@spazzatura/artifacts';

const manager = new ArtifactManager({
  basePath: './artifacts',
});

// Create an artifact
const artifact = await manager.create({
  metadata: {
    type: 'code',
    name: 'generated-component.tsx',
    mimeType: 'text/typescript',
  },
  content: 'export const Component = () => <div />;',
  path: 'components/Component.tsx',
});

// Read an artifact
const existing = await manager.read(artifact.metadata.id);

// List artifacts
const artifacts = await manager.list({
  type: 'code',
  createdAfter: new Date('2024-01-01'),
});

// Get version history
const versions = await manager.listVersions(artifact.metadata.id);
```

## Artifact Types

- `file` - Generic file artifacts
- `code` - Source code files
- `document` - Documentation files
- `image` - Image files
- `data` - Data files (JSON, YAML, etc.)
- `log` - Log files
- `report` - Report files

## Features

- Version history
- Metadata tracking
- Tag-based organization
- Retention policies
- Compression support

## License

MIT
