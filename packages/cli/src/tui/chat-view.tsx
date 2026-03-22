/**
 * Chat panel — full-width streaming chat view with message history and input.
 */

import React from 'react';
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

function MessageRow({ message }: { readonly message: Message }): React.ReactElement {
  const isUser = message.role === 'user';
  const isError = message.role === 'error';

  const labelColor = isUser ? 'green' : isError ? 'red' : 'blue';
  const label = isUser ? 'You' : isError ? 'Error' : 'Assistant';

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Text bold color={labelColor}>{label}:</Text>
      <Box paddingLeft={2} flexDirection="column">
        {message.role === 'assistant' ? (
          <Markdown content={message.content} />
        ) : (
          <Text wrap="wrap" color={isError ? 'red' : undefined}>{message.content}</Text>
        )}
      </Box>
    </Box>
  );
}

export function ChatView({
  messages,
  streaming,
  input,
  onChangeInput,
  onSend,
}: ChatViewProps): React.ReactElement {
  const termRows = process.stdout.rows ?? 24;
  // Reserve rows: header(3) + input(3) + status(3) + some padding = ~9
  const visibleRows = Math.max(4, termRows - 9);

  // Approximate: show last N messages. We estimate each message takes ~3 rows on average.
  const estimatedMsgsVisible = Math.floor(visibleRows / 3);
  const visibleMessages = messages.slice(-Math.max(estimatedMsgsVisible, 4));

  return (
    <Box flexDirection="column" flexGrow={1}>
      {/* Messages area */}
      <Box flexDirection="column" flexGrow={1} paddingX={1} overflowY="hidden">
        {messages.length === 0 && !streaming && (
          <Box marginTop={1}>
            <Text dimColor>Type a message to chat. Press ? for help and keyboard shortcuts.</Text>
          </Box>
        )}
        {visibleMessages.map((m, i) => (
          <MessageRow key={i} message={m} />
        ))}
        {streaming && (
          <Text dimColor>  {'● streaming...'}</Text>
        )}
      </Box>

      {/* Input area */}
      <Box borderStyle="single" paddingX={1}>
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
