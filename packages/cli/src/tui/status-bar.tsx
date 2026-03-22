/**
 * Status bar — minimal one-line info strip at the bottom.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  readonly provider?: string;
  readonly model?: string;
  readonly tokens?: number;
  readonly latency?: number;
  readonly layout: string;
  readonly messageCount?: number;
}

const DOT = ['·', '•', '◆', '•'] as const;

export function StatusBar({ provider, model, tokens, latency, messageCount }: StatusBarProps): React.ReactElement {
  const [dIdx, setDIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setDIdx(i => (i + 1) % DOT.length), 700);
    return () => clearInterval(t);
  }, []);
  const dot = DOT[dIdx] ?? '·';

  const prov = provider ? provider.slice(0, 10) : 'auto';
  const mdl  = model    ? model.slice(0, 18)    : '─';

  return (
    <Box borderStyle="single" borderColor="gray" paddingX={1} justifyContent="space-between">
      <Box gap={1}>
        <Text color="gray">{dot}</Text>
        <Text color="cyan">{prov}</Text>
        <Text dimColor>{'/'}</Text>
        <Text color="white">{mdl}</Text>
        {tokens !== undefined && tokens > 0 && (
          <>
            <Text dimColor>{'·'}</Text>
            <Text dimColor>{'~' + String(tokens) + 'tok'}</Text>
          </>
        )}
        {latency !== undefined && (
          <>
            <Text dimColor>{'·'}</Text>
            <Text color="greenBright" dimColor>{String(latency) + 'ms'}</Text>
          </>
        )}
        {messageCount !== undefined && messageCount > 0 && (
          <>
            <Text dimColor>{'·'}</Text>
            <Text dimColor>{String(messageCount) + ' msgs'}</Text>
          </>
        )}
      </Box>
      <Box gap={1}>
        <Text color="cyan">{'[/]'}</Text>
        <Text dimColor>{'settings'}</Text>
        <Text dimColor>{'·'}</Text>
        <Text dimColor>{'[^C] quit'}</Text>
      </Box>
    </Box>
  );
}
