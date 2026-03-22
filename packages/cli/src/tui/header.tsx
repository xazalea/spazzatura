/**
 * Animated ASCII art header for Spazzatura TUI.
 * Color-cycles through a gradient every 150ms.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const LOGO_LINES = [
  ' ╔═╗╔═╗╔═╗╔═╗╔═╗╔═╗╔╦╗╦ ╦╦═╗╔═╗',
  ' ╚═╗╠═╝╠═╣╔═╝╔═╣╠═╣ ║ ║ ║╠╦╝╠═╣',
  ' ╚═╝╩  ╩ ╩╚═╝╚═╝╩ ╩ ╩ ╚═╝╩╚═╩ ╩',
];

const TAGLINE = ' ◈ the free frontier AI coding assistant ◈';

const COLORS = ['magenta', 'cyan', 'blue', 'greenBright', 'white', 'cyan', 'magenta'] as const;
type InkColor = (typeof COLORS)[number];

export interface HeaderProps {
  readonly streaming: boolean;
  readonly providerLabel?: string;
}

export function Header({ streaming, providerLabel }: HeaderProps): React.ReactElement {
  const [colorIdx, setColorIdx] = useState(0);
  const [spinIdx, setSpinIdx] = useState(0);

  // Color-cycle the logo
  useEffect(() => {
    const t = setInterval(() => {
      setColorIdx(i => (i + 1) % COLORS.length);
    }, 150);
    return () => clearInterval(t);
  }, []);

  // Spinner for streaming
  const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => {
      setSpinIdx(i => (i + 1) % SPINNER.length);
    }, 80);
    return () => clearInterval(t);
  }, [streaming]);

  const logoColor: InkColor = COLORS[colorIdx] ?? 'cyan';
  const tagColor: InkColor = COLORS[(colorIdx + 2) % COLORS.length] ?? 'magenta';

  const badge = streaming
    ? <Text color="red" bold>{' [' + SPINNER[spinIdx] + ' LIVE]'}</Text>
    : <Text color="greenBright" bold>{' [READY ◈]'}</Text>;

  const providerBit = providerLabel
    ? <Text dimColor>{'  via ' + providerLabel}</Text>
    : null;

  return (
    <Box flexDirection="column" borderStyle="double" paddingX={1}>
      {LOGO_LINES.map((line, i) => (
        <Text key={'logo-' + i} color={logoColor} bold>{line}</Text>
      ))}
      <Box>
        <Text color={tagColor}>{TAGLINE}</Text>
        {badge}
        {providerBit}
      </Box>
    </Box>
  );
}
