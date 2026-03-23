/**
 * Model picker — flat list of model names only.
 * No provider labels visible. Arrow keys or number to select.
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getDefaultProviderConfig, detectAvailableProviders } from '@spazzatura/provider';
import type { ExtendedProviderType } from '@spazzatura/provider';

interface Entry {
  provider: string;
  model: string;
  isLocal: boolean;
}

const LOGO_COLORS = ['cyan', 'cyanBright', 'blueBright', 'white', 'cyan'] as const;
const LOGO_LETTERS = ['S', 'P', 'A', 'Z'] as const;

const PROVIDER_ORDER: ExtendedProviderType[] = [
  'freeglm', 'qwen', 'glm', 'minimax', 'gemini', 'claude-free', 'chat2api',
  'glm-free', 'glm-free-xiaoY', 'gpt4free', 'gpt4free-enhanced', 'free-gpt4-web',
  'webai', 'aiclient',
  'openrouter', 'openai', 'anthropic',
];

function buildEntries(): Entry[] {
  const available = detectAvailableProviders();
  const seen = new Set<string>();
  const entries: Entry[] = [];

  for (const type of PROVIDER_ORDER) {
    const p = available.find(a => a.type === type);
    if (!p?.configured) continue;
    try {
      const cfg = getDefaultProviderConfig(type);
      const models = cfg.models ?? (cfg.defaultModel ? [cfg.defaultModel] : []);
      for (const m of models) {
        if (!seen.has(m)) {
          seen.add(m);
          entries.push({ provider: type, model: m, isLocal: false });
        }
      }
    } catch { /* skip */ }
  }

  // Local separator + llama models
  entries.push({ provider: 'ollama', model: 'llama3.2', isLocal: true });
  entries.push({ provider: 'ollama', model: 'mistral', isLocal: true });
  entries.push({ provider: 'ollama', model: 'codellama', isLocal: true });

  return entries;
}

export interface ModelPickerProps {
  readonly onSelect: (provider: string, model: string) => void;
  readonly onClose: () => void;
  readonly activeModel?: string;
  readonly localEnabled: boolean;
  readonly onToggleLocal: () => void;
  readonly animTick?: number;
}

export function ModelPicker({
  onSelect,
  onClose,
  activeModel,
  localEnabled,
  onToggleLocal,
  animTick = 0,
}: ModelPickerProps): React.ReactElement {
  const entries = buildEntries();
  const [idx, setIdx] = useState(() => {
    const i = entries.findIndex(e => e.model === activeModel);
    return i >= 0 ? i : 0;
  });

  const cols = process.stdout.columns ?? 80;
  const W = Math.min(42, cols - 6);
  const innerW = W - 4; // inside padding

  // Viewport: show at most 12 entries, scroll to keep cursor visible
  const VIEW = 12;
  const scrollOffset = Math.max(0, Math.min(idx - Math.floor(VIEW / 2), entries.length - VIEW));
  const visible = entries.slice(scrollOffset, scrollOffset + VIEW);

  useInput((input, key) => {
    if (key.escape || key.tab) { onClose(); return; }
    if (key.upArrow)   { setIdx(i => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setIdx(i => Math.min(entries.length - 1, i + 1)); return; }
    if (key.return) {
      const e = entries[idx];
      if (!e) { onClose(); return; }
      if (e.isLocal) { onToggleLocal(); onClose(); }
      else { onSelect(e.provider, e.model); }
      return;
    }
    const n = parseInt(input, 10);
    if (!isNaN(n) && n >= 1 && n <= Math.min(9, entries.length)) {
      const e = entries[n - 1]!;
      if (e.isLocal) { onToggleLocal(); onClose(); }
      else { onSelect(e.provider, e.model); }
    }
  });

  // Find where locals start for separator
  const firstLocalIdx = entries.findIndex(e => e.isLocal);

  return (
    <Box flexDirection="column" width={W} borderStyle="single" borderColor="gray">
      {/* Header */}
      <Box paddingX={1} paddingTop={0} paddingBottom={0} justifyContent="space-between">
        <Box gap={0}>
          {LOGO_LETTERS.map((l, i) => (
            <Text key={l} color={LOGO_COLORS[(animTick + i) % LOGO_COLORS.length] as string} bold>
              {i > 0 ? '·' + l : l}
            </Text>
          ))}
          <Text dimColor>{' models'}</Text>
        </Box>
        <Text dimColor>↑↓ · ↵ · esc</Text>
      </Box>

      <Box paddingX={1} paddingBottom={0}>
        <Text dimColor>{'─'.repeat(innerW + 2)}</Text>
      </Box>

      {/* Model list */}
      {visible.map((e, vi) => {
        const ri = scrollOffset + vi;
        const isActive = e.model === activeModel && (!e.isLocal || localEnabled);
        const isSel = ri === idx;
        const showSep = ri === firstLocalIdx && firstLocalIdx > 0;

        return (
          <React.Fragment key={e.provider + ':' + e.model}>
            {showSep && (
              <Box paddingX={1}>
                <Text dimColor>{'─'.repeat(innerW + 2)}</Text>
              </Box>
            )}
            <Box paddingX={1} gap={1}>
              {/* Cursor */}
              <Text color="cyan">{isSel ? '›' : ' '}</Text>

              {/* Model name */}
              <Text
                color={isActive ? 'greenBright' : isSel ? 'white' : 'gray'}
                bold={isActive || isSel}
              >
                {e.model.slice(0, innerW - 10)}
              </Text>

              {/* Active dot */}
              {isActive && <Text color="greenBright">{'●'}</Text>}

              {/* Local tag */}
              {e.isLocal && (
                <Text color={localEnabled ? 'magenta' : 'gray'} dimColor={!localEnabled}>
                  {localEnabled ? 'local' : 'local·off'}
                </Text>
              )}
            </Box>
          </React.Fragment>
        );
      })}

      {/* Scroll hint */}
      {entries.length > VIEW && (
        <Box paddingX={1}>
          <Text dimColor>
            {scrollOffset > 0 ? '↑ ' : '  '}
            {String(entries.length) + ' models'}
            {scrollOffset + VIEW < entries.length ? ' ↓' : '  '}
          </Text>
        </Box>
      )}

      <Box paddingX={1} paddingBottom={0}>
        <Text dimColor>{'─'.repeat(innerW + 2)}</Text>
      </Box>
    </Box>
  );
}
