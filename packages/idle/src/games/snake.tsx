import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

type Point = { x: number; y: number };
type Direction = 'up' | 'down' | 'left' | 'right';

const COLS = 20;
const ROWS = 10;
const TICK_MS = 150;

function randomFood(snake: Point[]): Point {
  let food: Point;
  do {
    food = {
      x: Math.floor(Math.random() * COLS),
      y: Math.floor(Math.random() * ROWS),
    };
  } while (snake.some((s) => s.x === food.x && s.y === food.y));
  return food;
}

function cellAt(grid: string[][], y: number, x: number): string {
  return grid[y]?.[x] ?? ' ';
}

export function SnakeGame(): React.ReactElement {
  const { exit } = useApp();

  const [snake, setSnake] = useState<Point[]>([
    { x: 4, y: 5 },
    { x: 3, y: 5 },
    { x: 2, y: 5 },
  ]);
  const [dir, setDir] = useState<Direction>('right');
  const [nextDir, setNextDir] = useState<Direction>('right');
  const [food, setFood] = useState<Point>({ x: 12, y: 5 });
  const [score, setScore] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }
    if (gameOver) return;
    if (key.upArrow && dir !== 'down') setNextDir('up');
    else if (key.downArrow && dir !== 'up') setNextDir('down');
    else if (key.leftArrow && dir !== 'right') setNextDir('left');
    else if (key.rightArrow && dir !== 'left') setNextDir('right');
  });

  const tick = useCallback(() => {
    if (gameOver) return;

    setSnake((prev) => {
      setDir(nextDir);
      const head = prev[0];
      if (!head) return prev;

      const newHead: Point = {
        x: head.x + (nextDir === 'right' ? 1 : nextDir === 'left' ? -1 : 0),
        y: head.y + (nextDir === 'down' ? 1 : nextDir === 'up' ? -1 : 0),
      };

      // Wall collision
      if (newHead.x < 0 || newHead.x >= COLS || newHead.y < 0 || newHead.y >= ROWS) {
        setGameOver(true);
        return prev;
      }

      // Self collision
      if (prev.some((s) => s.x === newHead.x && s.y === newHead.y)) {
        setGameOver(true);
        return prev;
      }

      let newSnake: Point[];
      setFood((currentFood) => {
        if (newHead.x === currentFood.x && newHead.y === currentFood.y) {
          setScore((s) => s + 10);
          newSnake = [newHead, ...prev];
          setFood(randomFood([newHead, ...prev]));
        } else {
          newSnake = [newHead, ...prev.slice(0, -1)];
        }
        return currentFood;
      });

      return newSnake ?? [newHead, ...prev.slice(0, -1)];
    });
  }, [gameOver, nextDir]);

  useEffect(() => {
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [tick]);

  // Build grid
  const grid: string[][] = Array.from({ length: ROWS }, () =>
    Array.from({ length: COLS }, () => ' ')
  );

  for (let i = 0; i < snake.length; i++) {
    const s = snake[i];
    if (s && s.y >= 0 && s.y < ROWS && s.x >= 0 && s.x < COLS) {
      const row = grid[s.y];
      if (row) row[s.x] = i === 0 ? 'O' : 'o';
    }
  }
  if (food.y >= 0 && food.y < ROWS && food.x >= 0 && food.x < COLS) {
    const row = grid[food.y];
    if (row) row[food.x] = '*';
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {'  SNAKE  '}
        <Text color="white">Score: {score}</Text>
        {'  (q to quit)'}
      </Text>
      <Text>{'┌' + '─'.repeat(COLS) + '┐'}</Text>
      {grid.map((row, y) => (
        <Text key={y}>
          {'│'}
          {row.map((cell, x) => {
            const s = snake[0];
            if (s && s.x === x && s.y === y) return <Text key={x} color="green" bold>{cell}</Text>;
            if (cell === 'o') return <Text key={x} color="green">{cell}</Text>;
            if (cell === '*') return <Text key={x} color="red">{cell}</Text>;
            return <Text key={x}>{cell}</Text>;
          })}
          {'│'}
        </Text>
      ))}
      <Text>{'└' + '─'.repeat(COLS) + '┘'}</Text>
      {gameOver && (
        <Text bold color="red">
          GAME OVER! Press q to exit.
        </Text>
      )}
      <Text dimColor>Arrow keys to move</Text>
    </Box>
  );
}

// Helper to get a cell string for non-JSX rendering
export { cellAt };
