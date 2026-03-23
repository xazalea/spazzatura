/**
 * TUI App — Ink-based terminal interface with TTE effect integration.
 *
 * Architecture:
 *   - Ink handles layout, input, chrome, and spinner while AI response buffers.
 *   - When a full AI response arrives, App calls onTTERequest(response, newState).
 *   - The caller (index.ts) unmounts Ink, plays TTE, then remounts with updated state.
 *   - Error responses trigger onTTEError for the 'unstable' effect.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import { Box, useApp, useInput } from 'ink';
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
import { SettingsOverlay } from './settings-overlay.js';
import type { AvailableProvider } from './settings-overlay.js';
import { StatusBar } from './status-bar.js';
import { Header } from './header.js';

export interface Message {
  readonly role: 'user' | 'assistant' | 'error';
  readonly content: string;
}

export interface SharedState {
  messages: Message[];
  provider?: string;
  model?: string;
  tokens: number;
  ollamaEnabled: boolean;
  latency?: number;
}

export interface AppProps {
  readonly provider?: string;
  readonly model?: string;
  readonly globalOptions?: GlobalOptions;
  // Initial state restored after unmount/remount cycle
  readonly initialState?: Partial<SharedState>;
  // Called when a full AI response is ready — triggers Ink unmount + TTE play
  readonly onTTERequest: (response: string, updatedState: SharedState) => void;
  // Called on AI error — triggers Ink unmount + TTE unstable effect
  readonly onTTEError: (errorMsg: string, updatedState: SharedState) => void;
  // Called when user requests quit
  readonly onExit: () => void;
}

const SPAZ_DIR = join(homedir(), '.spazzatura');
const CONV_DIR = join(SPAZ_DIR, 'conversations');
const AUTH_FILE = join(SPAZ_DIR, 'auth.json');
const SETTINGS_FILE = join(SPAZ_DIR, 'settings.json');

function ensureDirs(): void {
  try {
    if (!existsSync(SPAZ_DIR)) mkdirSync(SPAZ_DIR, { recursive: true });
    if (!existsSync(CONV_DIR)) mkdirSync(CONV_DIR, { recursive: true });
  } catch { /* ignore */ }
}

export function loadSettings(): { ollamaEnabled: boolean } {
  try {
    if (existsSync(SETTINGS_FILE)) {
      return JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')) as { ollamaEnabled: boolean };
    }
  } catch { /* ignore */ }
  return { ollamaEnabled: false };
}

function saveSettings(s: { ollamaEnabled: boolean }): void {
  try { writeFileSync(SETTINGS_FILE, JSON.stringify(s, null, 2)); } catch { /* ignore */ }
}

function loadStoredTokens(): void {
  try {
    if (!existsSync(AUTH_FILE)) return;
    const data = JSON.parse(readFileSync(AUTH_FILE, 'utf-8')) as Record<string, { token?: string; cookie?: string }>;
    const envMap: Record<string, string> = {
      chatglm: 'GLM_FREE_COOKIE',
      qwen: 'QWEN_COOKIE',
      claude: 'CLAUDE_FREE_COOKIE',
      minimax: 'MINIMAX_COOKIE',
      chatgpt: 'CHAT2API_COOKIE',
      gemini: 'GEMINI_COOKIE',
    };
    for (const [service, creds] of Object.entries(data)) {
      const envKey = envMap[service];
      if (envKey && (creds.token ?? creds.cookie)) {
        process.env[envKey] = creds.token ?? creds.cookie ?? '';
      }
    }
  } catch { /* ignore */ }
}

function buildRouter(provider?: string, ollamaEnabled = false): ProviderRouter {
  const available = detectAvailableProviders();
  const filtered = ollamaEnabled ? available : available.filter(p => p.type !== 'ollama');
  const providerConfigs = [];
  for (const p of filtered) {
    if (p.configured || p.free) {
      try { providerConfigs.push(getDefaultProviderConfig(p.type)); } catch { /* skip */ }
    }
  }
  if (provider !== undefined && provider !== 'auto') {
    const idx = providerConfigs.findIndex(p => p.name === provider);
    if (idx > 0) {
      const [prov] = providerConfigs.splice(idx, 1);
      if (prov !== undefined) providerConfigs.unshift(prov);
    }
  }
  try {
    return createRouter(providerConfigs, getDefaultRoutingConfig());
  } catch {
    const safeTypes = ['gpt4free', 'chat2api', 'gpt4free-enhanced', 'freeglm', 'glm-free', 'aiclient', 'webai', 'qwen', 'glm', 'minimax', 'claude-free'];
    const safe = providerConfigs.filter(c => safeTypes.includes(c.type));
    return createRouter(safe.length > 0 ? safe : providerConfigs.slice(0, 1), getDefaultRoutingConfig());
  }
}

function estimateTokens(messages: Message[]): number {
  return Math.round(messages.reduce((acc, m) => acc + m.content.split(/\s+/).filter(Boolean).length, 0) * 1.3);
}

function resolveFileRefs(text: string): string {
  return text.replace(/@([^\s]+)/g, (match, filePath: string) => {
    try {
      if (filePath === '.') {
        const files = execSync('find . -maxdepth 3 -type f \\( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.json" \\) | head -20', { encoding: 'utf-8' });
        return '\n[Directory listing]\n' + files;
      }
      if (existsSync(filePath)) {
        return `\n[File: ${filePath}]\n\`\`\`\n${readFileSync(filePath, 'utf-8')}\n\`\`\`\n`;
      }
    } catch { /* fall through */ }
    return match;
  });
}

async function runBackgroundAuth(onTokenFound: (service: string) => void): Promise<void> {
  const stored = existsSync(AUTH_FILE)
    ? (() => { try { return JSON.parse(readFileSync(AUTH_FILE, 'utf-8')) as Record<string, unknown>; } catch { return {}; } })()
    : {};
  const needsAuth = ['qwen', 'chatglm', 'minimax', 'gemini'].filter(s => !stored[s]);
  if (needsAuth.length === 0) return;
  try {
    const { runAllAuth } = await import('../auth/automator.js');
    await runAllAuth(
      (result) => { if (result.success) onTokenFound(result.service); },
      needsAuth,
    );
  } catch { /* playwright unavailable */ }
}

const SPIN_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const ANIM_PERIOD = 8;

export function App({ provider, model, initialState, onTTERequest, onTTEError, onExit }: AppProps): React.ReactElement {
  const { exit } = useApp();

  const [messages, setMessages] = useState<Message[]>(initialState?.messages ?? []);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [router, setRouter] = useState<ProviderRouter | undefined>(undefined);
  const [tokenCount, setTokenCount] = useState(initialState?.tokens ?? 0);
  const [latency, setLatency] = useState<number | undefined>(initialState?.latency);
  const [activeProvider, setActiveProvider] = useState<string | undefined>(initialState?.provider ?? provider);
  const [activeModel, setActiveModel] = useState<string | undefined>(initialState?.model ?? model);
  const [ollamaEnabled, setOllamaEnabled] = useState(initialState?.ollamaEnabled ?? loadSettings().ollamaEnabled);
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);

  const [animTick, setAnimTick] = useState(0);
  const [spinTick, setSpinTick] = useState(0);
  const [tickerPos, setTickerPos] = useState(0);

  const authRunning = useRef(false);
  const initialized = useRef(false);

  // Single root animation clock
  useEffect(() => {
    const slow = setInterval(() => setAnimTick(t => (t + 1) % ANIM_PERIOD), 500);
    const ticker = setInterval(() => setTickerPos(p => p + 1), 120);
    return () => { clearInterval(slow); clearInterval(ticker); };
  }, []);

  useEffect(() => {
    if (!streaming) return;
    const fast = setInterval(() => setSpinTick(t => (t + 1) % SPIN_CHARS.length), 80);
    return () => clearInterval(fast);
  }, [streaming]);

  const spinChar = SPIN_CHARS[spinTick] ?? '⠋';

  // One-time initialization (skip if state restored from prior cycle)
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    ensureDirs();
    loadStoredTokens();

    const available = detectAvailableProviders();
    setAvailableProviders(available);

    let r: ProviderRouter | undefined;
    try { r = buildRouter(provider, ollamaEnabled); } catch { /* handled below */ }
    if (r !== undefined) {
      setRouter(r);
      if (activeProvider === undefined) {
        const first = available.find(p => (p.configured || p.free) && p.type !== 'ollama');
        if (first) setActiveProvider(first.type);
      }
    }

    if (!authRunning.current) {
      authRunning.current = true;
      void runBackgroundAuth(() => {
        loadStoredTokens();
        try { setRouter(buildRouter(provider, ollamaEnabled)); } catch { /* ignore */ }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTokenCount(estimateTokens(messages));
  }, [messages]);

  useInput((_inputChar, key) => {
    if (key.escape) { setShowSettings(false); return; }
    if (key.ctrl && _inputChar === 'r') { setMessages([]); setTokenCount(0); setLatency(undefined); return; }
    if (key.ctrl && _inputChar === 'c') { exit(); onExit(); return; }
  });

  const handleInputChange = useCallback((value: string) => {
    if (value === '/') { setShowSettings(true); return; }
    setInput(value);
  }, []);

  const handleSelectModel = useCallback((prov: string, mdl: string) => {
    setActiveProvider(prov);
    setActiveModel(mdl);
    setShowSettings(false);
  }, []);

  const handleToggleOllama = useCallback(() => {
    const next = !ollamaEnabled;
    setOllamaEnabled(next);
    saveSettings({ ollamaEnabled: next });
  }, [ollamaEnabled]);

  const handleSend = useCallback(async (value: string) => {
    const trimmed = value.trim();
    setInput('');
    if (!trimmed) return;

    if (trimmed === '/exit' || trimmed === '/quit' || trimmed === '/q') { exit(); onExit(); return; }
    if (trimmed === '/clear') { setMessages([]); setTokenCount(0); return; }
    if (trimmed === '/settings') { setShowSettings(true); return; }

    if (trimmed.startsWith('/save')) {
      const name = trimmed.slice(5).trim() || ('conv_' + Date.now());
      try {
        const path = join(CONV_DIR, name + '.json');
        writeFileSync(path, JSON.stringify(messages, null, 2));
        setMessages(prev => [...prev, { role: 'assistant', content: `✓ Saved to ${path}` }]);
      } catch (e) {
        setMessages(prev => [...prev, { role: 'error', content: 'Save failed: ' + String(e) }]);
      }
      return;
    }

    if (trimmed.startsWith('/load ')) {
      const name = trimmed.slice(6).trim();
      try {
        const path = join(CONV_DIR, name + (name.endsWith('.json') ? '' : '.json'));
        const data = JSON.parse(readFileSync(path, 'utf-8')) as Message[];
        setMessages([...data, { role: 'assistant', content: `✓ Loaded ${data.length} messages` }]);
      } catch (e) {
        setMessages(prev => [...prev, { role: 'error', content: 'Load failed: ' + String(e) }]);
      }
      return;
    }

    if (trimmed.startsWith('/run ')) {
      const cmd = trimmed.slice(5).trim();
      try {
        const out = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
        const bar = '─'.repeat(48);
        setMessages(prev => [...prev, { role: 'assistant', content: `┌─ ${cmd} ─${bar.slice(cmd.length + 2)}\n${out.trim()}\n└${bar}` }]);
      } catch (e: unknown) {
        const err = e as { stderr?: string; message?: string };
        setMessages(prev => [...prev, { role: 'error', content: 'Command failed: ' + (err.stderr ?? err.message ?? String(e)) }]);
      }
      return;
    }

    if (router === undefined) {
      setMessages(prev => [...prev, { role: 'error', content: 'Router not ready. Please wait a moment.' }]);
      return;
    }

    const resolved = resolveFileRefs(trimmed);
    const userMsg: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStreaming(true);

    const provMsgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: 'You are Spazzatura, an elite AI coding assistant. Be concise, accurate, and practical. Format code in markdown code blocks.' },
      ...messages.filter(m => m.role !== 'error').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: resolved },
    ];

    let content = '';
    const t0 = Date.now();

    try {
      const opts = { ...(activeModel !== undefined ? { model: activeModel } : {}) };
      for await (const chunk of router.stream(provMsgs, opts)) {
        if (chunk.delta) content += chunk.delta;
        if (chunk.done) break;
      }

      const elapsed = Date.now() - t0;
      setStreaming(false);

      const aiMsg: Message = { role: 'assistant', content };
      const finalMessages = [...newMessages, aiMsg];

      const updatedState: SharedState = {
        messages: finalMessages,
        provider: activeProvider,
        model: activeModel,
        tokens: estimateTokens(finalMessages),
        ollamaEnabled,
        latency: elapsed,
      };

      // Hand off to caller — Ink will unmount, TTE plays, then Ink remounts
      onTTERequest(content, updatedState);

    } catch (err) {
      setStreaming(false);
      const msg = err instanceof Error ? err.message : String(err);
      const errMsg: Message = {
        role: 'error',
        content: `◈ Provider error: ${msg}\n\n→ Run [/] settings to switch models\n→ Run \`spaz auth\` to authenticate providers`,
      };
      const errorMessages = [...newMessages, errMsg];

      const updatedState: SharedState = {
        messages: errorMessages,
        provider: activeProvider,
        model: activeModel,
        tokens: estimateTokens(errorMessages),
        ollamaEnabled,
        latency: undefined,
      };

      onTTEError(msg, updatedState);
    }
  }, [router, activeModel, activeProvider, ollamaEnabled, messages, exit, onTTERequest, onTTEError, onExit]);

  const handleSendSync = useCallback((v: string) => { void handleSend(v); }, [handleSend]);

  const termRows = process.stdout.rows ?? 24;

  return (
    <Box flexDirection="column" height={termRows}>
      <Header
        streaming={streaming}
        providerLabel={activeProvider}
        animTick={animTick}
        tickerPos={tickerPos}
        spinChar={spinChar}
      />

      <Box flexDirection="column" flexGrow={1}>
        {showSettings ? (
          <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
            <SettingsOverlay
              onClose={() => setShowSettings(false)}
              activeModel={activeModel}
              activeProvider={activeProvider}
              onSelectModel={handleSelectModel}
              ollamaEnabled={ollamaEnabled}
              onToggleOllama={handleToggleOllama}
              availableProviders={availableProviders}
              animTick={animTick}
            />
          </Box>
        ) : (
          <ChatView
            messages={messages}
            streaming={streaming}
            input={input}
            onChangeInput={handleInputChange}
            onSend={handleSendSync}
            spinChar={spinChar}
            {...(activeModel !== undefined ? { model: activeModel } : {})}
          />
        )}
      </Box>

      <StatusBar
        {...(activeProvider !== undefined ? { provider: activeProvider } : {})}
        {...(activeModel !== undefined ? { model: activeModel } : {})}
        {...(tokenCount > 0 ? { tokens: tokenCount } : {})}
        {...(latency !== undefined ? { latency } : {})}
        messageCount={messages.filter(m => m.role !== 'error').length}
        animTick={animTick}
      />
    </Box>
  );
}
