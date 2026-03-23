/**
 * TUI App — Ink-based terminal interface with TTE effect integration.
 *
 * Architecture:
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
import { TopBar } from './top-bar.js';
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
      // Support both old key (ollamaEnabled) and new key (localEnabled)
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

function buildRouter(provider?: string, localEnabled = false): ProviderRouter {
  const available = detectAvailableProviders();
  const filtered = localEnabled ? available : available.filter(p => p.type !== 'ollama');
  const providerConfigs = [];
  for (const p of filtered) {
    if (p.configured) {
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
    const safeTypes = ['gpt4free', 'freeglm', 'gpt4free-enhanced', 'free-gpt4-web', 'webai', 'aiclient'];
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

// ── Local (Ollama) secondary router ──────────────────────────────────────────

let localRouter: ProviderRouter | null = null;

async function startLocalIfNeeded(): Promise<void> {
  try {
    const resp = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1000) });
    if (resp.ok) { buildLocalRouter(); return; }
  } catch { /* not running */ }
  try {
    const { spawn } = await import('child_process');
    const proc = spawn('ollama', ['serve'], { stdio: 'ignore', detached: true });
    proc.unref();
    const deadline = Date.now() + 8000;
    while (Date.now() < deadline) {
      await new Promise(r => setTimeout(r, 800));
      try {
        const r = await fetch('http://localhost:11434/api/tags', { signal: AbortSignal.timeout(1000) });
        if (r.ok) { buildLocalRouter(); return; }
      } catch { /* keep waiting */ }
    }
  } catch { /* ollama not installed */ }
}

function buildLocalRouter(): void {
  try {
    const cfg = getDefaultProviderConfig('ollama');
    localRouter = createRouter([cfg], getDefaultRoutingConfig());
  } catch { /* ignore */ }
}

/** Non-critical classifier: short, conversational, no code indicators → use local */
function isNonCritical(text: string): boolean {
  const lower = text.toLowerCase();
  if (/\bcode\b|\bimplement\b|\bwrite\b|\bfix\b|\bbug\b|\brefactor\b|\bdebug\b|\berror\b|\btest\b/.test(lower)) return false;
  if (/```|class |function |const |import |export |async /.test(text)) return false;
  if (text.trim().split(/\s+/).length > 30) return false;
  return /^(hi|hello|hey|thanks|thank you|ok|okay|yes|no|sure|what|how|why|who|when|where|suggest|opinion|think|idea|help|advice|recommend)/i.test(lower);
}

// ── Background auth ───────────────────────────────────────────────────────────

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

// ── Animation constants ───────────────────────────────────────────────────────

const SPIN_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
const ANIM_PERIOD = 8;

// ── Main App Component ────────────────────────────────────────────────────────

export function App({ provider, model, initialState, onTTERequest, onTTEError, onExit }: AppProps): React.ReactElement {
  const { exit } = useApp();

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
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
  const [localReady,     setLocalReady]     = useState(false);

  const [animTick,  setAnimTick]  = useState(0);
  const [spinTick,  setSpinTick]  = useState(0);
  const [tickerPos, setTickerPos] = useState(0);

  const authRunning   = useRef(false);
  const initialized   = useRef(false);

  // Single root animation clock — no per-component timers
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

  // One-time initialization
  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;
    ensureDirs();
    loadStoredTokens();

    const available = detectAvailableProviders();
    setAvailableProviders(available);

    let r: ProviderRouter | undefined;
    try { r = buildRouter(provider, localEnabled); } catch { /* ignore */ }
    if (r !== undefined) {
      setRouter(r);
      if (activeProvider === undefined) {
        const first = available.find(p => p.configured && p.type !== 'ollama');
        if (first) setActiveProvider(first.type);
      }
    }

    // Start local (Ollama) in background
    void startLocalIfNeeded().then(() => {
      if (localRouter !== null) setLocalReady(true);
    });

    if (!authRunning.current) {
      authRunning.current = true;
      void runBackgroundAuth(() => {
        loadStoredTokens();
        try { setRouter(buildRouter(provider, localEnabled)); } catch { /* ignore */ }
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    setTokenCount(estimateTokens(messages));
  }, [messages]);

  // ── Key bindings ─────────────────────────────────────────────────────────
  useInput((_inputChar, key) => {
    if (showPicker) return; // ModelPicker handles its own input
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
    // Rebuild router with the chosen provider prioritized
    try { setRouter(buildRouter(prov, localEnabled)); } catch { /* ignore */ }
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
      setMessages(prev => [...prev, { role: 'error', content: 'router not ready — please wait a moment' }]);
      return;
    }

    // Decide whether to use local router
    const useLocal = localEnabled && localRouter !== null && localReady && isNonCritical(trimmed);
    const activeRouter = useLocal ? localRouter! : router;
    const routerProvider = useLocal ? 'local' : activeProvider;

    const resolved = resolveFileRefs(trimmed);
    const userMsg: Message = { role: 'user', content: trimmed };
    const newMessages = [...messages, userMsg];
    setMessages(newMessages);
    setStreaming(true);

    const systemPrompt = useLocal
      ? 'You are Spazzatura, a friendly AI assistant. Be concise.'
      : 'You are Spazzatura, an elite AI coding assistant. Be concise, accurate, and practical. Format code in markdown code blocks.';

    const provMsgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: systemPrompt },
      ...messages.filter(m => m.role !== 'error').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: resolved },
    ];

    let content = '';
    const t0 = Date.now();

    try {
      const opts = { ...(activeModel !== undefined && !useLocal ? { model: activeModel } : {}) };
      for await (const chunk of activeRouter.stream(provMsgs, opts)) {
        if (chunk.delta) content += chunk.delta;
        if (chunk.done) break;
      }

      const elapsed = Date.now() - t0;
      setStreaming(false);

      const finalMessages = [...newMessages, { role: 'assistant' as const, content }];
      const updatedState: SharedState = {
        messages: finalMessages,
        provider: routerProvider,
        model: useLocal ? 'llama3.2' : activeModel,
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
        provider: routerProvider,
        model: useLocal ? 'llama3.2' : activeModel,
        tokens: estimateTokens(errorMessages),
        localEnabled,
      };
      onTTEError(msg, updatedState);
    }
  }, [router, activeModel, activeProvider, localEnabled, localReady, messages, exit, onTTERequest, onTTEError, onExit]);

  const handleSendSync = useCallback((v: string) => { void handleSend(v); }, [handleSend]);

  const termRows = process.stdout.rows ?? 24;
  const msgCount = messages.filter(m => m.role !== 'error').length;

  return (
    <Box flexDirection="column" height={termRows}>
      <TopBar
        streaming={streaming}
        provider={activeProvider}
        model={activeModel}
        tokens={tokenCount > 0 ? tokenCount : undefined}
        messageCount={msgCount > 0 ? msgCount : undefined}
        localEnabled={localEnabled}
        localReady={localReady}
        animTick={animTick}
        tickerPos={tickerPos}
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
        />
      )}
    </Box>
  );
}
