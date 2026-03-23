/**
 * Chat panel — message history + input.
 * TTE effects are played BEFORE messages are added here, so content is plain text.
 * No internal timers (uses root animTick/spinChar from props).
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
  readonly spinChar: string;
}

function Ts(): React.ReactElement {
  const d = new Date();
  return <Text dimColor>{[d.getHours(), d.getMinutes(), d.getSeconds()].map(n => String(n).padStart(2, '0')).join(':')}</Text>;
}
const MemoTs = React.memo(Ts);

function UserMsg({ m }: { m: Message }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Box gap={1}>
        <Text color="green" bold>▸ you</Text>
        <MemoTs />
      </Box>
      <Box paddingLeft={2}>
        <Text color="gray">│ </Text>
        <Text wrap="wrap">{m.content}</Text>
      </Box>
    </Box>
  );
}

function AiMsg({ m, model }: { m: Message; model?: string }): React.ReactElement {
  const tag = (model ?? 'spaz').slice(0, 20);
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Box gap={1}>
        <Text color="cyan" bold>{'◈ ' + tag}</Text>
        <MemoTs />
      </Box>
      <Box paddingLeft={2} flexDirection="column">
        <Text wrap="wrap" color="white">{m.content}</Text>
      </Box>
    </Box>
  );
}

function ErrMsg({ m }: { m: Message }): React.ReactElement {
  return (
    <Box flexDirection="column" marginBottom={1} paddingLeft={1}>
      <Text color="red" bold>✗ error</Text>
      <Box paddingLeft={2}>
        <Text color="red" wrap="wrap">{m.content}</Text>
      </Box>
    </Box>
  );
}

const WELCOME = [
  '  ┌──────────────────────────────────────────────┐',
  '  │  good ai code for u                         │',
  '  ├──────────────────────────────────────────────┤',
  '  │  /           settings & model browser       │',
  '  │  @file.ts    inject file into message       │',
  '  │  /save       save conversation              │',
  '  │  /load name  load conversation              │',
  '  │  ^R          reset conversation             │',
  '  │  ^C          quit                           │',
  '  └──────────────────────────────────────────────┘',
];

function Welcome(): React.ReactElement {
  return (
    <Box flexDirection="column" marginTop={1}>
      {WELCOME.map((line, i) => (
        <Text key={i} color={i === 0 || i === WELCOME.length - 1 || i === 2 ? 'gray' : 'cyan'}>{line}</Text>
      ))}
    </Box>
  );
}

export function ChatView({ messages, streaming, input, onChangeInput, onSend, model, spinChar }: ChatViewProps): React.ReactElement {
  const termRows = process.stdout.rows ?? 24;
  const visible = messages.slice(-Math.max(Math.floor((termRows - 14) / 5), 3));

  return (
    <Box flexDirection="column" flexGrow={1}>
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflowY="hidden">
        {messages.length === 0 && !streaming && <Welcome />}
        {visible.map((m, i) => {
          if (m.role === 'user')  return <UserMsg key={`${i}-u`} m={m} />;
          if (m.role === 'error') return <ErrMsg  key={`${i}-e`} m={m} />;
          return                         <AiMsg   key={`${i}-a`} m={m} model={model} />;
        })}
        {streaming && (
          <Box paddingLeft={3} marginBottom={1}>
            <Text color="cyan">{spinChar + '  buffering response'}</Text>
            <Text dimColor>{'...'}</Text>
          </Box>
        )}
      </Box>

      <Box borderStyle="single" borderColor="gray" paddingX={1} marginX={1}>
        <Text color="cyan" bold>{'❯ '}</Text>
        <TextInput value={input} onChange={onChangeInput} onSubmit={onSend} />
      </Box>
    </Box>
  );
}
