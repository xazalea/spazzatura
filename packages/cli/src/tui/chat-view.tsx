/**
 * Chat panel — styled message bubbles, code blocks, animated streaming.
 */

import React, { useState, useEffect } from 'react';
import { Box, Text } from 'ink';
import TextInput from 'ink-text-input';
import { Markdown } from './markdown.js';
import type { Message } from './app.js';

export interface ChatViewProps {
  readonly messages: Message[];
  readonly streaming: boolean;
  readonly input: string;
  readonly onChangeInput: (value: string) => void;
  readonly onSend: (text: string) => void;
  readonly provider?: string;
  readonly model?: string;
}

const SPINNER_CHARS = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

function Timestamp(): React.ReactElement {
  const now = new Date();
  const h = String(now.getHours()).padStart(2, '0');
  const m = String(now.getMinutes()).padStart(2, '0');
  const s = String(now.getSeconds()).padStart(2, '0');
  return <Text dimColor>{h + ':' + m + ':' + s}</Text>;
}

// Memoised timestamp so it doesn't re-tick on every render
const MemoTimestamp = React.memo(Timestamp);

function MessageBubble({ message, model }: { readonly message: Message; readonly model?: string }): React.ReactElement {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  const topBorder = '╭' + '─'.repeat(50) + '╮';
  const botBorder = '╰' + '─'.repeat(50) + '╯';

  if (isUser) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color="green" dimColor>{topBorder}</Text>
        <Box>
          <Text color="green" dimColor>{'│ '}</Text>
          <Text color="greenBright" bold>{'▶ YOU'}</Text>
          <Text>{'                                     '}</Text>
          <MemoTimestamp />
          <Text color="green" dimColor>{' │'}</Text>
        </Box>
        <Box>
          <Text color="green" dimColor>{'│ '}</Text>
          <Text wrap="wrap">{message.content}</Text>
          <Text color="green" dimColor>{' │'}</Text>
        </Box>
        <Text color="green" dimColor>{botBorder}</Text>
      </Box>
    );
  }

  if (isError) {
    return (
      <Box flexDirection="column" marginBottom={1}>
        <Text color="red" dimColor>{topBorder}</Text>
        <Box>
          <Text color="red" dimColor>{'│ '}</Text>
          <Text color="red" bold>{'✗ ERROR'}</Text>
          <Text color="red" dimColor>{' │'}</Text>
        </Box>
        <Box>
          <Text color="red" dimColor>{'│ '}</Text>
          <Text color="red" wrap="wrap">{message.content}</Text>
          <Text color="red" dimColor>{' │'}</Text>
        </Box>
        <Text color="red" dimColor>{botBorder}</Text>
      </Box>
    );
  }

  // Assistant
  const modelLabel = model ? ' [' + model.slice(0, 16) + ']' : '';
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text color="cyan" dimColor>{topBorder}</Text>
      <Box>
        <Text color="cyan" dimColor>{'│ '}</Text>
        <Text color="cyan" bold>{'◈ SPAZ'}</Text>
        <Text color="magenta">{modelLabel}</Text>
        <Text>{'                              '}</Text>
        <MemoTimestamp />
        <Text color="cyan" dimColor>{' │'}</Text>
      </Box>
      <Box paddingLeft={2} flexDirection="column">
        <Markdown content={message.content} />
      </Box>
      <Text color="cyan" dimColor>{botBorder}</Text>
    </Box>
  );
}

function StreamingRow({ spinIdx }: { readonly spinIdx: number }): React.ReactElement {
  const spin = SPINNER_CHARS[spinIdx % SPINNER_CHARS.length] ?? '⠋';
  return (
    <Box marginLeft={2} marginBottom={1}>
      <Text color="cyan">{spin + ' generating'}</Text>
      <Text color="cyan" dimColor>{'...'}</Text>
    </Box>
  );
}

// Welcome art shown when no messages
const WELCOME_LINES = [
  '  ┌─────────────────────────────────────────────────────┐',
  '  │                                                     │',
  '  │   ◈  Welcome to Spazzatura                         │',
  '  │                                                     │',
  '  │   Free frontier AI at your fingertips.             │',
  '  │                                                     │',
  '  │   Type a message to begin. Press [?] for help.     │',
  '  │                                                     │',
  '  │   @file.ts   — inject file context                 │',
  '  │   /run ls    — execute shell commands              │',
  '  │   /clear     — reset conversation                  │',
  '  │   /save      — save conversation                   │',
  '  │                                                     │',
  '  └─────────────────────────────────────────────────────┘',
];

function WelcomeScreen(): React.ReactElement {
  const [idx, setIdx] = useState(0);
  const COLORS = ['cyan', 'magenta', 'blue', 'cyan'] as const;

  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % COLORS.length), 800);
    return () => clearInterval(t);
  }, []);

  const c = COLORS[idx] ?? 'cyan';
  return (
    <Box flexDirection="column" marginTop={1}>
      {WELCOME_LINES.map((line, i) => (
        <Text key={'welcome-' + i} color={c}>{line}</Text>
      ))}
    </Box>
  );
}

export function ChatView({
  messages,
  streaming,
  input,
  onChangeInput,
  onSend,
  model,
}: ChatViewProps): React.ReactElement {
  const [spinIdx, setSpinIdx] = useState(0);

  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => setSpinIdx(i => (i + 1) % SPINNER_CHARS.length), 80);
    return () => clearInterval(t);
  }, [streaming]);

  const termRows = process.stdout.rows ?? 24;
  // Reserve: header(8) + input(3) + status(2) = ~13
  const visibleRows = Math.max(4, termRows - 13);
  const estimatedMsgsVisible = Math.floor(visibleRows / 5);
  const visibleMessages = messages.slice(-Math.max(estimatedMsgsVisible, 3));

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Messages */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflowY="hidden">
        {messages.length === 0 && !streaming && <WelcomeScreen />}
        {visibleMessages.map((m, i) => (
          <MessageBubble key={'msg-' + i + '-' + m.role} message={m} model={model} />
        ))}
        {streaming && <StreamingRow spinIdx={spinIdx} />}
      </Box>

      {/* Input */}
      <Box borderStyle="round" borderColor="cyan" paddingX={1} marginX={1}>
        <Text color="cyan" bold>{'❯ '}</Text>
        <TextInput
          value={input}
          onChange={onChangeInput}
          onSubmit={(v) => { onSend(v); }}
        />
      </Box>
    </Box>
  );
}
