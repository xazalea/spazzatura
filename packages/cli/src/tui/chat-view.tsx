/**
 * Chat panel — clean message rendering with no internal timers.
 * TTE effects have already played before messages are added here,
 * so content is always rendered as plain text.
 */

import React from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import type { Message } from './app.js';

export interface ChatViewProps {
  readonly messages: Message[];
  readonly streaming: boolean;
  readonly input: string;
  readonly onChangeInput: (value: string) => void;
  readonly onSend: (text: string) => void;
  readonly model?: string;
  readonly provider?: string;
  readonly spinChar: string;
}

function ts(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

function UserMsg({ m }: { m: Message }): React.ReactElement {
  const cols = process.stdout.columns ?? 80;
  const bar = '─'.repeat(Math.min(cols - 12, 60));
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={2}>
        <Text color="green" bold>{'▸ you'}</Text>
        <Text dimColor>{ts()}</Text>
        <Text dimColor>{bar}</Text>
      </Box>
      <Box paddingLeft={4}>
        <Text wrap="wrap">{m.content}</Text>
      </Box>
    </Box>
  );
}

function AiMsg({ m, model, provider }: { m: Message; model?: string; provider?: string }): React.ReactElement {
  const tag = model ?? provider ?? 'spaz';
  const cols = process.stdout.columns ?? 80;
  const bar = '─'.repeat(Math.max(0, Math.min(cols - tag.length - 14, 60)));
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={2}>
        <Text color="cyan" bold>{'◈ ' + tag.slice(0, 20)}</Text>
        <Text dimColor>{ts()}</Text>
        <Text dimColor>{bar}</Text>
      </Box>
      <Box paddingLeft={4} flexDirection="column">
        <Text wrap="wrap" color="white">{m.content}</Text>
      </Box>
    </Box>
  );
}

function ErrMsg({ m }: { m: Message }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box gap={2}>
        <Text color="red" bold>{'✗ error'}</Text>
        <Text dimColor>{ts()}</Text>
      </Box>
      <Box paddingLeft={4}>
        <Text color="red" wrap="wrap">{m.content}</Text>
      </Box>
    </Box>
  );
}

const HELP_LINES = [
  ['/', 'settings & model browser'],
  ['@file.ts', 'inject file into context'],
  ['/save [name]', 'save conversation'],
  ['/load <name>', 'load conversation'],
  ['/run <cmd>', 'run shell command'],
  ['^R', 'reset conversation'],
];

function Welcome(): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1} marginLeft={2}>
      <Text color="cyan" bold>{'  good ai code for u'}</Text>
      <Text>{' '}</Text>
      {HELP_LINES.map(([cmd, desc]) => (
        <Box key={cmd} gap={2}>
          <Text color="cyan">{('  ' + cmd).padEnd(18)}</Text>
          <Text dimColor>{desc}</Text>
        </Box>
      ))}
      <Text>{' '}</Text>
      <Text dimColor>{'  type below to start ─────────────'}</Text>
    </Box>
  );
}

const SPIN_FRAMES = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'] as const;

export function ChatView({ messages, streaming, input, onChangeInput, onSend, model, provider, spinChar }: ChatViewProps): React.ReactElement {
  const termRows = process.stdout.rows ?? 24;
  // Reserve rows: top bar (3) + ticker (1) + input (3) + padding (2)
  const availRows = Math.max(4, termRows - 9);
  // Rough heuristic: each message ~4 rows
  const maxMsgs = Math.max(2, Math.floor(availRows / 4));
  const visible = messages.slice(-maxMsgs);

  const frame = SPIN_FRAMES.find(f => f === spinChar) ?? '⠋';

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Message area */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} paddingTop={1} overflowY="hidden">
        {messages.length === 0 && !streaming && <Welcome />}
        {visible.map((m, i) => {
          if (m.role === 'user')  return <UserMsg key={`${i}-u`} m={m} />;
          if (m.role === 'error') return <ErrMsg  key={`${i}-e`} m={m} />;
          return <AiMsg key={`${i}-a`} m={m} model={model} provider={provider} />;
        })}
        {streaming && (
          <Box paddingLeft={4} marginBottom={1}>
            <Text color="yellow">{frame + ' '}</Text>
            <Text dimColor>{'buffering response...'}</Text>
          </Box>
        )}
      </Box>

      {/* Divider */}
      <Box paddingX={1}>
        <Text dimColor>{'─'.repeat(Math.max(0, (process.stdout.columns ?? 80) - 2))}</Text>
      </Box>

      {/* Input */}
      <Box paddingX={2} paddingY={0}>
        <Text color="cyan" bold>{'❯ '}</Text>
        <TextInput value={input} onChange={onChangeInput} onSubmit={onSend} />
      </Box>
    </Box>
  );
}
