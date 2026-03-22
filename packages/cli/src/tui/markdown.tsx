/**
 * Markdown renderer for ink — regex-based, no external markdown libs.
 */

import React from 'react';
import { Box, Text } from 'ink';

interface MarkdownProps {
  readonly content: string;
}

interface Segment {
  readonly type: 'bold' | 'italic' | 'code' | 'text';
  readonly value: string;
}

/** Parse inline markdown segments from a line of text. */
function parseInline(text: string): Segment[] {
  const segments: Segment[] = [];
  // Pattern: bold (**...**), italic (*...*), inline code (`...`)
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|`([^`]+)`)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }
    const full = match[0] ?? '';
    if (full.startsWith('**')) {
      segments.push({ type: 'bold', value: match[2] ?? '' });
    } else if (full.startsWith('`')) {
      segments.push({ type: 'code', value: match[4] ?? '' });
    } else {
      segments.push({ type: 'italic', value: match[3] ?? '' });
    }
    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return segments;
}

function InlineText({ text }: { readonly text: string }): React.ReactElement {
  const segments = parseInline(text);
  return (
    <Text>
      {segments.map((seg, i) => {
        if (seg.type === 'bold') {
          return <Text key={i} bold>{seg.value}</Text>;
        }
        if (seg.type === 'italic') {
          return <Text key={i} italic>{seg.value}</Text>;
        }
        if (seg.type === 'code') {
          return <Text key={i} backgroundColor="gray" color="white"> {seg.value} </Text>;
        }
        return <Text key={i}>{seg.value}</Text>;
      })}
    </Text>
  );
}

/** Strip HTML tags from a string. */
function stripHtml(text: string): string {
  return text.replace(/<[^>]*>/g, '');
}

type BlockType = 'heading' | 'list' | 'codeblock' | 'tablerow' | 'paragraph';

interface Block {
  readonly type: BlockType;
  readonly content: string;
  readonly level?: number;
}

/** Split content into blocks for rendering. */
function parseBlocks(content: string): Block[] {
  const lines = content.split('\n');
  const blocks: Block[] = [];
  let inCodeBlock = false;
  let codeAccum = '';

  for (const raw of lines) {
    const line = stripHtml(raw);

    // Code block toggle
    if (line.startsWith('```')) {
      if (inCodeBlock) {
        blocks.push({ type: 'codeblock', content: codeAccum });
        codeAccum = '';
        inCodeBlock = false;
      } else {
        inCodeBlock = true;
      }
      continue;
    }

    if (inCodeBlock) {
      codeAccum += (codeAccum ? '\n' : '') + line;
      continue;
    }

    // Heading
    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(line);
    if (headingMatch) {
      blocks.push({ type: 'heading', content: headingMatch[2] ?? '', level: (headingMatch[1] ?? '#').length });
      continue;
    }

    // List item
    if (/^[-*+]\s+/.test(line)) {
      blocks.push({ type: 'list', content: line.replace(/^[-*+]\s+/, '') });
      continue;
    }

    // Table row (contains |)
    if (/^\|.+\|/.test(line)) {
      // Skip separator rows like |---|---|
      if (/^\|[\s\-|:]+\|$/.test(line)) continue;
      const cells = line
        .split('|')
        .filter((_, i, arr) => i > 0 && i < arr.length - 1)
        .map(c => c.trim());
      blocks.push({ type: 'tablerow', content: cells.join(' | ') });
      continue;
    }

    // Paragraph (non-empty)
    if (line.trim()) {
      blocks.push({ type: 'paragraph', content: line });
    } else {
      // Empty line — acts as spacer; we skip or add blank paragraph
      // Only add if last block wasn't already blank
      const last = blocks[blocks.length - 1];
      if (last !== undefined && last.type !== 'paragraph') {
        blocks.push({ type: 'paragraph', content: '' });
      }
    }
  }

  // Close unclosed code block
  if (inCodeBlock && codeAccum) {
    blocks.push({ type: 'codeblock', content: codeAccum });
  }

  return blocks;
}

export function Markdown({ content }: MarkdownProps): React.ReactElement {
  const blocks = parseBlocks(content);

  return (
    <Box flexDirection="column">
      {blocks.map((block, i) => {
        switch (block.type) {
          case 'heading':
            return (
              <Box key={i} marginBottom={0}>
                <Text bold color="cyan"><InlineText text={block.content} /></Text>
              </Box>
            );
          case 'list':
            return (
              <Box key={i}>
                <Text color="cyan">{'• '}</Text>
                <InlineText text={block.content} />
              </Box>
            );
          case 'codeblock':
            return (
              <Box key={i} flexDirection="column" marginY={0}>
                {block.content.split('\n').map((codeLine, j) => (
                  <Text key={j} color="cyan">{codeLine}</Text>
                ))}
              </Box>
            );
          case 'tablerow':
            return (
              <Box key={i}>
                <Text dimColor>{block.content}</Text>
              </Box>
            );
          case 'paragraph':
            if (!block.content) {
              return <Box key={i}><Text>{' '}</Text></Box>;
            }
            return (
              <Box key={i} flexWrap="wrap">
                <InlineText text={block.content} />
              </Box>
            );
        }
      })}
    </Box>
  );
}
