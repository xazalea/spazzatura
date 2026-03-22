/**
 * Settings overlay — minimal command palette: model browser, providers, settings.
 * Triggered by typing "/" in the input field.
 */

import React, { useState } from 'react';
import { Box, Text, useInput } from 'ink';
import { getDefaultProviderConfig } from '@spazzatura/provider';
import type { ExtendedProviderType } from '@spazzatura/provider';

export interface AvailableProvider {
  readonly type: string;
  readonly configured: boolean;
  readonly free: boolean;
}

export interface SettingsOverlayProps {
  readonly onClose: () => void;
  readonly activeModel?: string;
  readonly activeProvider?: string;
  readonly onSelectModel: (provider: string, model: string) => void;
  readonly ollamaEnabled: boolean;
  readonly onToggleOllama: () => void;
  readonly availableProviders: AvailableProvider[];
  readonly animTick: number;
}

type Category = 'models' | 'providers' | 'settings';

const CATS: { id: Category; label: string; key: string }[] = [
  { id: 'models',    label: 'Models',    key: 'm' },
  { id: 'providers', label: 'Providers', key: 'p' },
  { id: 'settings',  label: 'Settings',  key: 's' },
];

const BLINK = ['─', '─', ' ', '─'] as const;

function buildModelList(providers: AvailableProvider[]): Array<{ provider: string; model: string }> {
  const out: Array<{ provider: string; model: string }> = [];
  for (const p of providers) {
    try {
      const cfg = getDefaultProviderConfig(p.type as ExtendedProviderType);
      const list = cfg.models ?? (cfg.defaultModel ? [cfg.defaultModel] : []);
      for (const m of list) out.push({ provider: p.type, model: m });
    } catch { /* skip */ }
  }
  return out;
}

export function SettingsOverlay({ onClose, activeModel, activeProvider, onSelectModel, ollamaEnabled, onToggleOllama, availableProviders, animTick }: SettingsOverlayProps): React.ReactElement {
  const [catIdx, setCatIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);

  const blink = animTick % BLINK.length;

  const category = CATS[catIdx]!.id;
  const allModels = buildModelList(availableProviders);

  function maxIdx(): number {
    if (category === 'models')    return Math.max(0, allModels.length - 1);
    if (category === 'providers') return Math.max(0, availableProviders.length - 1);
    return 0;
  }

  useInput((input, key) => {
    if (key.escape) { onClose(); return; }
    if (key.tab) {
      const n = (catIdx + 1) % CATS.length;
      setCatIdx(n); setItemIdx(0); return;
    }
    if (key.upArrow)   { setItemIdx(i => Math.max(0, i - 1)); return; }
    if (key.downArrow) { setItemIdx(i => Math.min(maxIdx(), i + 1)); return; }
    if (key.return) {
      if (category === 'models') {
        const e = allModels[itemIdx];
        if (e) { onSelectModel(e.provider, e.model); onClose(); }
      } else if (category === 'settings') {
        onToggleOllama();
      }
      return;
    }
    for (let i = 0; i < CATS.length; i++) {
      if (input === CATS[i]!.key) { setCatIdx(i); setItemIdx(0); return; }
    }
  });

  const bl = BLINK[blink] ?? '─';
  const hLine = '─'.repeat(68);

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" alignSelf="center" width={72}>
      {/* Header */}
      <Box paddingX={1} justifyContent="space-between">
        <Text color="cyan" bold>{'◈ SETTINGS'}</Text>
        <Text dimColor>{'[Tab] switch · [↑↓] nav · [Enter] select · [Esc] close'}</Text>
      </Box>
      <Text dimColor>{' ' + hLine}</Text>

      <Box flexDirection="row">
        {/* Left nav */}
        <Box flexDirection="column" width={14} paddingX={1}>
          {CATS.map((c, i) => (
            <Box key={c.id}>
              <Text color={i === catIdx ? 'cyan' : 'gray'} bold={i === catIdx}>
                {(i === catIdx ? '▸ ' : '  ') + c.label}
              </Text>
            </Box>
          ))}
          <Text>{' '}</Text>
          <Text dimColor>{'[m/p/s]'}</Text>
        </Box>

        {/* Divider */}
        <Box flexDirection="column">
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
          <Text dimColor>{'│'}</Text>
        </Box>

        {/* Right content */}
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          {category === 'models' && (
            <ModelsPane models={allModels} activeModel={activeModel} activeProvider={activeProvider} selectedIdx={itemIdx} blink={bl} />
          )}
          {category === 'providers' && (
            <ProvidersPane providers={availableProviders} selectedIdx={itemIdx} />
          )}
          {category === 'settings' && (
            <SettingsPane ollamaEnabled={ollamaEnabled} selectedIdx={itemIdx} />
          )}
        </Box>
      </Box>

      <Text dimColor>{' ' + hLine}</Text>
      <Box paddingX={1}>
        {category === 'models'    && <Text dimColor>{'[Enter] switch model  ·  ' + String(allModels.length) + ' models available'}</Text>}
        {category === 'providers' && <Text dimColor>{'provider availability — read only'}</Text>}
        {category === 'settings'  && <Text dimColor>{'[Enter] toggle  ·  saved to ~/.spazzatura/settings.json'}</Text>}
      </Box>
    </Box>
  );
}

function ModelsPane({ models, activeModel, activeProvider, selectedIdx, blink }: {
  models: Array<{ provider: string; model: string }>;
  activeModel?: string;
  activeProvider?: string;
  selectedIdx: number;
  blink: string;
}): React.ReactElement {
  const viewStart = Math.max(0, selectedIdx - 8);
  const visible = models.slice(viewStart, viewStart + 14);
  return (
    <Box flexDirection="column">
      <Text dimColor>{'Models  ' + blink}</Text>
      {visible.map((e, i) => {
        const ri = viewStart + i;
        const isActive = e.model === activeModel && e.provider === activeProvider;
        const isSel = ri === selectedIdx;
        return (
          <Box key={e.provider + ':' + e.model}>
            <Text color={isSel ? 'yellow' : 'transparent'}>{isSel ? '▸' : ' '}</Text>
            <Text color={isActive ? 'greenBright' : 'transparent'}>{isActive ? '●' : ' '}</Text>
            <Text dimColor>{'  ' + e.provider.slice(0, 10).padEnd(10) + '  '}</Text>
            <Text color={isActive ? 'greenBright' : isSel ? 'white' : 'gray'} bold={isActive}>
              {e.model.slice(0, 28)}
            </Text>
          </Box>
        );
      })}
      {models.length === 0 && <Text dimColor>  no models found</Text>}
    </Box>
  );
}

function ProvidersPane({ providers, selectedIdx }: { providers: AvailableProvider[]; selectedIdx: number }): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text dimColor>{'Providers'}</Text>
      {providers.map((p, i) => {
        const isSel = i === selectedIdx;
        const dot = p.configured ? (p.free ? '●' : '◉') : '○';
        const dotColor = p.configured ? (p.free ? 'greenBright' : 'yellow') : 'gray';
        return (
          <Box key={p.type}>
            <Text color={isSel ? 'yellow' : 'transparent'}>{isSel ? '▸' : ' '}</Text>
            <Text color={dotColor}>{' ' + dot + ' '}</Text>
            <Text color={isSel ? 'white' : 'gray'}>{p.type.padEnd(20)}</Text>
            <Text dimColor>{p.free ? 'free' : p.configured ? 'paid' : '─'}</Text>
          </Box>
        );
      })}
    </Box>
  );
}

function SettingsPane({ ollamaEnabled, selectedIdx }: { ollamaEnabled: boolean; selectedIdx: number }): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text dimColor>{'Settings'}</Text>
      <Text>{' '}</Text>
      <Box>
        <Text color={selectedIdx === 0 ? 'yellow' : 'transparent'}>{selectedIdx === 0 ? '▸' : ' '}</Text>
        <Text color={ollamaEnabled ? 'greenBright' : 'gray'}>{ollamaEnabled ? ' [ON ] ' : ' [OFF] '}</Text>
        <Text color={selectedIdx === 0 ? 'white' : 'gray'} bold={selectedIdx === 0}>{'Ollama local LLM'}</Text>
      </Box>
      <Text dimColor>{'       enables local model inference via Ollama daemon'}</Text>
      <Text>{' '}</Text>
      <Text dimColor>{'  more settings coming soon'}</Text>
    </Box>
  );
}
