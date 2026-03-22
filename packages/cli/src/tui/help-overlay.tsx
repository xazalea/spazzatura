/**
 * Help overlay — shown when user presses '?'. Centered box with keyboard shortcuts.
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface HelpOverlayProps {
  readonly onClose: () => void;
}

interface ShortcutRow {
  readonly key: string;
  readonly description: string;
}

const NAVIGATION_SHORTCUTS: ShortcutRow[] = [
  { key: 'Ctrl+L', description: 'Cycle layout' },
  { key: '?', description: 'Toggle this help' },
  { key: 'Esc', description: 'Close overlay' },
];

const CHAT_SHORTCUTS: ShortcutRow[] = [
  { key: 'Enter', description: 'Send message' },
  { key: 'Ctrl+R', description: 'New conversation (clear)' },
  { key: 'Ctrl+U', description: 'Clear input' },
  { key: 'Up / Down', description: 'Scroll history' },
];

const APP_SHORTCUTS: ShortcutRow[] = [
  { key: 'Ctrl+C / q', description: 'Quit' },
];

const COMMANDS: ShortcutRow[] = [
  { key: '/exit, /quit, /q', description: 'Quit the application' },
  { key: '/clear', description: 'Clear conversation' },
  { key: '/help', description: 'Show help message in chat' },
];

function ShortcutSection({
  title,
  rows,
}: {
  readonly title: string;
  readonly rows: ShortcutRow[];
}): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color="cyan">{title}</Text>
      {rows.map((row, i) => (
        <Box key={i}>
          <Box width={20}>
            <Text color="yellow">{row.key}</Text>
          </Box>
          <Text>{row.description}</Text>
        </Box>
      ))}
    </Box>
  );
}

export function HelpOverlay({ onClose: _onClose }: HelpOverlayProps): React.ReactElement {
  return (
    <Box
      flexDirection="column"
      borderStyle="double"
      paddingX={2}
      paddingY={1}
      alignSelf="center"
    >
      <Box marginBottom={1} justifyContent="center">
        <Text bold inverse>{'  Spazzatura Keyboard Shortcuts  '}</Text>
      </Box>

      <ShortcutSection title="Navigation" rows={NAVIGATION_SHORTCUTS} />
      <ShortcutSection title="Chat" rows={CHAT_SHORTCUTS} />
      <ShortcutSection title="Application" rows={APP_SHORTCUTS} />
      <ShortcutSection title="Commands" rows={COMMANDS} />

      <Box marginTop={1} justifyContent="center">
        <Text dimColor>Press Esc or ? to close</Text>
      </Box>
    </Box>
  );
}
