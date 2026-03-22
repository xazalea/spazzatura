/**
 * Status bar — rich, color-coded bottom strip.
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  readonly provider?: string;
  readonly model?: string;
  readonly tokens?: number;
  readonly latency?: number;
  readonly layout: string;
  readonly messageCount?: number;
}

export function StatusBar({ provider, model, tokens, latency, messageCount }: StatusBarProps): React.ReactElement {
  const providerStr = provider ? provider.slice(0, 12) : 'auto';
  const modelStr = model ? model.slice(0, 20) : '─';

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box>
        <Text color="cyan" bold>{'▸ '}</Text>
        <Text color="cyan">{providerStr}</Text>
        <Text color="gray">{':'}</Text>
        <Text color="magenta">{modelStr}</Text>
        <Text color="gray">{'  │  '}</Text>
        <Text color="yellow">{'◈ ~' + (tokens ?? 0) + 'tok'}</Text>
        {latency !== undefined && (
          <>
            <Text color="gray">{'  │  '}</Text>
            <Text color="greenBright">{'⚡ ' + String(latency) + 'ms'}</Text>
          </>
        )}
        {messageCount !== undefined && messageCount > 0 && (
          <>
            <Text color="gray">{'  │  '}</Text>
            <Text color="white">{'↑' + String(messageCount) + ' msgs'}</Text>
          </>
        )}
      </Box>
      <Box>
        <Text color="gray">{'[?]'}</Text>
        <Text dimColor>{'help  '}</Text>
        <Text color="gray">{'[^C]'}</Text>
        <Text dimColor>{'quit'}</Text>
      </Box>
    </Box>
  );
}
