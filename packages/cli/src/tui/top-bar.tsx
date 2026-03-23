/**
 * TopBar — clean two-line header.
 * Line 1: spaz · active model · stats  ·  hints
 * Line 2: dim separator
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface TopBarProps {
  readonly streaming: boolean;
  readonly provider?: string;
  readonly model?: string;
  readonly tokens?: number;
  readonly messageCount?: number;
  readonly localEnabled: boolean;
  readonly localReady: boolean;
  readonly animTick: number;
  readonly tickerPos: number;
  readonly spinChar: string;
  readonly latency?: number;
}

const SPIN = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'] as const;

export function TopBar({
  streaming,
  model,
  tokens,
  messageCount,
  localEnabled,
  localReady,
  animTick,
  latency,
}: TopBarProps): React.ReactElement {
  const spin  = SPIN[animTick % SPIN.length] ?? '⠋';
  const cols  = process.stdout.columns ?? 80;

  const mdl = model?.slice(0, 26) ?? 'no model';

  const localColor  = localEnabled ? (localReady ? 'magenta' : 'yellow') : 'gray';
  const localText   = localEnabled ? (localReady ? 'local' : 'local·') : 'local';

  return (
    <Box flexDirection="column">
      <Box paddingX={2} justifyContent="space-between">
        {/* Left section */}
        <Box gap={2}>
          <Text color="cyan" bold>spaz</Text>

          {streaming ? (
            <Box gap={1}>
              <Text color="yellow">{spin}</Text>
              <Text color="yellow" dimColor>thinking</Text>
            </Box>
          ) : (
            <Text color="white">{mdl}</Text>
          )}

          {!streaming && tokens !== undefined && tokens > 0 && (
            <Text dimColor>{'~' + tokens + 't'}</Text>
          )}
          {!streaming && messageCount !== undefined && messageCount > 0 && (
            <Text dimColor>{messageCount + ' msg' + (messageCount === 1 ? '' : 's')}</Text>
          )}
          {!streaming && latency !== undefined && (
            <Text dimColor>{latency + 'ms'}</Text>
          )}
        </Box>

        {/* Right section — shortcuts */}
        <Box gap={2}>
          <Text color={localColor} bold={localEnabled}>{localText}</Text>
          <Text dimColor>tab·model</Text>
          <Text dimColor>^L·local</Text>
          <Text dimColor>^C·quit</Text>
        </Box>
      </Box>

      {/* Separator */}
      <Box paddingX={0}>
        <Text dimColor>{'─'.repeat(cols)}</Text>
      </Box>
    </Box>
  );
}
