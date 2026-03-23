/**
 * Status bar — minimal one-line strip. No internal timers.
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  readonly provider?: string;
  readonly model?: string;
  readonly tokens?: number;
  readonly latency?: number;
  readonly messageCount?: number;
  readonly animTick: number;
}

const DOTS = ['·', '·', '•', '·'] as const;

export function StatusBar({ provider, model, tokens, latency, messageCount, animTick }: StatusBarProps): React.ReactElement {
  const dot = DOTS[animTick % DOTS.length] ?? '·';
  const prov = (provider ?? 'auto').slice(0, 10);
  const mdl  = (model ?? '─').slice(0, 20);

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text color="gray">{dot}</Text>
        <Text color="cyan">{prov}</Text>
        <Text dimColor>/</Text>
        <Text color="white">{mdl}</Text>
        {tokens !== undefined && tokens > 0 && <Text dimColor>{'· ~' + tokens + 'tok'}</Text>}
        {latency !== undefined && <Text color="greenBright" dimColor>{'· ' + latency + 'ms'}</Text>}
        {messageCount !== undefined && messageCount > 0 && <Text dimColor>{'· ' + messageCount + ' msgs'}</Text>}
      </Box>
      <Box gap={1}>
        <Text color="cyan">{'[/]'}</Text>
        <Text dimColor>settings</Text>
        <Text dimColor>·</Text>
        <Text dimColor>{'[^C] quit'}</Text>
      </Box>
    </Box>
  );
}
