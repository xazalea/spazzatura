/**
 * Chat panel — ┤ role  HH:MM ├── message headers, ASCII welcome screen.
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
  readonly animTick: number;
}

function hhmm(): string {
  const d = new Date();
  return [d.getHours(), d.getMinutes()].map(n => String(n).padStart(2, '0')).join(':');
}

function MsgHeader({ label, color, cols }: { label: string; color: string; cols: number }): React.ReactElement {
  // ┤ label  HH:MM ├────
  const time = hhmm();
  const inner = ` ${label}  ${time} `;
  const lineLen = Math.max(0, cols - inner.length - 4);
  return (
    <Box>
      <Text dimColor>{'  ┤ '}</Text>
      <Text color={color as string} bold>{label}</Text>
      <Text dimColor>{'  ' + time + ' ├'}</Text>
      <Text dimColor>{'─'.repeat(Math.max(0, lineLen))}</Text>
    </Box>
  );
}

function UserMsg({ m, cols }: { m: Message; cols: number }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <MsgHeader label="you" color="green" cols={cols} />
      <Box paddingLeft={4}>
        <Text wrap="wrap">{m.content}</Text>
      </Box>
    </Box>
  );
}

function AiMsg({ m, model, cols }: { m: Message; model?: string; cols: number }): React.ReactElement {
  const label = (model ?? 'spaz').slice(0, 24);
  return (
    <Box flexDirection="column" marginBottom={1}>
      <MsgHeader label={label} color="cyan" cols={cols} />
      <Box paddingLeft={4}>
        <Text wrap="wrap" color="white">{m.content}</Text>
      </Box>
    </Box>
  );
}

function ErrMsg({ m, cols }: { m: Message; cols: number }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1}>
      <MsgHeader label="error" color="red" cols={cols} />
      <Box paddingLeft={4}>
        <Text wrap="wrap" color="red" dimColor>{m.content}</Text>
      </Box>
    </Box>
  );
}

// ── Welcome screen ────────────────────────────────────────────────────────────

const LOGO_COLORS = ['cyan', 'cyanBright', 'blueBright', 'white', 'cyan'] as const;
const LOGO_LETTERS = ['S', 'P', 'A', 'Z'] as const;

const HINTS: [string, string][] = [
  ['[tab]',         'switch model'],
  ['[@file]',       'inject file'],
  ['[^L]',          'toggle local'],
  ['[^R]',          'reset chat'],
  ['[^C]',          'quit'],
  ['[/save]',       'save chat'],
];

function WelcomeScreen({ animTick, cols }: { animTick: number; cols: number }): React.ReactElement {
  const lineW = Math.min(cols - 8, 60);
  return (
    <Box flexDirection="column" paddingX={4} paddingTop={2}>
      {/* Animated logo */}
      <Box marginBottom={1} gap={0}>
        {LOGO_LETTERS.map((l, i) => (
          <Text key={l} color={LOGO_COLORS[(animTick + i) % LOGO_COLORS.length] as string} bold>
            {i > 0 ? ' ░ ' + l : '░ ' + l}
          </Text>
        ))}
        <Text bold> ░</Text>
        <Text dimColor>{'     free ai, no limits'}</Text>
      </Box>

      <Box marginBottom={1}>
        <Text dimColor>{'─'.repeat(lineW)}</Text>
      </Box>

      {/* Hints in 2 columns */}
      <Box flexDirection="column">
        {HINTS.map(([key, desc]) => (
          <Box key={key} gap={0}>
            <Text color="cyan">{key.padEnd(12)}</Text>
            <Text dimColor>{'  ' + desc}</Text>
          </Box>
        ))}
      </Box>
    </Box>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function ChatView({
  messages,
  streaming,
  input,
  onChangeInput,
  onSend,
  model,
  spinChar,
  animTick,
}: ChatViewProps): React.ReactElement {
  const termRows = process.stdout.rows ?? 24;
  const cols = process.stdout.columns ?? 80;

  const maxVisible = Math.max(2, Math.floor((termRows - 7) / 4));
  const visible = messages.slice(-maxVisible);

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* ── Message area ──────────────────────────────────────────────────── */}
      <Box flexDirection="column" flexGrow={1} overflowY="hidden">
        {messages.length === 0 && !streaming && (
          <WelcomeScreen animTick={animTick} cols={cols} />
        )}

        {visible.map((m, i) => {
          if (m.role === 'user')  return <UserMsg  key={`u${i}`} m={m} cols={cols} />;
          if (m.role === 'error') return <ErrMsg   key={`e${i}`} m={m} cols={cols} />;
          return                         <AiMsg    key={`a${i}`} m={m} model={model} cols={cols} />;
        })}

        {streaming && (
          <Box paddingLeft={4} gap={1} marginBottom={1}>
            <Text color="cyan">{spinChar}</Text>
            <Text dimColor>thinking</Text>
          </Box>
        )}
      </Box>

      {/* ── Input ─────────────────────────────────────────────────────────── */}
      <Box paddingX={2}>
        <Text dimColor>{'─'.repeat(cols - 4)}</Text>
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
