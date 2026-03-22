/**
 * Settings overlay — command palette: model browser, provider info, app settings.
 * Triggered by typing "/" in the input field.
 */

import React, { useState, useEffect } from 'react';
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
}

type Category = 'models' | 'providers' | 'settings';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'models', label: 'Models' },
  { id: 'providers', label: 'Providers' },
  { id: 'settings', label: 'Settings' },
];

const PULSE = ['◈', '◇', '◈', '◆'] as const;
const COLORS = ['cyan', 'magenta', 'blue', 'cyan'] as const;

function buildModelList(providers: AvailableProvider[]): Array<{ provider: string; model: string }> {
  const models: Array<{ provider: string; model: string }> = [];
  for (const p of providers) {
    try {
      const cfg = getDefaultProviderConfig(p.type as ExtendedProviderType);
      const modelList = cfg.models ?? (cfg.defaultModel ? [cfg.defaultModel] : []);
      for (const m of modelList) {
        models.push({ provider: p.type, model: m });
      }
    } catch { /* skip */ }
  }
  return models;
}

export function SettingsOverlay({
  onClose,
  activeModel,
  activeProvider,
  onSelectModel,
  ollamaEnabled,
  onToggleOllama,
  availableProviders,
}: SettingsOverlayProps): React.ReactElement {
  const [category, setCategory] = useState<Category>('models');
  const [catIdx, setCatIdx] = useState(0);
  const [itemIdx, setItemIdx] = useState(0);
  const [pulseIdx, setPulseIdx] = useState(0);
  const [colorIdx, setColorIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPulseIdx(i => (i + 1) % PULSE.length), 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    const t = setInterval(() => setColorIdx(i => (i + 1) % COLORS.length), 200);
    return () => clearInterval(t);
  }, []);

  const allModels = buildModelList(availableProviders);

  useInput((input, key) => {
    if (key.escape) { onClose(); return; }

    if (key.tab) {
      const next = (catIdx + 1) % CATEGORIES.length;
      setCatIdx(next);
      setCategory(CATEGORIES[next]!.id);
      setItemIdx(0);
      return;
    }

    if (key.upArrow) { setItemIdx(i => Math.max(0, i - 1)); return; }

    if (key.downArrow) {
      const maxIdx = getMaxIdx(category, allModels, availableProviders);
      setItemIdx(i => Math.min(maxIdx, i + 1));
      return;
    }

    if (key.return) {
      handleSelect(category, itemIdx, allModels, availableProviders, onSelectModel, onToggleOllama, onClose);
      return;
    }

    // Letter shortcuts: m = models, p = providers, s = settings
    if (input === 'm') { setCatIdx(0); setCategory('models'); setItemIdx(0); return; }
    if (input === 'p') { setCatIdx(1); setCategory('providers'); setItemIdx(0); return; }
    if (input === 's') { setCatIdx(2); setCategory('settings'); setItemIdx(0); return; }
  });

  const pulse = PULSE[pulseIdx] ?? '◈';
  const headerColor = COLORS[colorIdx] ?? 'cyan';

  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      borderColor={headerColor}
      alignSelf="center"
      width={72}
    >
      {/* Header */}
      <Box justifyContent="space-between" paddingX={1}>
        <Text bold color={headerColor}>{pulse + ' SPAZZATURA SETTINGS'}</Text>
        <Text dimColor>{'[Tab] switch  [↑↓] navigate  [Enter] select  [Esc] close'}</Text>
      </Box>
      <Text color="gray">{'╠' + '═'.repeat(70) + '╣'}</Text>

      {/* Two-pane layout */}
      <Box flexDirection="row">
        {/* Left: category list */}
        <Box flexDirection="column" width={16} paddingX={1} borderStyle="single" borderColor="gray">
          {CATEGORIES.map((c, i) => (
            <Box key={c.id}>
              <Text color={i === catIdx ? 'cyan' : 'gray'} bold={i === catIdx}>
                {(i === catIdx ? '▸ ' : '  ') + c.label}
              </Text>
            </Box>
          ))}
          <Text> </Text>
          <Text dimColor>{'[m/p/s]'}</Text>
        </Box>

        {/* Right: content pane */}
        <Box flexDirection="column" flexGrow={1} paddingX={1}>
          {category === 'models' && (
            <ModelsPane
              models={allModels}
              activeModel={activeModel}
              activeProvider={activeProvider}
              selectedIdx={itemIdx}
            />
          )}
          {category === 'providers' && (
            <ProvidersPane
              providers={availableProviders}
              selectedIdx={itemIdx}
            />
          )}
          {category === 'settings' && (
            <SettingsPane
              ollamaEnabled={ollamaEnabled}
              selectedIdx={itemIdx}
            />
          )}
        </Box>
      </Box>

      {/* Footer hint */}
      <Text color="gray">{'╠' + '═'.repeat(70) + '╣'}</Text>
      <Box justifyContent="center" paddingX={1}>
        {category === 'models' && <Text dimColor>Press <Text color="yellow" bold>[Enter]</Text> to switch to selected model</Text>}
        {category === 'providers' && <Text dimColor>Provider availability — read only</Text>}
        {category === 'settings' && <Text dimColor>Press <Text color="yellow" bold>[Enter]</Text> to toggle setting</Text>}
      </Box>
    </Box>
  );
}

function getMaxIdx(
  category: Category,
  models: Array<{ provider: string; model: string }>,
  providers: AvailableProvider[],
): number {
  if (category === 'models') return Math.max(0, models.length - 1);
  if (category === 'providers') return Math.max(0, providers.length - 1);
  return 0; // settings: 1 item (ollama toggle)
}

function handleSelect(
  category: Category,
  itemIdx: number,
  models: Array<{ provider: string; model: string }>,
  _providers: AvailableProvider[],
  onSelectModel: (provider: string, model: string) => void,
  onToggleOllama: () => void,
  onClose: () => void,
): void {
  if (category === 'models') {
    const entry = models[itemIdx];
    if (entry) { onSelectModel(entry.provider, entry.model); onClose(); }
  } else if (category === 'settings') {
    onToggleOllama();
  }
}

function ModelsPane({
  models,
  activeModel,
  activeProvider,
  selectedIdx,
}: {
  models: Array<{ provider: string; model: string }>;
  activeModel?: string;
  activeProvider?: string;
  selectedIdx: number;
}): React.ReactElement {
  const viewStart = Math.max(0, selectedIdx - 8);
  const visible = models.slice(viewStart, viewStart + 16);

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{'◈ All Available Models'}</Text>
      <Text color="gray">{'─'.repeat(50)}</Text>
      {visible.map((entry, i) => {
        const realIdx = viewStart + i;
        const isActive = entry.model === activeModel && entry.provider === activeProvider;
        const isSelected = realIdx === selectedIdx;
        const modelShort = entry.model.slice(0, 30);
        const provShort = entry.provider.slice(0, 12).padEnd(12);

        return (
          <Box key={entry.provider + ':' + entry.model}>
            <Text color={isSelected ? 'yellow' : 'transparent'}>{isSelected ? '▸ ' : '  '}</Text>
            <Text color={isActive ? 'greenBright' : 'transparent'}>{isActive ? '●' : ' '}</Text>
            <Text> </Text>
            <Text color="gray" dimColor>{provShort}</Text>
            <Text color="gray">{'  '}</Text>
            <Text color={isActive ? 'greenBright' : isSelected ? 'white' : 'gray'} bold={isActive}>
              {modelShort}
            </Text>
          </Box>
        );
      })}
      {models.length === 0 && <Text dimColor>  No models available</Text>}
      <Text> </Text>
      <Text dimColor>{String(selectedIdx + 1) + ' / ' + String(models.length) + ' models'}</Text>
    </Box>
  );
}

function ProvidersPane({
  providers,
  selectedIdx,
}: {
  providers: AvailableProvider[];
  selectedIdx: number;
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{'◈ Provider Status'}</Text>
      <Text color="gray">{'─'.repeat(50)}</Text>
      {providers.map((p, i) => {
        const isSelected = i === selectedIdx;
        const status = p.configured
          ? (p.free ? <Text color="greenBright">{'● free   '}</Text> : <Text color="yellow">{'● paid   '}</Text>)
          : <Text color="red">{'○ unavail'}</Text>;
        return (
          <Box key={p.type}>
            <Text color={isSelected ? 'yellow' : 'transparent'}>{isSelected ? '▸ ' : '  '}</Text>
            {status}
            <Text> </Text>
            <Text color={isSelected ? 'white' : 'gray'}>{p.type}</Text>
          </Box>
        );
      })}
      {providers.length === 0 && <Text dimColor>  No providers detected</Text>}
    </Box>
  );
}

function SettingsPane({
  ollamaEnabled,
  selectedIdx,
}: {
  ollamaEnabled: boolean;
  selectedIdx: number;
}): React.ReactElement {
  return (
    <Box flexDirection="column">
      <Text bold color="cyan">{'◈ App Settings'}</Text>
      <Text color="gray">{'─'.repeat(50)}</Text>
      <Text> </Text>

      {/* Ollama toggle */}
      <Box>
        <Text color={selectedIdx === 0 ? 'yellow' : 'transparent'}>{selectedIdx === 0 ? '▸ ' : '  '}</Text>
        <Text color={ollamaEnabled ? 'greenBright' : 'gray'}>
          {ollamaEnabled ? '[ON ] ' : '[OFF] '}
        </Text>
        <Text color={selectedIdx === 0 ? 'white' : 'gray'} bold={selectedIdx === 0}>
          {'Ollama (local LLM)'}
        </Text>
      </Box>
      <Text dimColor>{'     Runs local models via Ollama daemon'}</Text>
      <Text dimColor>{'     Persisted to ~/.spazzatura/settings.json'}</Text>

      <Text> </Text>
      <Box>
        <Text dimColor>{'  More settings coming soon...'}</Text>
      </Box>
    </Box>
  );
}
