# @spazzatura/core

Core types and utilities for Spazzatura.

## Overview

This package provides the foundational types and utility functions used across all Spazzatura packages.

## Installation

```bash
pnpm add @spazzatura/core
```

## Usage

```typescript
import { 
  // Provider types
  ProviderType,
  ChatMessage,
  IProvider,
  
  // Agent types
  AgentConfig,
  IAgent,
  
  // Skill types
  SkillConfig,
  ISkill,
  
  // Utilities
  Logger,
  createLogger,
  loadConfig,
} from '@spazzatura/core';
```

## Exports

### Types

- `types/provider` - LLM provider types
- `types/agent` - Multi-agent orchestration types
- `types/skill` - Skills system types
- `types/spec` - Specification engine types
- `types/mcp` - MCP integration types

### Utilities

- `utils/logger` - Logging utility
- `utils/config` - Configuration management

## License

MIT
