/**
 * Sidebar — minimal model browser + session stats.
 * Only rendered when terminal columns > 110.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export interface ModelEntry {
  readonly provider: string;
  readonly model: string;
}

export interface SidebarProps {
  readonly allModels: ModelEntry[];
  readonly tokens: number;
  readonly maxTokens?: number;
  readonly activeModel?: string;
  readonly activeProvider?: string;
  readonly messageCount: number;
}

const PULSE = ['◈', '◇', '◈', '◆'] as const;

function TokenBar({ tokens, max }: { tokens: number; max: number }): React.ReactElement {
  const w = 12;
  const filled = Math.min(w, Math.round((tokens / max) * w));
  const bar = '█'.repeat(filled) + '░'.repeat(w - filled);
  const pct = Math.round((tokens / max) * 100);
  const c = pct > 80 ? 'red' : pct > 50 ? 'yellow' : 'greenBright';
  return (
    <Box flexDirection="column">
      <Text color={c}>{' ' + bar}</Text>
      <Text dimColor>{' ' + String(tokens).padStart(5) + ' / ' + String(max) + ' tok'}</Text>
    </Box>
  );
}

export function Sidebar({ allModels, tokens, maxTokens = 8192, activeModel, activeProvider, messageCount }: SidebarProps): React.ReactElement {
  const [pIdx, setPIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setPIdx(i => (i + 1) % PULSE.length), 600);
    return () => clearInterval(t);
  }, []);
  const p = PULSE[pIdx] ?? '◈';

  const activeIdx = allModels.findIndex(m => m.model === activeModel && m.provider === activeProvider);
  let visible: ModelEntry[];
  if (activeIdx > 0) {
    const start = Math.max(0, activeIdx - 2);
    visible = allModels.slice(start, start + 10);
  } else {
    visible = allModels.slice(0, 10);
  }

  return (
    <Box flexDirection="column" width={22} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="gray">{p + ' MODELS'}</Text>
      <Text dimColor>{'─'.repeat(18)}</Text>
      {visible.length === 0
        ? <Text dimColor>  none</Text>
        : visible.map((m, i) => {
            const active = m.model === activeModel && m.provider === activeProvider;
            return (
              <Box key={`m-${i}-${m.provider}-${m.model}`}>
                <Text color={active ? 'greenBright' : 'transparent'}>{active ? '●' : ' '}</Text>
                <Text color={active ? 'greenBright' : 'gray'} bold={active} wrap="truncate">
                  {' ' + m.model.slice(0, 16)}
                </Text>
              </Box>
            );
          })
      }
      {allModels.length > 10 && <Text dimColor>{' +' + String(allModels.length - 10) + ' [/]'}</Text>}

      <Text>{' '}</Text>
      <Text bold color="gray">{p + ' TOKENS'}</Text>
      <Text dimColor>{'─'.repeat(18)}</Text>
      <TokenBar tokens={tokens} max={maxTokens} />

      <Text>{' '}</Text>
      <Text bold color="gray">{p + ' SESSION'}</Text>
      <Text dimColor>{'─'.repeat(18)}</Text>
      {activeModel && <Text color="white" wrap="truncate">{' ' + activeModel.slice(0, 16)}</Text>}
      {activeProvider && <Text dimColor>{' via ' + activeProvider.slice(0, 14)}</Text>}
      <Text dimColor>{' ' + String(messageCount) + ' messages'}</Text>
      <Text>{' '}</Text>
      <Text dimColor>{'[/] settings'}</Text>
    </Box>
  );
}
