# @spazzatura/agent

Multi-agent orchestration for Spazzatura.

## Overview

This package provides multi-agent coordination and orchestration capabilities.

## Installation

```bash
pnpm add @spazzatura/agent
```

## Usage

```typescript
import { AgentRegistry, Orchestrator } from '@spazzatura/agent';

// Register agents
const registry = new AgentRegistry();
registry.register(coderAgent);
registry.register(reviewerAgent);
registry.register(testerAgent);

// Orchestrate execution
const orchestrator = new Orchestrator({
  strategy: 'pipeline',
  agents: ['coder', 'reviewer', 'tester'],
});

const result = await orchestrator.execute('Implement a new feature');
```

## Orchestration Strategies

- **Sequential** - One agent at a time
- **Parallel** - Multiple agents together
- **Pipeline** - Output chaining
- **Hierarchical** - Manager-worker pattern

## License

MIT
