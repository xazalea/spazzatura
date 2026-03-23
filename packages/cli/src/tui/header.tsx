/**
 * Header — animated full-width box with color-cycling S·P·A·Z logo.
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface HeaderProps {
  readonly streaming: boolean;
  readonly provider?: string;
  readonly model?: string;
  readonly tokens?: number;
  readonly messageCount?: number;
  readonly localEnabled: boolean;
  readonly animTick: number;
  readonly spinChar: string;
  readonly latency?: number;
}

const LOGO_COLORS = ['cyan', 'cyanBright', 'blueBright', 'white', 'cyan'] as const;
const LOGO_LETTERS = ['S', 'P', 'A', 'Z'] as const;

export function Header({
  streaming,
  model,
  tokens,
  messageCount,
  localEnabled,
  animTick,
  spinChar,
  latency,
}: HeaderProps): React.ReactElement {
  const cols = process.stdout.columns ?? 80;

  const logo = (
    <Box gap={0}>
      {LOGO_LETTERS.map((l, i) => (
        <Text key={l} color={LOGO_COLORS[(animTick + i) % LOGO_COLORS.length] as string} bold>
          {i > 0 ? ' · ' + l : l}
        </Text>
      ))}
    </Box>
  );

  const localDot = localEnabled ? '●' : '○';
  const localColor = localEnabled ? 'magenta' : 'gray';

  const stats = streaming
    ? `${spinChar} streaming`
    : [
        model?.slice(0, 22),
        tokens !== undefined && tokens > 0 ? `~${tokens}t` : undefined,
        messageCount !== undefined && messageCount > 0 ? `${messageCount} msgs` : undefined,
        latency !== undefined ? `${latency}ms` : undefined,
      ].filter(Boolean).join('  ·  ');

  // Build inner content string for right side
  const right = `${stats}  tab ^L ^C`;

  return (
    <Box flexDirection="column">
      <Box>
        <Text dimColor>{'╔' + '═'.repeat(cols - 2) + '╗'}</Text>
      </Box>
      <Box justifyContent="space-between" paddingX={2}>
        <Box gap={0}>
          <Text dimColor>{'║  '}</Text>
          {logo}
          <Text dimColor>{'  ─  '}</Text>
        </Box>
        <Box gap={1}>
          {streaming ? (
            <Text color="yellow">{stats}</Text>
          ) : (
            <Text dimColor>{stats}</Text>
          )}
          <Text color={localColor}>{localDot}</Text>
          <Text dimColor>tab</Text>
          <Text dimColor>^L</Text>
          <Text dimColor>^C</Text>
          <Text dimColor>{'  ║'}</Text>
        </Box>
      </Box>
      <Box>
        <Text dimColor>{'╚' + '═'.repeat(cols - 2) + '╝'}</Text>
      </Box>
    </Box>
  );
}
