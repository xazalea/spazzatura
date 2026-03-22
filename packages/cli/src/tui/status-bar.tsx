/**
 * Status bar — bottom strip showing provider, model, tokens, latency, layout.
 */

import React from 'react';
import { Box, Text } from 'ink';

export interface StatusBarProps {
  readonly provider?: string;
  readonly model?: string;
  readonly tokens?: number;
  readonly latency?: number;
  readonly layout: string;
}

export function StatusBar({ provider, model, tokens, latency, layout }: StatusBarProps): React.ReactElement {
  const parts: string[] = [];

  if (provider !== undefined) parts.push('provider:' + provider);
  if (model !== undefined) parts.push('model:' + model);
  if (tokens !== undefined) parts.push('tokens:~' + String(tokens));
  if (latency !== undefined) parts.push('latency:' + String(latency) + 'ms');
  parts.push('layout:' + layout);
  parts.push('? for help');

  return (
    <Box borderStyle="single" paddingX={1} justifyContent="space-between">
      <Text dimColor>{parts.join('  ')}</Text>
    </Box>
  );
}
