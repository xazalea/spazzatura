import React from 'react';
import { Box, Text, useInput } from 'ink';

const PET_ART = [
  ' /\\_/\\ ',
  '( o.o )',
  ' > ^ < ',
  '(  Y  )',
];

interface PetProps {
  message: string;
  onDismiss: () => void;
}

export function Pet({ message, onDismiss }: PetProps): React.ReactElement {
  useInput((_input, _key) => {
    onDismiss();
  });

  const bubbleWidth = Math.min(50, Math.max(20, message.length + 4));
  const wrappedLines = wrapText(message, bubbleWidth - 4);

  return (
    <Box flexDirection="column" marginTop={1}>
      {/* Speech bubble */}
      <Box flexDirection="column" marginLeft={10}>
        <Text>{'┌' + '─'.repeat(bubbleWidth - 2) + '┐'}</Text>
        {wrappedLines.map((line, i) => (
          <Text key={i}>
            {'│ '}
            <Text color="greenBright">{line.padEnd(bubbleWidth - 4)}</Text>
            {' │'}
          </Text>
        ))}
        <Text>{'└' + '─'.repeat(Math.floor((bubbleWidth - 2) / 2) - 2) + '┬' + '─'.repeat(bubbleWidth - Math.floor((bubbleWidth - 2) / 2) - 1) + '┘'}</Text>
        <Text>{' '.repeat(Math.floor(bubbleWidth / 2) - 2) + '╱'}</Text>
      </Box>

      {/* Pet ASCII art */}
      <Box flexDirection="column" marginLeft={8}>
        {PET_ART.map((line, i) => (
          <Text key={i} color="yellow" bold>
            {line}
          </Text>
        ))}
      </Box>

      {/* Footer */}
      <Box marginTop={1}>
        <Text dimColor italic>
          Press any key to dismiss
        </Text>
      </Box>
    </Box>
  );
}

function wrapText(text: string, width: number): string[] {
  if (text.length <= width) return [text];
  const words = text.split(' ');
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if ((current + (current ? ' ' : '') + word).length <= width) {
      current = current ? `${current} ${word}` : word;
    } else {
      if (current) lines.push(current);
      current = word.slice(0, width);
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [text.slice(0, width)];
}
