# @spazzatura/mcp

MCP (Model Context Protocol) integration for Spazzatura.

## Overview

This package provides integration with the Model Context Protocol for extended tool capabilities.

## Installation

```bash
pnpm add @spazzatura/mcp
```

## Usage

```typescript
import { MCPManager } from '@spazzatura/mcp';

const manager = new MCPManager();

// Connect to an MCP server
await manager.connect({
  id: 'filesystem',
  name: 'Filesystem Server',
  transport: 'stdio',
  command: 'mcp-server-filesystem',
  args: ['--root', '/path/to/project'],
});

// List available tools
const status = manager.getStatus('filesystem');
console.log(status.tools);

// Call a tool
const result = await manager.callTool({
  serverId: 'filesystem',
  toolName: 'read_file',
  arguments: { path: 'src/index.ts' },
});

// Read a resource
const resource = await manager.readResource({
  serverId: 'filesystem',
  uri: 'file:///path/to/file.txt',
});
```

## Features

- Multiple transport types (stdio, HTTP, WebSocket)
- Tool discovery and execution
- Resource management
- Prompt templates
- Health monitoring

## License

MIT
