# @spazzatura/cli

CLI entry point for Spazzatura.

## Overview

This package provides the command-line interface for Spazzatura.

## Installation

```bash
pnpm add -g @spazzatura/cli
```

## Usage

```bash
# Start interactive chat
spazzatura chat

# Run with a specific skill
spazzatura skill run code-review

# Execute a specification
spazzatura spec exec my-spec.yaml

# List available agents
spazzatura agent list

# Manage MCP servers
spazzatura mcp list
```

## Commands

- `chat` - Start interactive chat session
- `skill` - Manage and run skills
- `agent` - Manage and run agents
- `spec` - Work with specifications
- `mcp` - Manage MCP servers
- `config` - Manage configuration

## License

MIT
