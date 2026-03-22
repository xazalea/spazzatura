/**
 * Sidebar — model browser + session stats. No internal timers.
 */

import React from 'react';
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
  readonly animTick: number;
}

const PULSE = ['◈', '◇', '◈', '◆'] as const;

function TokenBar({ tokens, max }: { tokens: number; max: number }): React.ReactElement {
  const w = 12;
  const filled = Math.min(w, Math.round((tokens / max) * w));
  const bar = '█'.repeat(filled) + '░'.repeat(w - filled);
  const pct = Math.round((tokens / max) * 100);
  return (
    <Text color={pct > 80 ? 'red' : pct > 50 ? 'yellow' : 'greenBright'}>{' ' + bar}</Text>
  );
}

export function Sidebar({ allModels, tokens, maxTokens = 8192, activeModel, activeProvider, messageCount, animTick }: SidebarProps): React.ReactElement {
  const p = PULSE[animTick % PULSE.length] ?? '◈';

  const activeIdx = allModels.findIndex(m => m.model === activeModel && m.provider === activeProvider);
  const start = activeIdx > 2 ? activeIdx - 2 : 0;
  const visible = allModels.slice(start, start + 10);

  return (
    <Box flexDirection="column" width={22} borderStyle="single" borderColor="gray" paddingX={1}>
      <Text bold color="gray">{p + ' MODELS'}</Text>
      <Text dimColor>{'─'.repeat(18)}</Text>
      {visible.length === 0
        ? <Text dimColor>  none</Text>
        : visible.map((m, i) => {
            const active = m.model === activeModel && m.provider === activeProvider;
            return (
              <Box key={`${i}-${m.provider}-${m.model}`}>
                <Text color={active ? 'greenBright' : 'transparent'}>{active ? '●' : ' '}</Text>
                <Text color={active ? 'greenBright' : 'gray'} bold={active} wrap="truncate">
                  {' ' + m.model.slice(0, 17)}
                </Text>
              </Box>
            );
          })
      }
      {allModels.length > 10 && <Text dimColor>{' +' + (allModels.length - 10) + ' [/]'}</Text>}

      <Text>{' '}</Text>
      <Text bold color="gray">{p + ' TOKENS'}</Text>
      <Text dimColor>{'─'.repeat(18)}</Text>
      <TokenBar tokens={tokens} max={maxTokens} />
      <Text dimColor>{' ~' + tokens + ' / ' + maxTokens}</Text>

      <Text>{' '}</Text>
      <Text bold color="gray">{p + ' SESSION'}</Text>
      <Text dimColor>{'─'.repeat(18)}</Text>
      {activeModel && <Text color="white" wrap="truncate">{' ' + activeModel.slice(0, 17)}</Text>}
      {activeProvider && <Text dimColor>{' ' + activeProvider.slice(0, 16)}</Text>}
      <Text dimColor>{' ' + messageCount + ' msgs'}</Text>
      <Text>{' '}</Text>
      <Text dimColor>{'[/] settings'}</Text>
    </Box>
  );
}
