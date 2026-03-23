/**
 * TUI App — Ink-based terminal interface with TTE effect integration.
 *
 * Architecture:
 *   - Phase 'booting': runs auth, shows BootScreen with live per-provider status.
 *   - Phase 'ready': shows chat UI with animated Header.
 *   - Ink handles layout, input, chrome, and spinner while AI response buffers.
 *   - When a full AI response arrives, App calls onTTERequest(response, newState).
 *   - The caller (index.ts) unmounts Ink, plays TTE, then remounts with updated state.
 *   - Error responses trigger onTTEError for the 'unstable' TTE effect.
 *   - "local" = Ollama; used only for non-critical/conversational tasks.
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
import { ModelPicker } from './model-picker.js';
import { Header } from './header.js';
import { BootScreen } from './boot-screen.js';
import type { ProviderStatus } from './boot-screen.js';
import type { AvailableProvider } from './settings-overlay.js';

export interface Message {
  readonly role: 'user' | 'assistant' | 'error';
  readonly content: string;
}

export interface SharedState {
  messages: Message[];
  provider?: string;
  model?: string;
  tokens: number;
  localEnabled: boolean;
  latency?: number;
}

export interface AppProps {
  readonly provider?: string;
  readonly model?: string;
  readonly globalOptions?: GlobalOptions;
  readonly initialState?: Partial<SharedState>;
  readonly onTTERequest: (response: string, updatedState: SharedState) => void;
  readonly onTTEError: (errorMsg: string, updatedState: SharedState) => void;
  readonly onExit: () => void;
}

// ── Paths ─────────────────────────────────────────────────────────────────────

const SPAZ_DIR   = join(homedir(), '.spazzatura');
const CONV_DIR   = join(SPAZ_DIR, 'conversations');
const AUTH_FILE  = join(SPAZ_DIR, 'auth.json');
const SETTINGS_FILE = join(SPAZ_DIR, 'settings.json');

function ensureDirs(): void {
  try {
    if (!existsSync(SPAZ_DIR)) mkdirSync(SPAZ_DIR, { recursive: true });
    if (!existsSync(CONV_DIR)) mkdirSync(CONV_DIR, { recursive: true });
  } catch { /* ignore */ }
}

export function loadSettings(): { localEnabled: boolean } {
  try {
    if (existsSync(SETTINGS_FILE)) {
      const raw = JSON.parse(readFileSync(SETTINGS_FILE, 'utf-8')) as Record<string, unknown>;
      return { localEnabled: !!(raw['localEnabled'] ?? raw['ollamaEnabled']) };
    }
  } catch { /* ignore */ }
  return { localEnabled: false };
}

function saveSettings(s: { localEnabled: boolean }): void {
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

// ── Provider/router helpers ───────────────────────────────────────────────────

/**
 * Build router synchronously — native providers don't need health checks.
 * All providers that have their cookie set are included immediately.
 */
interface RouterResult {
  router: ProviderRouter;
  firstType: string;
  firstModel: string;
}

function buildRouter(preferredProvider?: string, localEnabled = false): RouterResult | null {
  const available = detectAvailableProviders();
  const filtered = available.filter(p => p.configured && (localEnabled || p.type !== 'ollama'));

  const providerConfigs = [];
  for (const p of filtered) {
    try { providerConfigs.push(getDefaultProviderConfig(p.type)); } catch { /* skip */ }
  }

  // Prioritize explicitly chosen provider
  if (preferredProvider !== undefined && preferredProvider !== 'auto') {
    const idx = providerConfigs.findIndex(p => p.name === preferredProvider);
    if (idx > 0) {
      const [prov] = providerConfigs.splice(idx, 1);
      if (prov !== undefined) providerConfigs.unshift(prov);
    }
  }

  if (providerConfigs.length === 0) return null;

  const first = providerConfigs[0]!;
  return {
    router: createRouter(providerConfigs, getDefaultRoutingConfig()),
    firstType: first.type ?? first.name ?? 'unknown',
    firstModel: first.defaultModel ?? first.models?.[0] ?? 'default',
  };
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

// ── Local (Ollama) auto-start ─────────────────────────────────────────────────

async function startOllamaIfNeeded(): Promise<void> {
  try {
    const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1000) });
    if (r.ok) return;
  } catch { /* not running */ }
  try {
    const { spawn } = await import('child_process');
    const proc = spawn('ollama', ['serve'], { stdio: 'ignore', detached: true });
    proc.unref();
  } catch { /* ollama not installed */ }
}

// ── Animation constants ───────────────────────────────────────────────────────

const SPIN_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const ANIM_PERIOD = 8;

// ── Boot providers config ─────────────────────────────────────────────────────

const BOOT_PROVIDERS: ProviderStatus[] = [
  { service: 'qwen',    label: 'Qwen (Tongyi)',     state: 'pending' },
  { service: 'chatglm', label: 'ChatGLM (Zhipu)',   state: 'pending' },
  { service: 'minimax', label: 'MiniMax (Hailuo)',  state: 'pending' },
  { service: 'gemini',  label: 'Gemini (Google)',   state: 'pending' },
  { service: 'claude',  label: 'Claude (Anthropic)', state: 'pending' },
];

// ── Main App Component ────────────────────────────────────────────────────────

export function App({ provider, model, initialState, onTTERequest, onTTEError, onExit }: AppProps): React.ReactElement {
  const { exit } = useApp();

  // Phase: booting = auth screen, ready = chat UI
  const [phase,          setPhase]          = useState<'booting' | 'ready'>('booting');
  const [providerStatuses, setProviderStatuses] = useState<ProviderStatus[]>(BOOT_PROVIDERS);

  const [messages,       setMessages]       = useState<Message[]>(initialState?.messages ?? []);
  const [input,          setInput]          = useState('');
  const [streaming,      setStreaming]       = useState(false);
  const [showPicker,     setShowPicker]      = useState(false);
  const [router,         setRouter]         = useState<ProviderRouter | undefined>(undefined);
  const [tokenCount,     setTokenCount]     = useState(initialState?.tokens ?? 0);
  const [latency,        setLatency]        = useState<number | undefined>(initialState?.latency);
  const [activeProvider, setActiveProvider] = useState<string | undefined>(initialState?.provider ?? provider);
  const [activeModel,    setActiveModel]    = useState<string | undefined>(initialState?.model ?? model);
  const [localEnabled,   setLocalEnabled]   = useState(initialState?.localEnabled ?? loadSettings().localEnabled);
  const [localReady,     setLocalReady]     = useState(false);
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);

  const [animTick,  setAnimTick]  = useState(0);
  const [spinTick,  setSpinTick]  = useState(0);
  const [tickerPos, setTickerPos] = useState(0);

  const initialized = useRef(false);

  // Single root animation clock
  useEffect(() => {
    const slow   = setInterval(() => setAnimTick(t => (t + 1) % ANIM_PERIOD), 500);
    const ticker = setInterval(() => setTickerPos(p => p + 1), 130);
    return () => { clearInterval(slow); clearInterval(ticker); };
  }, []);

  useEffect(() => {
    if (!streaming) return;
    const fast = setInterval(() => setSpinTick(t => (t + 1) % SPIN_CHARS.length), 80);
    return () => clearInterval(fast);
  }, [streaming]);

  const spinChar = SPIN_CHARS[spinTick] ?? '⠋';

  // One-time initialization — run auth then transition to ready
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    ensureDirs();
    loadStoredTokens();

    const available = detectAvailableProviders();
    setAvailableProviders(available);

    // Start Ollama in background
    void startOllamaIfNeeded().then(() => setLocalReady(true)).catch(() => {});

    // Run auth with per-provider callbacks, then transition to ready
    void (async () => {
      try {
        const { runAllAuth } = await import('../auth/automator.js');
        await runAllAuth(
          (result) => {
            if (result.success) loadStoredTokens(); // update env vars as each completes
            setProviderStatuses(prev => prev.map(p =>
              p.service === result.service
                ? { ...p, state: result.success ? 'ready' : 'failed' }
                : p
            ));
          },
          ['qwen', 'chatglm', 'minimax', 'gemini', 'claude'],
          (service) => {
            setProviderStatuses(prev => prev.map(p =>
              p.service === service ? { ...p, state: 'running' } : p
            ));
          },
        );
      } catch { /* playwright unavailable — proceed anyway */ }

      // Auth done — reload tokens and build router
      loadStoredTokens();
      const result = buildRouter(provider, localEnabled);
      if (result) {
        setRouter(result.router);
        if (activeProvider === undefined) setActiveProvider(result.firstType);
        if (activeModel === undefined) setActiveModel(result.firstModel);
      }
      setPhase('ready');
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTokenCount(estimateTokens(messages));
  }, [messages]);

  // ── Key bindings ─────────────────────────────────────────────────────────
  useInput((_inputChar, key) => {
    if (phase === 'booting') {
      if (key.ctrl && _inputChar === 'c') { exit(); onExit(); }
      return;
    }
    if (showPicker) return;
    if (key.escape) return;
    if (key.tab) { setShowPicker(true); return; }
    if (key.ctrl && _inputChar === 'r') { setMessages([]); setTokenCount(0); setLatency(undefined); return; }
    if (key.ctrl && _inputChar === 'l') {
      const next = !localEnabled;
      setLocalEnabled(next);
      saveSettings({ localEnabled: next });
      return;
    }
    if (key.ctrl && _inputChar === 'c') { exit(); onExit(); return; }
  });

  // ── Model selection ───────────────────────────────────────────────────────
  const handleSelectModel = useCallback((prov: string, mdl: string) => {
    setActiveProvider(prov);
    setActiveModel(mdl);
    setShowPicker(false);
    const result = buildRouter(prov, localEnabled);
    if (result) setRouter(result.router);
  }, [localEnabled]);

  const handleToggleLocal = useCallback(() => {
    const next = !localEnabled;
    setLocalEnabled(next);
    saveSettings({ localEnabled: next });
  }, [localEnabled]);

  // ── Input handling ────────────────────────────────────────────────────────
  const handleInputChange = useCallback((value: string) => {
    setInput(value);
  }, []);

  const handleSend = useCallback(async (value: string) => {
    const trimmed = value.trim();
    setInput('');
    if (!trimmed) return;

    // Commands
    if (trimmed === '/exit' || trimmed === '/quit' || trimmed === '/q') { exit(); onExit(); return; }
    if (trimmed === '/clear') { setMessages([]); setTokenCount(0); return; }
    if (trimmed === '/models' || trimmed === '/switch') { setShowPicker(true); return; }
    if (trimmed === '/local' || trimmed === '/ollama') {
      const next = !localEnabled;
      setLocalEnabled(next);
      saveSettings({ localEnabled: next });
      setMessages(prev => [...prev, { role: 'assistant', content: `local inference: ${next ? 'enabled ✓' : 'disabled'}` }]);
      return;
    }

    if (trimmed.startsWith('/save')) {
      const name = trimmed.slice(5).trim() || ('conv_' + Date.now());
      try {
        const path = join(CONV_DIR, name + '.json');
        writeFileSync(path, JSON.stringify(messages, null, 2));
        setMessages(prev => [...prev, { role: 'assistant', content: `✓ saved → ${path}` }]);
      } catch (e) {
        setMessages(prev => [...prev, { role: 'error', content: 'save failed: ' + String(e) }]);
      }
      return;
    }

    if (trimmed.startsWith('/load ')) {
      const name = trimmed.slice(6).trim();
      try {
        const path = join(CONV_DIR, name + (name.endsWith('.json') ? '' : '.json'));
        const data = JSON.parse(readFileSync(path, 'utf-8')) as Message[];
        setMessages([...data, { role: 'assistant', content: `✓ loaded ${data.length} messages` }]);
      } catch (e) {
        setMessages(prev => [...prev, { role: 'error', content: 'load failed: ' + String(e) }]);
      }
      return;
    }

    if (trimmed.startsWith('/run ')) {
      const cmd = trimmed.slice(5).trim();
      try {
        const out = execSync(cmd, { encoding: 'utf-8', timeout: 30000 });
        setMessages(prev => [...prev, { role: 'assistant', content: `$ ${cmd}\n\n${out.trim()}` }]);
      } catch (e: unknown) {
        const err = e as { stderr?: string; message?: string };
        setMessages(prev => [...prev, { role: 'error', content: 'command failed: ' + (err.stderr ?? err.message ?? String(e)) }]);
      }
      return;
    }

    if (router === undefined) {
      setMessages(prev => [...prev, { role: 'error', content: 'router not ready — auth is still running or no providers configured' }]);
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
      const opts = activeModel !== undefined ? { model: activeModel } : {};
      for await (const chunk of router.stream(provMsgs, opts)) {
        if (chunk.delta) content += chunk.delta;
        if (chunk.done) break;
      }

      const elapsed = Date.now() - t0;
      setStreaming(false);
      setLatency(elapsed);

      const finalMessages = [...newMessages, { role: 'assistant' as const, content }];
      const updatedState: SharedState = {
        messages: finalMessages,
        provider: activeProvider,
        model: activeModel,
        tokens: estimateTokens(finalMessages),
        localEnabled,
        latency: elapsed,
      };

      onTTERequest(content, updatedState);

    } catch (err) {
      setStreaming(false);
      const msg = err instanceof Error ? err.message : String(err);
      const errMsg: Message = {
        role: 'error',
        content: `provider error: ${msg}\n\n→ [tab] to switch model\n→ /local to toggle local inference\n→ run \`spaz auth\` to authenticate providers`,
      };
      const errorMessages = [...newMessages, errMsg];
      const updatedState: SharedState = {
        messages: errorMessages,
        provider: activeProvider,
        model: activeModel,
        tokens: estimateTokens(errorMessages),
        localEnabled,
      };
      onTTEError(msg, updatedState);
    }
  }, [router, activeModel, activeProvider, localEnabled, messages, exit, onTTERequest, onTTEError, onExit]);

  const handleSendSync = useCallback((v: string) => { void handleSend(v); }, [handleSend]);

  const termRows = process.stdout.rows ?? 24;
  const msgCount = messages.filter(m => m.role !== 'error').length;

  // ── Boot screen ───────────────────────────────────────────────────────────
  if (phase === 'booting') {
    return (
      <Box flexDirection="column" height={termRows}>
        <BootScreen statuses={providerStatuses} spinChar={spinChar} animTick={animTick} />
      </Box>
    );
  }

  // ── Chat UI ───────────────────────────────────────────────────────────────
  return (
    <Box flexDirection="column" height={termRows}>
      <Header
        streaming={streaming}
        provider={activeProvider}
        model={activeModel}
        tokens={tokenCount > 0 ? tokenCount : undefined}
        messageCount={msgCount > 0 ? msgCount : undefined}
        localEnabled={localEnabled}
        animTick={animTick}
        spinChar={spinChar}
        latency={latency}
      />

      {showPicker ? (
        <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
          <ModelPicker
            onSelect={handleSelectModel}
            onClose={() => setShowPicker(false)}
            activeModel={activeModel}
            localEnabled={localEnabled}
            onToggleLocal={handleToggleLocal}
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
          provider={activeProvider}
          model={activeModel}
          animTick={animTick}
        />
      )}
    </Box>
  );
}
