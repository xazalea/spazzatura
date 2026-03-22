/**
 * Boot screen — ASCII art logo with progress bar.
 * Receives animTick/spinChar from root — no internal timers.
 */

import React from 'react';
import { Box, Text } from 'ink';

const LOGO: string[] = [
  '  ┌─────────────────────────────────────────────────────┐',
  '  │                                                     │',
  '  │       ██  █                                         │',
  '  │ ███  ██   █     good ai code for u                  │',
  '  │ ██   ██  █                                          │',
  '  │   ███████   ██                          ███         │',
  '  │       ███  ███   ████████  ████████████ ████ ██     │',
  '  │ ████████  ███  ███  ██████  ██   ████  ██   ██      │',
  '  │ ███   ██  ██   ██   ██  ██  ██   ███   ██   ██      │',
  '  │  █   ██   ████ ████  ██  █ ████  ████  ████         │',
  '  │                                                     │',
  '  └─────────────────────────────────────────────────────┘',
];

const COLORS = ['cyan', 'white', 'blue', 'cyan', 'magenta', 'white'] as const;
type C = (typeof COLORS)[number];

export interface BootEntry {
  label: string;
  status: 'pending' | 'running' | 'ok' | 'fail' | 'skip';
  detail?: string;
}

export interface BootScreenProps {
  entries: BootEntry[];
  done: boolean;
  animTick: number;
  spinChar: string;
}

function Icon({ s }: { s: BootEntry['status'] }): React.ReactElement {
  if (s === 'ok')      return <Text color="greenBright">✓</Text>;
  if (s === 'fail')    return <Text color="red">✗</Text>;
  if (s === 'skip')    return <Text color="gray">─</Text>;
  if (s === 'running') return <Text color="yellow">◌</Text>;
  return <Text dimColor>·</Text>;
}

export function BootScreen({ entries, done, animTick, spinChar }: BootScreenProps): React.ReactElement {
  const lc: C = COLORS[animTick % COLORS.length] ?? 'cyan';
  const bc: C = COLORS[(animTick + 3) % COLORS.length] ?? 'white';

  const total = entries.length;
  const doneN = entries.filter(e => e.status === 'ok' || e.status === 'skip').length;
  const bw = 38;
  const filled = total > 0 ? Math.round((doneN / total) * bw) : 0;
  const bar = '█'.repeat(filled) + '░'.repeat(bw - filled);
  const pct = total > 0 ? Math.round((doneN / total) * 100) : 0;

  return (
    <Box flexDirection="column" alignItems="center" paddingY={1}>
      {LOGO.map((line, i) => (
        <Text key={i} color={i === 0 || i === LOGO.length - 1 ? 'gray' : lc} bold={i > 1 && i < LOGO.length - 1}>{line}</Text>
      ))}

      <Box marginTop={1} flexDirection="column" alignItems="center">
        <Text color={done ? 'greenBright' : 'yellow'}>
          {done ? '  ✓  ready' : `  ${spinChar}  initializing`}
        </Text>
        <Text color={done ? 'greenBright' : bc}>{`  [${bar}] ${pct}%`}</Text>
      </Box>

      <Box flexDirection="column" marginTop={1} paddingX={6}>
        {entries.map((e, i) => (
          <Box key={i}>
            <Icon s={e.status} />
            <Text>{'  '}</Text>
            <Text
              color={e.status === 'ok' ? 'greenBright' : e.status === 'running' ? 'white' : 'gray'}
              bold={e.status === 'running'}
            >{e.label.padEnd(24)}</Text>
            {e.detail ? <Text dimColor>{e.detail}</Text> : null}
          </Box>
        ))}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>  [Esc] skip  ·  [^C] quit</Text>
      </Box>
    </Box>
  );
}
