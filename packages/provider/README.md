# @spazzatura/provider

LLM abstraction layer for Spazzatura.

## Overview

This package provides a unified interface for interacting with multiple LLM providers.

## Supported Providers

- **Free Providers**
  - MiniMax Free
  - Qwen Free
  - GPT4Free-TS
  - GLM Free

- **Commercial Providers**
  - OpenAI
  - Anthropic
  - Custom providers

## Installation

```bash
pnpm add @spazzatura/provider
```

## Usage

```typescript
import { createProvider, ProviderType } from '@spazzatura/provider';

const provider = createProvider({
  type: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4',
});

// Chat completion
const response = await provider.chat([
  { role: 'user', content: 'Hello!' }
]);

// Streaming
for await (const chunk of provider.chatStream(messages)) {
  process.stdout.write(chunk.delta);
}
```

## Features

- Unified API across providers
- Streaming support
- Function calling
- Automatic failover
- Health checking

## License

MIT
