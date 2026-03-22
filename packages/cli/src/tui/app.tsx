/**
 * TUI App — multi-pane animated terminal interface for Spazzatura.
 * Features: boot screen, background auth, settings overlay, model browser.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
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
import { SettingsOverlay } from './settings-overlay.js';
import type { AvailableProvider } from './settings-overlay.js';
import { StatusBar } from './status-bar.js';
import { Header } from './header.js';
import { Sidebar } from './sidebar.js';
import type { ModelEntry } from './sidebar.js';
import { BootScreen } from './boot-screen.js';
import type { BootEntry } from './boot-screen.js';

export interface Message {
  readonly role: 'user' | 'assistant' | 'error';
  readonly content: string;
}

export interface AppProps {
  readonly provider?: string;
  readonly model?: string;
  readonly globalOptions: GlobalOptions;
}

type Layout = 'boot' | 'chat' | 'settings';

const SPAZ_DIR = join(homedir(), '.spazzatura');
const CONV_DIR = join(SPAZ_DIR, 'conversations');
const AUTH_FILE = join(SPAZ_DIR, 'auth.json');
const SETTINGS_FILE = join(SPAZ_DIR, 'settings.json');

// ── Persistence helpers ───────────────────────────────────────────────────────

function ensureDirs(): void {
  try {
    if (!existsSync(SPAZ_DIR)) mkdirSync(SPAZ_DIR, { recursive: true });
    if (!existsSync(CONV_DIR)) mkdirSync(CONV_DIR, { recursive: true });
  } catch { /* ignore */ }
}

function loadSettings(): { ollamaEnabled: boolean } {
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

// ── Provider/router helpers ──────────────────────────────────────────────────

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
    // Fallback: retry with only well-known safe providers
    const safeTypes = ['gpt4free', 'chat2api', 'gpt4free-enhanced', 'freeglm', 'glm-free', 'aiclient', 'webai', 'qwen', 'glm', 'minimax', 'claude-free'];
    const safe = providerConfigs.filter(c => safeTypes.includes(c.type));
    return createRouter(safe.length > 0 ? safe : providerConfigs.slice(0, 1), getDefaultRoutingConfig());
  }
}

function buildAllModels(providers: AvailableProvider[], ollamaEnabled: boolean): ModelEntry[] {
  const models: ModelEntry[] = [];
  for (const p of providers) {
    if (!ollamaEnabled && p.type === 'ollama') continue;
    try {
      const cfg = getDefaultProviderConfig(p.type);
      const list = cfg.models ?? (cfg.defaultModel ? [cfg.defaultModel] : []);
      for (const m of list) models.push({ provider: p.type, model: m });
    } catch { /* skip */ }
  }
  return models;
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

// ── Background auth (silent, headless) ───────────────────────────────────────

async function runBackgroundAuth(
  onTokenFound: (service: string, token: string) => void,
): Promise<void> {
  // Only try services that don't have tokens yet
  const stored = existsSync(AUTH_FILE)
    ? (() => { try { return JSON.parse(readFileSync(AUTH_FILE, 'utf-8')) as Record<string, unknown>; } catch { return {}; } })()
    : {};

  const needsAuth = ['qwen', 'chatglm', 'minimax', 'gemini']
    .filter(s => !stored[s]);

  if (needsAuth.length === 0) return;

  try {
    const { runAllAuth } = await import('../auth/automator.js');
    await runAllAuth(
      (result) => {
        if (result.success && result.token) {
          onTokenFound(result.service, result.token);
        }
      },
      needsAuth,
    );
  } catch { /* playwright not available — skip silently */ }
}

// ── Main App Component ────────────────────────────────────────────────────────

export function App({ provider, model, globalOptions: _globalOptions }: AppProps): React.ReactElement {
  const { exit } = useApp();

  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [streaming, setStreaming] = useState(false);
  const [layout, setLayout] = useState<Layout>('boot');
  const [router, setRouter] = useState<ProviderRouter | undefined>(undefined);
  const [tokenCount, setTokenCount] = useState(0);
  const [latency, setLatency] = useState<number | undefined>(undefined);
  const [activeProvider, setActiveProvider] = useState<string | undefined>(provider);
  const [activeModel, setActiveModel] = useState<string | undefined>(model);
  const [ollamaEnabled, setOllamaEnabled] = useState(() => loadSettings().ollamaEnabled);
  const [availableProviders, setAvailableProviders] = useState<AvailableProvider[]>([]);
  const [allModels, setAllModels] = useState<ModelEntry[]>([]);
  const [bootEntries, setBootEntries] = useState<BootEntry[]>([
    { label: 'Loading stored tokens',   status: 'running' },
    { label: 'Detecting providers',     status: 'pending' },
    { label: 'Building router',         status: 'pending' },
    { label: 'Background auth',         status: 'pending' },
  ]);
  const authRunning = useRef(false);

  const termCols = process.stdout.columns ?? 80;
  const showSidebar = termCols > 110;

  // Helper to update a boot entry
  const updateBoot = useCallback((idx: number, update: Partial<BootEntry>) => {
    setBootEntries(prev => prev.map((e, i) => i === idx ? { ...e, ...update } : e));
  }, []);

  // ── Initialization sequence ──────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      ensureDirs();

      // Step 0: load stored tokens
      loadStoredTokens();
      updateBoot(0, { status: 'ok', detail: 'done' });

      // Step 1: detect providers
      updateBoot(1, { status: 'running' });
      const available = detectAvailableProviders();
      setAvailableProviders(available);
      const configuredFree = available.filter(p => (p.configured || p.free) && p.type !== 'ollama' || (p.type === 'ollama' && ollamaEnabled));
      updateBoot(1, { status: 'ok', detail: `${configuredFree.length} providers` });

      // Step 2: build router
      updateBoot(2, { status: 'running' });
      let r: ProviderRouter;
      try {
        r = buildRouter(provider, ollamaEnabled);
      } catch (e) {
        updateBoot(2, { status: 'fail', detail: String(e).slice(0, 30) });
        setTimeout(() => setLayout('chat'), 1800);
        return;
      }
      setRouter(r);
      const firstProvider = provider ?? configuredFree[0]?.type ?? 'auto';
      setActiveProvider(firstProvider);
      setAllModels(buildAllModels(available, ollamaEnabled));
      updateBoot(2, { status: 'ok', detail: 'ready' });

      // Step 3: background auth (headless, silent)
      updateBoot(3, { status: 'running', detail: 'headless...' });
      if (!authRunning.current) {
        authRunning.current = true;
        void runBackgroundAuth((service, _token) => {
          updateBoot(3, { status: 'ok', detail: `${service} ✓` });
          // Rebuild env + router after new token
          loadStoredTokens();
          const newRouter = buildRouter(provider, ollamaEnabled);
          setRouter(newRouter);
        }).then(() => {
          // If auth step is still 'running', mark as done
          setBootEntries(prev => prev.map((e, i) => i === 3 && e.status === 'running' ? { ...e, status: 'skip', detail: 'see `spaz auth`' } : e));
        }).catch(() => {
          setBootEntries(prev => prev.map((e, i) => i === 3 && e.status === 'running' ? { ...e, status: 'skip', detail: 'playwright unavailable' } : e));
        });
      }

      // Transition to chat after a brief beat (let user see boot screen)
      setTimeout(() => setLayout('chat'), 1800);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [provider, ollamaEnabled]);

  useEffect(() => {
    setTokenCount(estimateTokens(messages));
  }, [messages]);

  // ── Key bindings ─────────────────────────────────────────────────────────
  useInput((_inputChar, key) => {
    if (key.escape) {
      if (layout === 'settings') { setLayout('chat'); return; }
      if (layout === 'boot') { setLayout('chat'); return; }
    }
    if (key.ctrl && _inputChar === 'r') {
      setMessages([]); setTokenCount(0); setLatency(undefined); return;
    }
    if (key.ctrl && _inputChar === 'c') { exit(); return; }
  });

  // ── Input handling ───────────────────────────────────────────────────────
  const handleInputChange = useCallback((value: string) => {
    if (value === '/') { setLayout('settings'); return; }
    setInput(value);
  }, []);

  const handleSelectModel = useCallback((prov: string, mdl: string) => {
    setActiveProvider(prov);
    setActiveModel(mdl);
    setLayout('chat');
  }, []);

  const handleToggleOllama = useCallback(() => {
    const next = !ollamaEnabled;
    setOllamaEnabled(next);
    saveSettings({ ollamaEnabled: next });
  }, [ollamaEnabled]);

  const handleCloseSettings = useCallback(() => setLayout('chat'), []);

  const handleSend = useCallback(async (value: string) => {
    const trimmed = value.trim();
    setInput('');
    if (!trimmed) return;

    if (trimmed === '/exit' || trimmed === '/quit' || trimmed === '/q') { exit(); return; }
    if (trimmed === '/clear') { setMessages([]); setTokenCount(0); return; }
    if (trimmed === '/settings') { setLayout('settings'); return; }
    if (trimmed === '/auth') {
      setMessages(prev => [...prev, { role: 'assistant', content: '◈ Run `spaz auth` in a separate terminal, or open settings with [/] to manage providers.' }]);
      return;
    }

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
    setMessages(prev => [...prev, { role: 'user', content: trimmed }]);
    setStreaming(true);

    const provMsgs: Array<{ role: 'system' | 'user' | 'assistant'; content: string }> = [
      { role: 'system', content: 'You are Spazzatura, an elite AI coding assistant. Be concise, accurate, and practical. Format code in markdown code blocks. Use @file.ts to inject files.' },
      ...messages.filter(m => m.role !== 'error').map(m => ({ role: m.role as 'user' | 'assistant', content: m.content })),
      { role: 'user', content: resolved },
    ];

    let content = '';
    const t0 = Date.now();
    setMessages(prev => [...prev, { role: 'assistant', content: '◌' }]);

    try {
      const opts = { ...(activeModel !== undefined ? { model: activeModel } : {}) };
      for await (const chunk of router.stream(provMsgs, opts)) {
        if (chunk.delta) {
          content += chunk.delta;
          setMessages(prev => [...prev.slice(0, -1), { role: 'assistant', content }]);
        }
        if (chunk.done) break;
      }
      setLatency(Date.now() - t0);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setMessages(prev => [
        ...prev.slice(0, -1),
        {
          role: 'error',
          content: `◈ Provider error: ${msg}\n\n→ Run [/] settings to switch models\n→ Run \`spaz auth\` to authenticate providers\n→ Set OPENROUTER_API_KEY for reliable access`,
        },
      ]);
    } finally {
      setStreaming(false);
    }
  }, [router, activeModel, messages, exit]);

  const handleSendSync = useCallback((v: string) => { void handleSend(v); }, [handleSend]);

  const termRows = process.stdout.rows ?? 24;

  if (layout === 'boot') {
    const allDone = bootEntries.every(e => e.status !== 'pending' && e.status !== 'running');
    return (
      <Box flexDirection="column" height={termRows} alignItems="center" justifyContent="center">
        <BootScreen entries={bootEntries} done={allDone} />
      </Box>
    );
  }

  return (
    <Box flexDirection="column" height={termRows}>
      <Header streaming={streaming} providerLabel={activeProvider} />

      <Box flexDirection="row" flexGrow={1}>
        {showSidebar && (
          <Sidebar
            allModels={allModels}
            tokens={tokenCount}
            activeModel={activeModel}
            activeProvider={activeProvider}
            messageCount={messages.filter(m => m.role !== 'error').length}
          />
        )}

        <Box flexDirection="column" flexGrow={1}>
          {layout === 'settings' ? (
            <Box flexDirection="column" flexGrow={1} alignItems="center" justifyContent="center">
              <SettingsOverlay
                onClose={handleCloseSettings}
                activeModel={activeModel}
                activeProvider={activeProvider}
                onSelectModel={handleSelectModel}
                ollamaEnabled={ollamaEnabled}
                onToggleOllama={handleToggleOllama}
                availableProviders={availableProviders}
              />
            </Box>
          ) : (
            <ChatView
              messages={messages}
              streaming={streaming}
              input={input}
              onChangeInput={handleInputChange}
              onSend={handleSendSync}
              {...(activeProvider !== undefined ? { provider: activeProvider } : {})}
              {...(activeModel !== undefined ? { model: activeModel } : {})}
            />
          )}
        </Box>
      </Box>

      <StatusBar
        {...(activeProvider !== undefined ? { provider: activeProvider } : {})}
        {...(activeModel !== undefined ? { model: activeModel } : {})}
        {...(tokenCount > 0 ? { tokens: tokenCount } : {})}
        {...(latency !== undefined ? { latency } : {})}
        layout={layout}
        messageCount={messages.filter(m => m.role !== 'error').length}
      />
    </Box>
  );
}
