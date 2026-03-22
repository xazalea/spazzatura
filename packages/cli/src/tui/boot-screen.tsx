/**
 * Boot screen — shown briefly while services and auth are initializing.
 * Full ASCII art with animated progress bars and service status.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const LOGO = [
  '  ╔═══╗╔═══╗╔═══╗╔═══╗╔═══╗╔═══╗╔════╗╦   ╦╦═══╗╔═══╗',
  '  ╚═══╗╠═══╝╠═══╣╔═══╝╔═══╣╠═══╣ ║   ║╠   ╣╠══╦╝╠═══╣',
  '  ╚═══╝╩   ╩╩   ╩╚═══╝╚═══╝╩   ╩ ╩   ╩╚═══╝╩  ╚═╩   ╩',
];

const TAGLINE = '  ◈  F R E E   F R O N T I E R   A I  ◈';

const COLORS = ['cyan', 'magenta', 'blue', 'greenBright', 'white', 'cyan'] as const;
type C = (typeof COLORS)[number];

export interface BootEntry {
  label: string;
  status: 'pending' | 'running' | 'ok' | 'fail' | 'skip';
  detail?: string;
}

export interface BootScreenProps {
  entries: BootEntry[];
  done: boolean;
}

function StatusIcon({ status }: { status: BootEntry['status'] }): React.ReactElement {
  switch (status) {
    case 'ok':   return <Text color="greenBright">{'✓'}</Text>;
    case 'fail': return <Text color="red">{'✗'}</Text>;
    case 'skip': return <Text color="gray">{'─'}</Text>;
    case 'running': return <Text color="yellow">{'◌'}</Text>;
    default:     return <Text color="gray">{'·'}</Text>;
  }
}

function StatusColor(status: BootEntry['status']): C {
  if (status === 'ok') return 'greenBright';
  if (status === 'fail') return 'cyan';
  if (status === 'running') return 'white';
  return 'gray';
}

export function BootScreen({ entries, done }: BootScreenProps): React.ReactElement {
  const [colorIdx, setColorIdx] = useState(0);
  const [spin, setSpin] = useState(0);
  const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

  useEffect(() => {
    const t = setInterval(() => setColorIdx(i => (i + 1) % COLORS.length), 120);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSpin(i => (i + 1) % SPIN.length), 80);
    return () => clearInterval(t);
  }, [done]);

  const logoColor = COLORS[colorIdx] ?? 'cyan';
  const accentColor = COLORS[(colorIdx + 2) % COLORS.length] ?? 'magenta';
  const spinChar = SPIN[spin] ?? '⠋';

  const total = entries.length;
  const done_count = entries.filter(e => e.status === 'ok' || e.status === 'skip').length;
  const barWidth = 40;
  const filled = total > 0 ? Math.round((done_count / total) * barWidth) : 0;
  const bar = '█'.repeat(filled) + '░'.repeat(barWidth - filled);
  const pct = total > 0 ? Math.round((done_count / total) * 100) : 0;

  return (
    <Box flexDirection="column" alignItems="center" justifyContent="center" paddingY={1}>
      {/* Animated logo */}
      <Box flexDirection="column" alignItems="center">
        {LOGO.map((line, i) => (
          <Text key={'boot-logo-' + i} color={logoColor} bold>{line}</Text>
        ))}
        <Text color={accentColor} bold>{TAGLINE}</Text>
      </Box>

      <Box marginY={1}>
        <Text color="gray">{'  ' + '═'.repeat(58) + '  '}</Text>
      </Box>

      {/* Progress bar */}
      <Box flexDirection="column" alignItems="center" marginBottom={1}>
        <Text color={done ? 'greenBright' : 'yellow'} bold>
          {done ? '  ✓  READY  ' : `  ${spinChar}  INITIALIZING  `}
        </Text>
        <Text color={done ? 'greenBright' : 'yellow'}>{`  [${bar}]  ${pct}%`}</Text>
      </Box>

      {/* Service list */}
      <Box flexDirection="column" paddingX={4}>
        {entries.map((e, i) => (
          <Box key={'boot-entry-' + i}>
            <StatusIcon status={e.status} />
            <Text>{'  '}</Text>
            <Text color={StatusColor(e.status)} bold={e.status === 'running'}>
              {e.label.padEnd(28)}
            </Text>
            {e.detail && <Text dimColor>{e.detail}</Text>}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{'  Type a message to start chatting  •  [/] settings  •  [^C] quit'}</Text>
      </Box>
    </Box>
  );
}
