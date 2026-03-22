# Spazzatura

A unified CLI coding tool combining the best features from Codebuff, Oh-My-OpenAgent, Claude Code, Superpowers, and OpenSpec.

## Overview

Spazzatura is a comprehensive CLI coding tool that provides:

- **Unified Interface** - Single CLI entry point with intuitive subcommands
- **Provider Agnostic** - Seamless failover between LLM providers
- **Extensible Architecture** - Plugin-based skills, agents, and tools
- **Spec-Driven** - Optional specification-first development workflow
- **Zero Cost by Default** - Integrated free LLM provider support

## Features

### From Codebuff
- Streaming responses
- Undo/redo functionality
- Template system
- Lightweight design

### From Oh-My-OpenAgent
- Multi-agent orchestration
- Tool integration
- Agent marketplace
- Visual workflow builder
- Evaluation framework

### From Claude Code
- MCP (Model Context Protocol) support
- Extended thinking
- Tool use
- Artifact generation

### From Superpowers
- Modular skills system
- Skill marketplace
- Parallel review
- Mode switching

### From OpenSpec
- YAML/Markdown specs
- Bidirectional sync
- Contract testing

## Installation

```bash
# Install globally
pnpm install -g spazzatura

# Or use with npx
npx spazzatura
```

## Quick Start

```bash
# Start interactive chat
spazzatura chat

# Run with a specific skill
spazzatura skill run code-review

# Execute a specification
spazzatura spec exec my-spec.yaml

# List available agents
spazzatura agent list
```

## Project Structure

```
spazzatura/
├── packages/
│   ├── cli/           # CLI entry point
│   ├── core/          # Shared types and utilities
│   ├── provider/      # LLM abstraction layer
│   ├── agent/         # Multi-agent orchestration
│   ├── skill/         # Skills system
│   ├── spec/          # Specification engine
│   ├── mcp/           # MCP integration
│   ├── template/      # Template engine
│   └── artifacts/     # Output management
├── docs/              # Documentation
├── examples/          # Example configs and skills
├── templates/         # Built-in templates
├── skills/            # Built-in skills
└── specs/             # Example specifications
```

## Development

```bash
# Install dependencies
pnpm install

# Build all packages
pnpm build

# Run tests
pnpm test

# Run linter
pnpm lint

# Type check
pnpm typecheck
```

## Requirements

- Node.js 18+
- pnpm 9+

## License

MIT License - see [LICENSE](LICENSE) for details.

## Contributing

Contributions are welcome! Please read our contributing guidelines before submitting PRs.

## Status

🚧 **In Development** - This project is currently in the design phase.
