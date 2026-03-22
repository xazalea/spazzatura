/**
 * Sidebar panel — provider health, token usage, active model.
 * Only rendered when terminal columns > 110.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export interface ProviderStatus {
  readonly name: string;
  readonly online: boolean;
  readonly model?: string;
}

export interface SidebarProps {
  readonly providers: ProviderStatus[];
  readonly tokens: number;
  readonly maxTokens?: number;
  readonly activeModel?: string;
  readonly activeProvider?: string;
  readonly messageCount: number;
}

function ProviderRow({ p }: { readonly p: ProviderStatus }): React.ReactElement {
  return (
    <Box>
      <Text color={p.online ? 'greenBright' : 'red'}>{p.online ? '●' : '○'}</Text>
      <Text> </Text>
      <Text color={p.online ? 'white' : 'gray'}>{p.name.padEnd(10).slice(0, 10)}</Text>
    </Box>
  );
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
      <Text dimColor>{String(tokens).padStart(5)} / {String(max)}</Text>
    </Box>
  );
}

// Animated pulse for the header labels
const PULSE_CHARS = ['◈', '◇', '◈', '◆'] as const;

export function Sidebar({
  providers,
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

  return (
    <Box flexDirection="column" width={22} borderStyle="single" paddingX={1}>
      {/* Provider section */}
      <Text bold color="cyan">{pulse + ' PROVIDERS'}</Text>
      <Text dimColor>{'─'.repeat(18)}</Text>
      {providers.length === 0
        ? <Text dimColor>  no services</Text>
        : providers.map((p, i) => <ProviderRow key={'prov-' + i + '-' + p.name} p={p} />)
      }

      {/* Spacer */}
      <Text>{' '}</Text>

      {/* Token usage */}
      <Text bold color="cyan">{pulse + ' TOKENS'}</Text>
      <Text dimColor>{'─'.repeat(18)}</Text>
      <TokenBar tokens={tokens} max={maxTokens} />

      {/* Spacer */}
      <Text>{' '}</Text>

      {/* Active model */}
      <Text bold color="cyan">{pulse + ' MODEL'}</Text>
      <Text dimColor>{'─'.repeat(18)}</Text>
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

      {/* Message count */}
      <Text bold color="cyan">{pulse + ' SESSION'}</Text>
      <Text dimColor>{'─'.repeat(18)}</Text>
      <Text color="white">{'↑' + String(messageCount) + ' msgs'}</Text>
    </Box>
  );
}
