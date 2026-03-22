/**
 * TUI App — multi-pane animated Ink/React terminal interface for Spazzatura.
 */

import React, { useState, useCallback, useEffect } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import { readFileSync, existsSync, mkdirSync, writeFileSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import { execSync } from 'child_process';
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
import { Header } from './header.js';
import { Sidebar } from './sidebar.js';
import type { ProviderStatus } from './sidebar.js';

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

const SPAZ_DIR = join(homedir(), '.spazzatura');
const CONV_DIR = join(SPAZ_DIR, 'conversations');
const AUTH_FILE = join(SPAZ_DIR, 'auth.json');

function ensureDirs(): void {
  try {
    if (!existsSync(SPAZ_DIR)) mkdirSync(SPAZ_DIR, { recursive: true });
    if (!existsSync(CONV_DIR)) mkdirSync(CONV_DIR, { recursive: true });
  } catch { /* ignore */ }
}

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

function estimateTokens(messages: Message[]): number {
  const words = messages.reduce((acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length, 0);
  return Math.round(words * 1.3);
}

/**
 * Resolve @filename references in a message, injecting file contents.
 */
function resolveFileRefs(text: string): string {
  return text.replace(/@([^\s]+)/g, (match, filePath: string) => {
    try {
      if (filePath === '.') {
        // @. = list files in cwd
        const files = execSync('find . -type f -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" | head -20', { encoding: 'utf-8' });
        return '\n[Directory listing]\n' + files;
      }
      if (existsSync(filePath)) {
        const content = readFileSync(filePath, 'utf-8');
        return `\n[File: ${filePath}]\n\`\`\`\n${content}\n\`\`\`\n`;
      }
    } catch { /* fall through */ }
    return match;
  });
}

/** Build provider status list for sidebar */
function buildProviderStatuses(router: ProviderRouter): ProviderStatus[] {
  const { providers } = router.getStatus();
  return providers.map(p => ({
    name: p.name,
    online: p.available,
  }));
}

/** Load stored auth tokens into env */
function loadStoredTokens(): void {
  try {
    if (!existsSync(AUTH_FILE)) return;
    const data = JSON.parse(readFileSync(AUTH_FILE, 'utf-8')) as Record<string, { token?: string; cookie?: string }>;
    const envMap: Record<string, string> = {
      'chatglm': 'GLM_FREE_COOKIE',
      'qwen': 'QWEN_COOKIE',
      'claude': 'CLAUDE_FREE_COOKIE',
      'minimax': 'MINIMAX_COOKIE',
      'chatgpt': 'CHAT2API_COOKIE',
    };
    for (const [service, creds] of Object.entries(data)) {
      const envKey = envMap[service];
      if (envKey && (creds.token ?? creds.cookie)) {
        process.env[envKey] = creds.token ?? creds.cookie ?? '';
      }
    }
  } catch { /* ignore */ }
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
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>([]);

  const termCols = process.stdout.columns ?? 80;
  const showSidebar = termCols > 110;

  useEffect(() => {
    ensureDirs();
    loadStoredTokens();
    const available = detectAvailableProviders();
    const r = buildRouter(provider);
    setRouter(r);
    const configured = available.filter(p => p.configured || p.free);
    setActiveProvider(provider ?? configured[0]?.type ?? 'auto');

    // Build initial provider statuses
    setProviderStatuses(buildProviderStatuses(r));
  }, [provider]);

  useEffect(() => {
    setTokenCount(estimateTokens(messages));
  }, [messages]);

  useInput((inputChar, key) => {
    if (key.escape) {
      if (layout === 'help') setLayout('chat');
      return;
    }
    if (inputChar === '?' && layout !== 'help') { setLayout('help'); return; }
    if (inputChar === '?' && layout === 'help') { setLayout('chat'); return; }
    if (key.ctrl && inputChar === 'r') {
      setMessages([]);
      setTokenCount(0);
      setLatency(undefined);
      return;
    }
    if (key.ctrl && inputChar === 'c') { exit(); return; }
  });

  const handleSend = useCallback(async (value: string) => {
    const trimmed = value.trim();
    setInput('');
    if (!trimmed) return;

    // ── Special commands ──────────────────────────────────────────────────────
    if (trimmed === '/exit' || trimmed === '/quit' || trimmed === '/q') { exit(); return; }
    if (trimmed === '/clear') { setMessages([]); setTokenCount(0); return; }
    if (trimmed === '/help') { setLayout('help'); return; }
    if (trimmed === '/auth') {
      setMessages(prev => [...prev, { role: 'assistant', content: 'Re-authentication: run `spaz auth` in a separate terminal to refresh tokens.' }]);
      return;
    }

    // /save [name]
    if (trimmed.startsWith('/save')) {
      const name = trimmed.slice(5).trim() || ('conv_' + Date.now());
      try {
        const path = join(CONV_DIR, name + '.json');
        writeFileSync(path, JSON.stringify(messages, null, 2));
        setMessages(prev => [...prev, { role: 'assistant', content: `Conversation saved to ${path}` }]);
      } catch (e) {
        setMessages(prev => [...prev, { role: 'error', content: 'Failed to save: ' + String(e) }]);
      }
      return;
    }

    // /load <name>
    if (trimmed.startsWith('/load ')) {
      const name = trimmed.slice(6).trim();
      try {
        const path = join(CONV_DIR, name + (name.endsWith('.json') ? '' : '.json'));
        const data = JSON.parse(readFileSync(path, 'utf-8')) as Message[];
        setMessages(data);
        setMessages(prev => [...prev, { role: 'assistant', content: `Loaded ${data.length} messages from ${path}` }]);
      } catch (e) {
        setMessages(prev => [...prev, { role: 'error', content: 'Failed to load: ' + String(e) }]);
      }
      return;
    }

    // /run <cmd>
    if (trimmed.startsWith('/run ')) {
      const cmd = trimmed.slice(5).trim();
      try {
        const output = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
        const boxed = `┌─ shell: ${cmd} ${'─'.repeat(Math.max(0, 40 - cmd.length))}┐\n${output.trim()}\n└${'─'.repeat(50)}┘`;
        setMessages(prev => [...prev, { role: 'assistant', content: boxed }]);
      } catch (e: unknown) {
        const err = e as { message?: string; stdout?: string; stderr?: string };
        setMessages(prev => [...prev, { role: 'error', content: 'Command failed: ' + (err.stderr ?? err.message ?? String(e)) }]);
      }
      return;
    }

    if (router === undefined) {
      setMessages(prev => [...prev, { role: 'error', content: 'Router not initialized. Please wait a moment.' }]);
      return;
    }

    // ── Resolve @file references ───────────────────────────────────────────
    const resolvedContent = resolveFileRefs(trimmed);
    const userMessage: Message = { role: 'user', content: trimmed };
    setMessages(prev => [...prev, userMessage]);
    setStreaming(true);

    const providerMessages: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      {
        role: 'system',
        content: 'You are Spazzatura, an elite AI coding assistant. You have access to file context when provided. Be concise, accurate, and practical. Format code with markdown code blocks.',
      },
      ...messages.filter(m => m.role !== 'error').map(m => ({
        role: m.role as 'user' | 'assistant',
        content: m.content,
      })),
      { role: 'user', content: resolvedContent },
    ];

    let assistantContent = '';
    const startTime = Date.now();
    setMessages(prev => [...prev, { role: 'assistant', content: '...' }]);

    try {
      const chatOpts = { ...(model !== undefined ? { model } : {}) };

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
          content: 'Error:\n' + msg + '\n\nTip: Run `spaz auth` to set up provider tokens, or set ANTHROPIC_API_KEY / OPENAI_API_KEY / OPENROUTER_API_KEY',
        },
      ]);
    } finally {
      setStreaming(false);
    }
  }, [router, provider, model, messages, exit]);

  const handleSendSync = useCallback((value: string) => { void handleSend(value); }, [handleSend]);
  const handleCloseHelp = useCallback(() => { setLayout('chat'); }, []);

  const termRows = process.stdout.rows ?? 24;

  return (
    <Box flexDirection="column" height={termRows}>
      {/* Animated ASCII header */}
      <Header streaming={streaming} providerLabel={activeProvider} />

      {/* Main content */}
      <Box flexDirection="row" flexGrow={1}>
        {/* Sidebar — only when terminal is wide */}
        {showSidebar && (
          <Sidebar
            providers={providerStatuses}
            tokens={tokenCount}
            activeModel={model}
            activeProvider={activeProvider}
            messageCount={messages.filter(m => m.role !== 'error').length}
          />
        )}

        {/* Chat or help overlay */}
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
      </Box>

      {/* Status bar */}
      <StatusBar
        {...(activeProvider !== undefined ? { provider: activeProvider } : {})}
        {...(model !== undefined ? { model } : {})}
        {...(tokenCount > 0 ? { tokens: tokenCount } : {})}
        {...(latency !== undefined ? { latency } : {})}
        layout={layout}
        messageCount={messages.filter(m => m.role !== 'error').length}
      />
    </Box>
  );
}
