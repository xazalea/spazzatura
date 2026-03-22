/**
 * Header — minimal animated ASCII wordmark + scrolling provider ticker.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// Compact single-line wordmark built from block chars
const WORDMARK = '  S P A Z Z A T U R A';
const DIVIDER  = '  ' + '─'.repeat(56);

const TICKER_CONTENT =
  'Claude  ·  GPT-4  ·  Qwen  ·  GLM  ·  MiniMax  ·  Gemini  ·  DeepSeek  ·  Kimi  ·  Free & Open  ·  ';

const COLORS = ['cyan', 'magenta', 'blue', 'white', 'cyan', 'magenta'] as const;
type C = (typeof COLORS)[number];
const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

export interface HeaderProps {
  readonly streaming: boolean;
  readonly providerLabel?: string;
}

export function Header({ streaming, providerLabel }: HeaderProps): React.ReactElement {
  const [cIdx, setCIdx] = useState(0);
  const [sIdx, setSIdx] = useState(0);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCIdx(i => (i + 1) % COLORS.length), 400);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => setSIdx(i => (i + 1) % SPINNER.length), 80);
    return () => clearInterval(t);
  }, [streaming]);

  useEffect(() => {
    const t = setInterval(() => setTick(p => (p + 1) % TICKER_CONTENT.length), 110);
    return () => clearInterval(t);
  }, []);

  const c: C = COLORS[cIdx] ?? 'cyan';
  const c2: C = COLORS[(cIdx + 2) % COLORS.length] ?? 'magenta';

  const doubled = TICKER_CONTENT + TICKER_CONTENT;
  const tickerSlice = doubled.slice(tick, tick + 58);

  const statusBadge = streaming
    ? `  ${SPINNER[sIdx] ?? '⠋'}  generating`
    : `  ●  ${providerLabel ?? 'ready'}`;

  return (
    <Box flexDirection="column" paddingX={1} borderStyle="single" borderColor="gray">
      <Box justifyContent="space-between">
        <Text color={c} bold>{WORDMARK}</Text>
        <Text color={streaming ? 'yellow' : 'greenBright'} dimColor={!streaming}>{statusBadge}</Text>
      </Box>
      <Text color={c2} dimColor>{'  ' + tickerSlice}</Text>
      <Text dimColor>{DIVIDER}</Text>
    </Box>
  );
}
