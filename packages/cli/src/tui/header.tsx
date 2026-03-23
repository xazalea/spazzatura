/**
 * Header — ASCII art logo with slow color cycle.
 * Receives animTick from root App (no internal timers).
 */

import React from 'react';
import { Box, Text } from 'ink';

const LOGO: string[] = [
  '          ██  █                                        ',
  '  ███    ██   █                                        ',
  '  ██     ██  █                                         ',
  '    ███ █████    ██                        ███          ',
  '          ███   ███                       ███    ███   ',
  '████████  ███  ███████  ████████  ████████████ ████ ██ ',
  '███    █  ███  ████ ██  ██  ███   ████  ██  █ ▓██  ██ ',
  '██     █   ██  ███  ██  ██  ██    ██   ███  █  ██  ██ ',
  '██     █   ██  ██  ███  ██ ███    ██   ██      ██  ██ ',
  '█     ██   ██  ██ ████ ████  ██   ██  ████     ████   ',
  ' █   █     ██ ████  ██   █████    ████ ████    ████   ',
];

const SLOGAN = '  good ai code for u';

const COLORS = ['cyan', 'white', 'blue', 'magenta', 'cyan', 'white'] as const;
type C = (typeof COLORS)[number];

const TICKER =
  'Claude · GPT-4 · Qwen · GLM · MiniMax · Gemini · DeepSeek · Kimi · Grok · free & open · ';

export interface HeaderProps {
  readonly animTick: number;
  readonly tickerPos: number;
  readonly streaming: boolean;
  readonly spinChar: string;
  readonly providerLabel?: string;
}

export function Header({ animTick, tickerPos, streaming, spinChar, providerLabel }: HeaderProps): React.ReactElement {
  const c: C = COLORS[animTick % COLORS.length] ?? 'cyan';
  const c2: C = COLORS[(animTick + 2) % COLORS.length] ?? 'white';

  const doubled = TICKER + TICKER;
  const tickerSlice = doubled.slice(tickerPos % TICKER.length, (tickerPos % TICKER.length) + 62);

  const badge = streaming
    ? `${spinChar} buffering...`
    : `● ${(providerLabel ?? 'ready').slice(0, 16)}`;

  return (
    <Box flexDirection="column" borderStyle="single" borderColor="gray" paddingX={1}>
      {LOGO.map((line, i) => (
        <Text key={i} color={c} bold={i >= 3}>{line}</Text>
      ))}
      <Box justifyContent="space-between">
        <Text color={c2} bold>{SLOGAN}</Text>
        <Text color={streaming ? 'yellow' : 'greenBright'}>{badge}</Text>
      </Box>
      <Text dimColor>{'  ' + tickerSlice}</Text>
    </Box>
  );
}
