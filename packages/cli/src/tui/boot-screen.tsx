/**
 * Boot screen — minimal, professional ASCII art with animated progress.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

// Compact block-letter logo
const LOGO = [
  '  ┌─────────────────────────────────────────────────────┐',
  '  │                                                     │',
  '  │   ░██████╗ ██████╗  █████╗ ███████╗███████╗        │',
  '  │   ██╔════╝ ██╔══██╗██╔══██╗╚══███╔╝╚══███╔╝        │',
  '  │   ╚█████╗  ██████╔╝███████║  ███╔╝   ███╔╝         │',
  '  │    ╚═══██╗ ██╔═══╝ ██╔══██║ ███╔╝   ███╔╝          │',
  '  │   ██████╔╝ ██║     ██║  ██║███████╗███████╗        │',
  '  │   ╚═════╝  ╚═╝     ╚═╝  ╚═╝╚══════╝╚══════╝        │',
  '  │                                                     │',
  '  │            F R E E   F R O N T I E R   A I         │',
  '  │                                                     │',
  '  └─────────────────────────────────────────────────────┘',
];

const COLORS = ['cyan', 'white', 'blue', 'cyan', 'magenta', 'white'] as const;
type C = (typeof COLORS)[number];
const SPIN = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

export interface BootEntry {
  label: string;
  status: 'pending' | 'running' | 'ok' | 'fail' | 'skip';
  detail?: string;
}

export interface BootScreenProps {
  entries: BootEntry[];
  done: boolean;
}

function StatusIcon({ s }: { s: BootEntry['status'] }): React.ReactElement {
  if (s === 'ok')      return <Text color="greenBright">{'✓'}</Text>;
  if (s === 'fail')    return <Text color="red">{'✗'}</Text>;
  if (s === 'skip')    return <Text color="gray">{'─'}</Text>;
  if (s === 'running') return <Text color="yellow">{'◌'}</Text>;
  return <Text dimColor>{'·'}</Text>;
}

export function BootScreen({ entries, done }: BootScreenProps): React.ReactElement {
  const [cIdx, setCIdx] = useState(0);
  const [spin, setSpin] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setCIdx(i => (i + 1) % COLORS.length), 300);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (done) return;
    const t = setInterval(() => setSpin(i => (i + 1) % SPIN.length), 80);
    return () => clearInterval(t);
  }, [done]);

  const lc: C = COLORS[cIdx] ?? 'cyan';
  const sc: C = COLORS[(cIdx + 3) % COLORS.length] ?? 'white';

  const total = entries.length;
  const doneCount = entries.filter(e => e.status === 'ok' || e.status === 'skip').length;
  const bw = 40;
  const filled = total > 0 ? Math.round((doneCount / total) * bw) : 0;
  const bar = '█'.repeat(filled) + '░'.repeat(bw - filled);
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0;

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      {LOGO.map((line, i) => (
        <Text key={i} color={i === 0 || i === LOGO.length - 1 ? 'gray' : lc} bold={i > 1 && i < LOGO.length - 2}>{line}</Text>
      ))}

      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text color={done ? 'greenBright' : 'yellow'}>
          {done ? '  ✓  READY' : `  ${SPIN[spin] ?? '⠋'}  INITIALIZING`}
        </Text>
        <Text color={done ? 'greenBright' : sc}>{`  [${bar}] ${pct}%`}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={4}>
        {entries.map((e, i) => (
          <Box key={i}>
            <StatusIcon s={e.status} />
            <Text>{'  '}</Text>
            <Text
              color={e.status === 'ok' ? 'greenBright' : e.status === 'running' ? 'white' : 'gray'}
              bold={e.status === 'running'}
            >
              {e.label.padEnd(26)}
            </Text>
            {e.detail ? <Text dimColor>{e.detail}</Text> : null}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>{'  press [Esc] to skip  ·  [^C] quit'}</Text>
      </Box>
    </Box>
  );
}
