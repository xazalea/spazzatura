import React from 'react';
import { render } from 'ink';
import { SnakeGame } from './snake.js';
import { TetrisGame } from './tetris.js';

export type GameName = 'snake' | 'tetris';

export async function launchGame(game?: GameName): Promise<void> {
  const games: GameName[] = ['snake', 'tetris'];
  const selected: GameName = game ?? (games[Math.floor(Math.random() * games.length)] ?? 'snake');

  const component =
    selected === 'snake'
      ? React.createElement(SnakeGame)
      : React.createElement(TetrisGame);

  const { waitUntilExit } = render(component);
  await waitUntilExit();
}
