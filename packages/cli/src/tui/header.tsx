/**
 * Animated ASCII art header for Spazzatura TUI.
 * Color-cycles through a gradient with scrolling marquee ticker.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const LOGO_LINES = [
  '  ╔═══╗╔═══╗╔═══╗╔═══╗╔═══╗╔═══╗╔════╗╦   ╦╦═══╗╔═══╗',
  '  ╚═══╗╠═══╝╠═══╣╔═══╝╔═══╣╠═══╣ ║   ║╠   ╣╠══╦╝╠═══╣',
  '  ╚═══╝╩   ╩╩   ╩╚═══╝╚═══╝╩   ╩ ╩   ╩╚═══╝╩  ╚═╩   ╩',
];

const TAGLINE = '  ◈  F R E E   F R O N T I E R   A I  ◈';

const TICKER_MSG =
  '  Claude · GPT-4 · GLM · MiniMax · Qwen · Gemini · DeepSeek · Kimi · Free · Open · Unstoppable  ';

const COLORS = ['magenta', 'cyan', 'blue', 'greenBright', 'white', 'cyan', 'magenta'] as const;
type InkColor = (typeof COLORS)[number];

const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

export interface HeaderProps {
  readonly streaming: boolean;
  readonly providerLabel?: string;
}

export function Header({ streaming, providerLabel }: HeaderProps): React.ReactElement {
  const [colorIdx, setColorIdx] = useState(0);
  const [spinIdx, setSpinIdx] = useState(0);
  const [tickerPos, setTickerPos] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setColorIdx(i => (i + 1) % COLORS.length), 150);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => setSpinIdx(i => (i + 1) % SPINNER.length), 80);
    return () => clearInterval(t);
  }, [streaming]);

  useEffect(() => {
    const t = setInterval(() => setTickerPos(p => (p + 1) % TICKER_MSG.length), 120);
    return () => clearInterval(t);
  }, []);

  const logoColor: InkColor = COLORS[colorIdx] ?? 'cyan';
  const tagColor: InkColor = COLORS[(colorIdx + 2) % COLORS.length] ?? 'magenta';
  const accentColor: InkColor = COLORS[(colorIdx + 4) % COLORS.length] ?? 'white';

  // Scrolling ticker: duplicate string so we can slice cleanly
  const doubled = TICKER_MSG + TICKER_MSG;
  const ticker = doubled.slice(tickerPos, tickerPos + 58);

  const badge = streaming
    ? <Text color="red" bold>{' [' + SPINNER[spinIdx] + ' LIVE]'}</Text>
    : <Text color="greenBright" bold>{' [● READY]'}</Text>;

  const providerBit = providerLabel
    ? <Text dimColor>{'  via ' + providerLabel}</Text>
    : null;

  return (
    <Box flexDirection="column" borderStyle="double" paddingX={1}>
      {LOGO_LINES.map((line, i) => (
        <Text key={'logo-' + i} color={logoColor} bold>{line}</Text>
      ))}
      <Box>
        <Text color={tagColor} bold>{TAGLINE}</Text>
        {badge}
        {providerBit}
      </Box>
      <Text color={accentColor} dimColor>{'  ' + ticker}</Text>
    </Box>
  );
}
