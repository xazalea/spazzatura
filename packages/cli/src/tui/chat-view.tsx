/**
 * Chat panel — minimal, professional message bubbles with ASCII borders.
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

const SPINNER = '⠋⠙⠹⠸⠼⠴⠦⠧⠇⠏';

function Timestamp(): React.ReactElement {
  const d = new Date();
  const t = [d.getHours(), d.getMinutes(), d.getSeconds()]
    .map(n => String(n).padStart(2, '0')).join(':');
  return <Text dimColor>{t}</Text>;
}
const TS = React.memo(Timestamp);

function UserBubble({ m }: { m: Message }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      <Box>
        <Text color="green" bold>{'▸ you  '}</Text>
        <TS />
      </Box>
      <Box paddingLeft={2}>
        <Text color="gray">{'│ '}</Text>
        <Text wrap="wrap">{m.content}</Text>
      </Box>
    </Box>
  );
}

function AssistantBubble({ m, model }: { m: Message; model?: string }): React.ReactElement {
  const tag = model ? model.slice(0, 18) : 'spaz';
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      <Box>
        <Text color="cyan" bold>{'◈ ' + tag + '  '}</Text>
        <TS />
      </Box>
      <Box paddingLeft={2} flexDirection="column">
        <Text color="gray">{'│ '}</Text>
        <Markdown content={m.content} />
      </Box>
    </Box>
  );
}

function ErrorBubble({ m }: { m: Message }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={2}>
      <Text color="red" bold>{'✗ error'}</Text>
      <Box paddingLeft={2}>
        <Text color="red" wrap="wrap">{m.content}</Text>
      </Box>
    </Box>
  );
}

// Minimal animated welcome panel
const WELCOME = [
  '  ┌──────────────────────────────────────────────┐',
  '  │  S P A Z Z A T U R A                        │',
  '  │  Free Frontier AI                           │',
  '  ├──────────────────────────────────────────────┤',
  '  │  /           settings & model browser       │',
  '  │  @file.ts    inject file into message       │',
  '  │  /save       save conversation              │',
  '  │  /load name  load conversation              │',
  '  │  ^R          reset conversation             │',
  '  │  ^C          quit                           │',
  '  └──────────────────────────────────────────────┘',
];

const WCOLORS = ['cyan', 'white', 'gray', 'cyan'] as const;
type WC = (typeof WCOLORS)[number];

function WelcomeScreen(): React.ReactElement {
  const [idx, setIdx] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setIdx(i => (i + 1) % WCOLORS.length), 1200);
    return () => clearInterval(t);
  }, []);
  const c: WC = WCOLORS[idx] ?? 'cyan';
  return (
    <Box flexDirection="column" marginTop={1}>
      {WELCOME.map((line, i) => (
        <Text key={i} color={i === 0 || i === WELCOME.length - 1 || i === 3 ? 'gray' : c}>{line}</Text>
      ))}
    </Box>
  );
}

export function ChatView({ messages, streaming, input, onChangeInput, onSend, model }: ChatViewProps): React.ReactElement {
  const [spinIdx, setSpinIdx] = useState(0);
  useEffect(() => {
    if (!streaming) return;
    const t = setInterval(() => setSpinIdx(i => (i + 1) % SPINNER.length), 80);
    return () => clearInterval(t);
  }, [streaming]);

  const termRows = process.stdout.rows ?? 24;
  const visibleRows = Math.max(4, termRows - 14);
  const visible = messages.slice(-Math.max(Math.floor(visibleRows / 5), 3));

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflowY="hidden">
        {messages.length === 0 && !streaming && <WelcomeScreen />}
        {visible.map((m, i) => {
          if (m.role === 'user')      return <UserBubble      key={`msg-${i}-${m.role}`} m={m} />;
          if (m.role === 'error')     return <ErrorBubble     key={`msg-${i}-${m.role}`} m={m} />;
          return                             <AssistantBubble key={`msg-${i}-${m.role}`} m={m} model={model} />;
        })}
        {streaming && (
          <Box paddingLeft={4} marginBottom={1}>
            <Text color="cyan">{(SPINNER[spinIdx] ?? '⠋') + '  thinking'}</Text>
            <Text dimColor>{'...'}</Text>
          </Box>
        )}
      </Box>

      <Box borderStyle="single" borderColor="cyan" paddingX={1} marginX={1}>
        <Text color="cyan" bold>{'❯ '}</Text>
        <TextInput value={input} onChange={onChangeInput} onSubmit={onSend} />
      </Box>
    </Box>
  );
}
