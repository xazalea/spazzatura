/**
 * Help overlay — ASCII art decorated keyboard shortcut reference.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';

const MINI_LOGO = [
  ' ╔═╗╔═╗╔═╗╔═╗╔═╗╔═╗╔╦╗╦ ╦╦═╗╔═╗',
  ' ╚═╗╠═╝╠═╣╔═╝╔═╣╠═╣ ║ ║ ║╠╦╝╠═╣',
  ' ╚═╝╩  ╩ ╩╚═╝╚═╝╩ ╩ ╩ ╚═╝╩╚═╩ ╩',
];

const DIVIDER = '  ══════════════════════════════════════  ';

interface Row { key: string; desc: string }

const NAV: Row[] = [
  { key: '[?]', desc: 'Toggle this help' },
  { key: '[Esc]', desc: 'Close overlay' },
  { key: '[^L]', desc: 'Clear screen' },
];

const CHAT: Row[] = [
  { key: '[Enter]', desc: 'Send message' },
  { key: '[^R]', desc: 'New conversation' },
  { key: '[^C]', desc: 'Quit' },
];

const CMDS: Row[] = [
  { key: '/clear', desc: 'Clear chat history' },
  { key: '/run <cmd>', desc: 'Execute shell command' },
  { key: '/save [name]', desc: 'Save conversation' },
  { key: '/load <name>', desc: 'Load conversation' },
  { key: '/model <m>', desc: 'Switch model' },
  { key: '/auth', desc: 'Re-authenticate providers' },
  { key: '/exit', desc: 'Quit the application' },
];

const CONTEXT: Row[] = [
  { key: '@<filepath>', desc: 'Inject file content into message' },
  { key: '@.', desc: 'Inject all files in current dir' },
];

const COLORS = ['cyan', 'magenta', 'blue', 'cyan'] as const;

function Section({ title, rows }: { title: string; rows: Row[] }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">{title}</Text>
      <Text color="gray">{DIVIDER.slice(0, 36)}</Text>
      {rows.map((r, i) => (
        <Box key={'row-' + title + '-' + i}>
          <Box width={16}><Text color="yellow" bold>{r.key}</Text></Box>
          <Text color="white">{r.desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

export interface HelpOverlayProps {
  readonly onClose: () => void;
}

export function HelpOverlay({ onClose: _onClose }: HelpOverlayProps): React.ReactElement {
  const [colorIdx, setColorIdx] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setColorIdx(i => (i + 1) % COLORS.length), 300);
    return () => clearInterval(t);
  }, []);

  const logoColor = COLORS[colorIdx] ?? 'cyan';

  return (
    <Box flexDirection="column" borderStyle="double" borderColor="cyan" paddingX={2} paddingY={1} alignSelf="center">
      {/* Animated logo */}
      {MINI_LOGO.map((line, i) => (
        <Text key={'help-logo-' + i} color={logoColor} bold>{line}</Text>
      ))}
      <Box marginBottom={1} justifyContent="center">
        <Text dimColor>{'◈ keyboard shortcuts & commands ◈'}</Text>
      </Box>

      <Text color="gray">{DIVIDER}</Text>

      <Box flexDirection="row" gap={3}>
        <Box flexDirection="column" width={40}>
          <Section title="Navigation" rows={NAV} />
          <Section title="Chat" rows={CHAT} />
        </Box>
        <Box flexDirection="column" width={44}>
          <Section title="Commands" rows={CMDS} />
          <Section title="Context Injection" rows={CONTEXT} />
        </Box>
      </Box>

      <Text color="gray">{DIVIDER}</Text>
      <Box justifyContent="center" marginTop={1}>
        <Text dimColor>Press </Text>
        <Text color="yellow" bold>[Esc]</Text>
        <Text dimColor> or </Text>
        <Text color="yellow" bold>[?]</Text>
        <Text dimColor> to close</Text>
      </Box>
    </Box>
  );
}
