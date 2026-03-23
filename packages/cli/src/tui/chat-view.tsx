/**
 * Chat panel — polished, minimal message display.
 * TTE effects play externally; content here is final plain text.
 * No internal timers.
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

function hhmm(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes()]
    .map(n => String(n).padStart(2, '0'))
    .join(':');
}

// ── Message bubbles ───────────────────────────────────────────────────────────

function UserMsg({ m }: { m: Message }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1} paddingX={2}>
      <Box gap={2} marginBottom={0}>
        <Text color="green" bold>you</Text>
        <Text color="gray" dimColor>{hhmm()}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text wrap="wrap">{m.content}</Text>
      </Box>
    </Box>
  );
}

function AiMsg({ m, model }: { m: Message; model?: string }): React.ReactElement {
  const label = (model ?? 'spaz').slice(0, 28);
  return (
    <Box flexDirection="column" marginBottom={1} paddingX={2}>
      <Box gap={2} marginBottom={0}>
        <Text color="cyan" bold>{label}</Text>
        <Text color="gray" dimColor>{hhmm()}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text wrap="wrap" color="white">{m.content}</Text>
      </Box>
    </Box>
  );
}

function ErrMsg({ m }: { m: Message }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1} paddingX={2}>
      <Box gap={2} marginBottom={0}>
        <Text color="red" bold>error</Text>
        <Text color="gray" dimColor>{hhmm()}</Text>
      </Box>
      <Box paddingLeft={2}>
        <Text wrap="wrap" color="red" dimColor>{m.content}</Text>
      </Box>
    </Box>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

const HINTS: [string, string][] = [
  ['tab',          'switch model'],
  ['^L',           'toggle local'],
  ['^R',           'reset chat'],
  ['@path/to/file','inject file'],
  ['/save',        'save chat'],
  ['/load <name>', 'load chat'],
  ['/run <cmd>',   'run command'],
];

function EmptyState(): React.ReactElement {
  return (
    <Box flexDirection="column" paddingX={4} paddingTop={2} gap={0}>
      <Box marginBottom={1}>
        <Text color="white" bold>good ai code for u</Text>
      </Box>
      {HINTS.map(([key, desc]) => (
        <Box key={key} gap={0}>
          <Text color="cyan">{key.padEnd(20)}</Text>
          <Text dimColor>{desc}</Text>
        </Box>
      ))}
    </Box>
  );
}

// ── Spinner ───────────────────────────────────────────────────────────────────

const FRAMES = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'] as const;

// ── Main component ────────────────────────────────────────────────────────────

export function ChatView({
  messages,
  streaming,
  input,
  onChangeInput,
  onSend,
  model,
  spinChar,
}: ChatViewProps): React.ReactElement {
  const termRows  = process.stdout.rows ?? 24;
  const termCols  = process.stdout.columns ?? 80;

  // Reserve rows: topbar (2) + input area (3) = 5; each message ~3 rows
  const maxVisible = Math.max(2, Math.floor((termRows - 5) / 3));
  const visible = messages.slice(-maxVisible);

  const frame = (FRAMES as readonly string[]).includes(spinChar)
    ? spinChar
    : '⠋';

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* ── Message area ─────────────────────────────────────────────────── */}
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        {messages.length === 0 && !streaming && <EmptyState />}

        {visible.map((m, i) => {
          if (m.role === 'user')  return <UserMsg key={`u${i}`} m={m} />;
          if (m.role === 'error') return <ErrMsg  key={`e${i}`} m={m} />;
          return                         <AiMsg   key={`a${i}`} m={m} model={model} />;
        })}

        {streaming && (
          <Box paddingX={4} gap={1} marginBottom={1}>
            <Text color="cyan">{frame}</Text>
            <Text dimColor>thinking</Text>
          </Box>
        )}
      </Box>

      {/* ── Input ────────────────────────────────────────────────────────── */}
      <Box paddingX={2} paddingBottom={1}>
        <Text dimColor>{'─'.repeat(termCols - 4)}</Text>
      </Box>
      <Box paddingX={4} paddingBottom={1}>
        <Text color="cyan">{'› '}</Text>
        <TextInput
          value={input}
          onChange={onChangeInput}
          onSubmit={onSend}
          placeholder="ask anything..."
        />
      </Box>
    </Box>
  );
}
