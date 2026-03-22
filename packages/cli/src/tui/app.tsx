/**
 * TUI App — multi-pane ink-based React terminal interface for Spazzatura.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import {
  createRouter,
  getDefaultRoutingConfig,
  getDefaultProviderConfig,
  detectAvailableProviders,
} from '@spazzatura/provider';
import type { ProviderRouter } from '@spazzatura/provider';
import type { GlobalOptions } from '../index.js';
import { ChatView } from './chat-view.js';
import { HelpOverlay } from './help-overlay.js';
import { StatusBar } from './status-bar.js';

export interface Message {
  readonly role: 'user' | 'assistant' | 'error';
  readonly content: string;
}

export interface AppProps {
  readonly provider?: string;
  readonly model?: string;
  readonly globalOptions: GlobalOptions;
}

type Layout = 'chat' | 'help';

function buildRouter(provider?: string): ProviderRouter {
  const available = detectAvailableProviders();
  const providerConfigs = [];

  for (const p of available) {
    if (p.configured || p.free) {
      try {
        providerConfigs.push(getDefaultProviderConfig(p.type));
      } catch { /* skip */ }
    }
  }

  if (provider !== undefined && provider !== 'auto') {
    const idx = providerConfigs.findIndex(p => p.name === provider);
    if (idx > 0) {
      const [prov] = providerConfigs.splice(idx, 1);
      if (prov !== undefined) providerConfigs.unshift(prov);
    }
  }

  return createRouter(providerConfigs, getDefaultRoutingConfig());
}

/** Rough token count estimate: words * 1.3 */
function estimateTokens(messages: Message[]): number {
  const wordCount = messages.reduce((acc, m) => {
    return acc + m.content.split(/\s+/).filter(Boolean).length;
  }, 0);
  return Math.round(wordCount * 1.3);
}

export function App({ provider, model, globalOptions: _globalOptions }: AppProps): React.ReactElement {
  const { exit } = useApp();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [layout, setLayout] = useState<Layout>('chat');
  const [router, setRouter] = useState<ProviderRouter | undefined>(undefined);
  const [tokenCount, setTokenCount] = useState(0);
  const [latency, setLatency] = useState<number | undefined>(undefined);
  const [activeProvider, setActiveProvider] = useState<string | undefined>(provider);

  useEffect(() => {
    const available = detectAvailableProviders();
    const r = buildRouter(provider);
    setRouter(r);
    const configured = available.filter(p => p.configured || p.free);
    const providerLabel = provider ?? configured[0]?.type ?? 'auto';
    setActiveProvider(providerLabel);
  }, [provider]);

  useEffect(() => {
    setTokenCount(estimateTokens(messages));
  }, [messages]);

  // Global key handling
  useInput((inputChar, key) => {
    // Don't intercept keys when streaming and in normal input mode
    if (key.escape) {
      if (layout === 'help') setLayout('chat');
      return;
    }

    if (inputChar === '?' && layout !== 'help') {
      setLayout('help');
      return;
    }

    if (inputChar === '?' && layout === 'help') {
      setLayout('chat');
      return;
    }

    if (key.ctrl && inputChar === 'l') {
      // Simple cycle: chat <-> chat (only two relevant layouts)
      setLayout(prev => prev === 'help' ? 'chat' : 'chat');
      return;
    }

    if (key.ctrl && inputChar === 'r') {
      setMessages([]);
      setTokenCount(0);
      setLatency(undefined);
      return;
    }

    if (key.ctrl && inputChar === 'c') {
      exit();
      return;
    }

    // 'q' only quits when not typing in the input (we can't detect focus cleanly in ink,
    // so we skip this shortcut to avoid intercepting typed 'q' chars)
  });

  const handleSend = useCallback(async (value: string) => {
    const trimmed = value.trim();
    setInput('');

    if (!trimmed) return;

    // Special commands
    if (trimmed === '/exit' || trimmed === '/quit' || trimmed === '/q') {
      exit();
      return;
    }

    if (trimmed === '/clear') {
      setMessages([]);
      setTokenCount(0);
      return;
    }

    if (trimmed === '/help') {
      setLayout('help');
      return;
    }

    if (router === undefined) {
      setMessages(prev => [...prev, {
        role: 'error',
        content: 'Router not initialized. Please wait a moment.',
      }]);
      return;
    }

    const userMessage: Message = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setStreaming(true);

    const providerMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: 'You are Spazzatura, an expert AI coding assistant. Be concise, accurate, and practical.',
      },
      ...messages.filter(m => m.role !== 'error').map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: trimmed },
    ];

    let assistantContent = '';
    const startTime = Date.now();
    setMessages(prev => [...prev, { role: 'assistant', content: '...' }]);

    try {
      const chatOpts = {
        ...(model !== undefined ? { model } : {}),
      };

      for await (const chunk of router.stream(providerMessages, chatOpts)) {
        if (chunk.delta) {
          assistantContent += chunk.delta;
          setMessages(prev => [
            ...prev.slice(0, -1),
            { role: 'assistant', content: assistantContent },
          ]);
        }
        if (chunk.done) break;
      }

      setLatency(Date.now() - startTime);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'error',
          content: 'Error: ' + msg + '\n\nTip: Set ANTHROPIC_API_KEY, OPENAI_API_KEY, or OPENROUTER_API_KEY',
        },
      ]);
    } finally {
      setStreaming(false);
    }
  }, [router, provider, model, messages, exit]);

  const handleSendSync = useCallback((value: string) => {
    void handleSend(value);
  }, [handleSend]);

  const handleCloseHelp = useCallback(() => {
    setLayout('chat');
  }, []);

  const termRows = process.stdout.rows ?? 24;

  return (
    <Box flexDirection="column" height={termRows}>
      {/* Header */}
      <Box borderStyle="single" paddingX={1}>
        <Text bold color="cyan">{'🗑️  Spazzatura'}</Text>
        {streaming && <Text dimColor>{'  ● streaming...'}</Text>}
      </Box>

      {/* Main content area */}
      <Box flexDirection="column" flexGrow={1}>
        {layout === 'help' ? (
          <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
            <HelpOverlay onClose={handleCloseHelp} />
          </Box>
        ) : (
          <ChatView
            messages={messages}
            streaming={streaming}
            input={input}
            onChangeInput={setInput}
            onSend={handleSendSync}
            {...(provider !== undefined ? { provider } : {})}
            {...(model !== undefined ? { model } : {})}
          />
        )}
      </Box>

      {/* Status bar */}
      <StatusBar
        {...(activeProvider !== undefined ? { provider: activeProvider } : {})}
        {...(model !== undefined ? { model } : {})}
        {...(tokenCount > 0 ? { tokens: tokenCount } : {})}
        {...(latency !== undefined ? { latency } : {})}
        layout={layout}
      />
    </Box>
  );
}
