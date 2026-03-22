# @spazzatura/spec

Specification engine for Spazzatura.

## Overview

This package provides spec-driven development capabilities with YAML/Markdown specifications.

## Installation

```bash
pnpm add @spazzatura/spec
```

## Usage

```typescript
import { SpecEngine } from '@spazzatura/spec';

const engine = new SpecEngine();

// Parse a spec file
const spec = await engine.parse(`
id: my-feature
title: My Feature
version: 1.0.0
status: draft
requirements:
  - id: REQ-001
    title: User authentication
    description: Users must be able to authenticate
    severity: must
`, 'yaml');

// Validate the spec
const result = await engine.validate(spec);
if (!result.valid) {
  console.error(result.errors);
}

// Generate code from spec
const code = await engine.generate(spec, 'typescript');
```

## Features

- YAML and Markdown spec formats
- Requirement validation
- Bidirectional sync with code
- Code generation from specs
- Contract testing

## License

MIT
