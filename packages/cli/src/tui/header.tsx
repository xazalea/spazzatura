/**
 * Top bar — compact single-row chrome replacing the old tall ASCII logo header.
 * Minimal, information-dense, no wasted lines.
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface HeaderProps {
  readonly animTick: number;
  readonly tickerPos: number;
  readonly streaming: boolean;
  readonly spinChar: string;
  readonly providerLabel?: string;
  readonly model?: string;
  readonly tokens?: number;
  readonly messageCount?: number;
  readonly ollamaActive?: boolean;
}

const SPIN_STATES = ['◐', '◓', '◑', '◒'] as const;
const PULSE = ['◈', '◇', '◆', '◇'] as const;

const TICKER = 'Claude · GPT-4 · Qwen · GLM · Gemini · DeepSeek · Kimi · Grok · free & open  ';

export function Header({
  animTick,
  tickerPos,
  streaming,
  spinChar: _spinChar,
  providerLabel,
  model,
  tokens,
  messageCount,
  ollamaActive,
}: HeaderProps): React.ReactElement {
  const pulse = PULSE[animTick % PULSE.length] ?? '◈';
  const spin = SPIN_STATES[animTick % SPIN_STATES.length] ?? '◐';
  const prov = (providerLabel ?? 'auto').slice(0, 12);
  const mdl = model ? model.slice(0, 18) : undefined;
  const cols = process.stdout.columns ?? 80;

  const doubled = TICKER + TICKER;
  const tickerSlice = doubled.slice(tickerPos % TICKER.length, (tickerPos % TICKER.length) + Math.max(20, cols - 50));

  return (
    <Box flexDirection="column">
      {/* Main top bar */}
      <Box paddingX={1} justifyContent="space-between" borderStyle="single" borderColor="gray">
        <Box gap={1}>
          <Text color="cyan" bold>{pulse + ' spaz'}</Text>
          <Text dimColor>{'·'}</Text>
          <Text color={streaming ? 'yellow' : 'greenBright'}>{prov}</Text>
          {mdl && <><Text dimColor>/</Text><Text color="white">{mdl}</Text></>}
          {tokens !== undefined && tokens > 0 && <Text dimColor>{'· ~' + tokens + 'tok'}</Text>}
          {messageCount !== undefined && messageCount > 0 && <Text dimColor>{'· ' + messageCount + 'm'}</Text>}
          {ollamaActive && <Text color="magenta" dimColor>{'· 🦙'}</Text>}
        </Box>
        <Box gap={1}>
          {streaming && <Text color="yellow">{spin + ' thinking'}</Text>}
          {!streaming && <Text dimColor>{'good ai code for u'}</Text>}
          <Text dimColor>{'·'}</Text>
          <Text color="cyan">{'[/]'}</Text>
          <Text dimColor>{'[^R] [^C]'}</Text>
        </Box>
      </Box>
      {/* Scrolling ticker */}
      <Box paddingX={2}>
        <Text dimColor>{tickerSlice}</Text>
      </Box>
    </Box>
  );
}
