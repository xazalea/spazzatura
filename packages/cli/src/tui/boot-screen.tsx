/**
 * BootScreen — blocking init screen shown while auth runs.
 * Displays per-provider status with spinner, then transitions to chat.
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface ProviderStatus {
  service: string;
  label: string;
  state: 'pending' | 'running' | 'ready' | 'failed';
}

export interface BootScreenProps {
  readonly statuses: ProviderStatus[];
  readonly spinChar: string;
  readonly animTick: number;
}

const LOGO_COLORS = ['cyan', 'cyanBright', 'blueBright', 'white', 'cyan'] as const;
const LOGO_LETTERS = ['S', 'P', 'A', 'Z'] as const;

function stateIcon(state: ProviderStatus['state'], spinChar: string): { char: string; color: string } {
  switch (state) {
    case 'pending':  return { char: '○', color: 'gray' };
    case 'running':  return { char: spinChar, color: 'yellow' };
    case 'ready':    return { char: '✓', color: 'green' };
    case 'failed':   return { char: '✗', color: 'red' };
  }
}

function stateText(state: ProviderStatus['state']): { text: string; color: string } {
  switch (state) {
    case 'pending':  return { text: 'pending', color: 'gray' };
    case 'running':  return { text: 'authenticating...', color: 'yellow' };
    case 'ready':    return { text: 'ready', color: 'green' };
    case 'failed':   return { text: 'failed', color: 'red' };
  }
}

export function BootScreen({ statuses, spinChar, animTick }: BootScreenProps): React.ReactElement {
  const cols = process.stdout.columns ?? 80;
  const readyCount = statuses.filter(s => s.state === 'ready').length;
  const totalCount = statuses.length;

  return (
    <Box flexDirection="column" paddingTop={1}>
      {/* Logo */}
      <Box paddingX={4} marginBottom={1}>
        {LOGO_LETTERS.map((l, i) => (
          <Text key={l} color={LOGO_COLORS[(animTick + i) % LOGO_COLORS.length] as string} bold>
            {i > 0 ? ' · ' + l : l}
          </Text>
        ))}
        <Text dimColor>{'  ─  initializing'}</Text>
      </Box>

      <Box paddingX={4}>
        <Text dimColor>{'─'.repeat(cols - 8)}</Text>
      </Box>

      <Box flexDirection="column" paddingX={4} paddingY={1}>
        <Box marginBottom={1}>
          <Text dimColor>starting free AI providers...</Text>
        </Box>

        {statuses.map(s => {
          const icon = stateIcon(s.state, spinChar);
          const txt = stateText(s.state);
          const labelPad = s.label.padEnd(26);
          return (
            <Box key={s.service} gap={2} marginBottom={0}>
              <Text color={icon.color as string}>{icon.char}</Text>
              <Text color={s.state === 'ready' ? 'white' : 'gray'}>{labelPad}</Text>
              <Text color={txt.color as string}>{txt.text}</Text>
            </Box>
          );
        })}
      </Box>

      <Box paddingX={4}>
        <Text dimColor>{'─'.repeat(cols - 8)}</Text>
      </Box>

      <Box paddingX={4} paddingTop={1} gap={2}>
        <Text color="white">{String(readyCount)} / {String(totalCount)} ready</Text>
        <Text dimColor>·  this happens once per session  ·  Ctrl+C to quit</Text>
      </Box>
    </Box>
  );
}
