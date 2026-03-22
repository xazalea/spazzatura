/**
 * Sidebar panel — model browser, token usage, active model, session info.
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

function TokenBar({ tokens, max }: { readonly tokens: number; readonly max: number }): React.ReactElement {
  const barWidth = 10;
  const filled = Math.min(barWidth, Math.round((tokens / max) * barWidth));
  const empty = barWidth - filled;
  const bar = '█'.repeat(filled) + '░'.repeat(empty);
  const pct = Math.round((tokens / max) * 100);
  const color = pct > 80 ? 'red' : pct > 50 ? 'yellow' : 'greenBright';

  return (
    <Box flexDirection="column">
      <Text color={color}>{bar}</Text>
      <Text dimColor>{String(tokens).padStart(5) + ' / ' + String(max)}</Text>
    </Box>
  );
}

// Animated pulse for section headers
const PULSE_CHARS = ['◈', '◇', '◈', '◆'] as const;

export function Sidebar({
  allModels,
  tokens,
  maxTokens = 8192,
  activeModel,
  activeProvider,
  messageCount,
}: SidebarProps): React.ReactElement {
  const [pulseIdx, setPulseIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPulseIdx(i => (i + 1) % PULSE_CHARS.length), 500);
    return () => clearInterval(t);
  }, []);

  const pulse = PULSE_CHARS[pulseIdx] ?? '◈';

  // Show up to 10 models, prioritize active model at top if present
  const activeIdx = allModels.findIndex(m => m.model === activeModel && m.provider === activeProvider);
  let visibleModels: ModelEntry[];
  if (activeIdx > 0) {
    // Ensure active model is visible: start window around it
    const windowStart = Math.max(0, activeIdx - 2);
    visibleModels = allModels.slice(windowStart, windowStart + 10);
  } else {
    visibleModels = allModels.slice(0, 10);
  }

  return (
    <Box flexDirection="column" width={24} borderStyle="single" paddingX={1}>
      {/* Model browser */}
      <Text bold color="cyan">{pulse + ' MODELS'}</Text>
      <Text dimColor>{'─'.repeat(20)}</Text>
      {visibleModels.length === 0
        ? <Text dimColor>  no models</Text>
        : visibleModels.map((m, i) => {
            const isActive = m.model === activeModel && m.provider === activeProvider;
            const name = m.model.slice(0, 18);
            return (
              <Box key={'model-' + i + '-' + m.provider + '-' + m.model}>
                <Text color={isActive ? 'greenBright' : 'transparent'}>{isActive ? '●' : ' '}</Text>
                <Text> </Text>
                <Text
                  color={isActive ? 'greenBright' : 'gray'}
                  bold={isActive}
                  wrap="truncate"
                >
                  {name}
                </Text>
              </Box>
            );
          })
      }
      {allModels.length > 10 && (
        <Text dimColor>{'  +' + String(allModels.length - 10) + ' more [/]'}</Text>
      )}

      {/* Spacer */}
      <Text>{' '}</Text>

      {/* Token usage */}
      <Text bold color="cyan">{pulse + ' TOKENS'}</Text>
      <Text dimColor>{'─'.repeat(20)}</Text>
      <TokenBar tokens={tokens} max={maxTokens} />

      {/* Spacer */}
      <Text>{' '}</Text>

      {/* Active model */}
      <Text bold color="cyan">{pulse + ' ACTIVE'}</Text>
      <Text dimColor>{'─'.repeat(20)}</Text>
      {activeModel
        ? <Text color="white" wrap="truncate">{activeModel}</Text>
        : <Text dimColor>auto</Text>
      }
      {activeProvider
        ? <Text dimColor>{'via ' + activeProvider}</Text>
        : null
      }

      {/* Spacer */}
      <Text>{' '}</Text>

      {/* Session */}
      <Text bold color="cyan">{pulse + ' SESSION'}</Text>
      <Text dimColor>{'─'.repeat(20)}</Text>
      <Text color="white">{'↑' + String(messageCount) + ' msgs'}</Text>
      <Text dimColor>{'[/] settings'}</Text>
    </Box>
  );
}
