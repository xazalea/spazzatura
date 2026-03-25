import React, { useState, useEffect, useCallback } from 'react';
import { Box, Text, useInput, useApp } from 'ink';

const COLS = 10;
const ROWS = 20;
const TICK_MS = 500;

type Board = number[][];
type Piece = { shape: number[][]; color: string };

const PIECES: Piece[] = [
  { shape: [[1, 1, 1, 1]], color: 'cyan' },           // I
  { shape: [[1, 1], [1, 1]], color: 'yellow' },        // O
  { shape: [[0, 1, 0], [1, 1, 1]], color: 'magenta' }, // T
  { shape: [[1, 0], [1, 0], [1, 1]], color: 'blue' },  // J
  { shape: [[0, 1], [0, 1], [1, 1]], color: 'white' }, // L
  { shape: [[0, 1, 1], [1, 1, 0]], color: 'green' },   // S
  { shape: [[1, 1, 0], [0, 1, 1]], color: 'red' },     // Z
];

const PIECE_COLORS = ['cyan', 'yellow', 'magenta', 'blue', 'white', 'green', 'red'] as const;
type PieceColor = typeof PIECE_COLORS[number];

function emptyBoard(): Board {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(0));
}

function randomPiece(): { piece: Piece; x: number; y: number } {
  const piece = PIECES[Math.floor(Math.random() * PIECES.length)] ?? PIECES[0]!;
  const x = Math.floor((COLS - (piece.shape[0]?.length ?? 1)) / 2);
  return { piece, x, y: 0 };
}

function rotate(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0]?.length ?? 0;
  return Array.from({ length: cols }, (_, c) =>
    Array.from({ length: rows }, (__, r) => shape[rows - 1 - r]?.[c] ?? 0)
  );
}

function collides(board: Board, shape: number[][], x: number, y: number): boolean {
  for (let r = 0; r < shape.length; r++) {
    const row = shape[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      const nx = x + c;
      const ny = y + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && (board[ny]?.[nx] ?? 0) !== 0) return true;
    }
  }
  return false;
}

function placePiece(board: Board, shape: number[][], x: number, y: number, colorIdx: number): Board {
  const newBoard = board.map((r) => [...r]);
  for (let r = 0; r < shape.length; r++) {
    const row = shape[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      const ny = y + r;
      const nx = x + c;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        const boardRow = newBoard[ny];
        if (boardRow) boardRow[nx] = colorIdx + 1;
      }
    }
  }
  return newBoard;
}

function clearLines(board: Board): { board: Board; cleared: number } {
  const remaining = board.filter((row) => row.some((cell) => cell === 0));
  const cleared = ROWS - remaining.length;
  const newRows = Array.from({ length: cleared }, () => Array(COLS).fill(0));
  return { board: [...newRows, ...remaining], cleared };
}

const CELL_COLORS: PieceColor[] = ['cyan', 'yellow', 'magenta', 'blue', 'white', 'green', 'red'];

export function TetrisGame(): React.ReactElement {
  const { exit } = useApp();

  const [board, setBoard] = useState<Board>(emptyBoard());
  const { piece: initPiece, x: initX, y: initY } = randomPiece();
  const [current, setCurrent] = useState<Piece>(initPiece);
  const [pos, setPos] = useState({ x: initX, y: initY });
  const [score, setScore] = useState(0);
  const [lines, setLines] = useState(0);
  const [gameOver, setGameOver] = useState(false);

  const pieceColorIdx = PIECES.indexOf(current);

  const lockAndNext = useCallback(
    (b: Board, shape: number[][], px: number, py: number) => {
      const idx = PIECES.findIndex((p) => p === current);
      const placed = placePiece(b, shape, px, py, idx >= 0 ? idx : 0);
      const { board: cleared, cleared: linesCleared } = clearLines(placed);
      setBoard(cleared);
      setLines((l) => l + linesCleared);
      setScore((s) => s + linesCleared * 100);

      const next = randomPiece();
      if (collides(cleared, next.piece.shape, next.x, next.y)) {
        setGameOver(true);
      } else {
        setCurrent(next.piece);
        setPos({ x: next.x, y: next.y });
      }
    },
    [current]
  );

  const tick = useCallback(() => {
    if (gameOver) return;
    setPos((p) => {
      if (collides(board, current.shape, p.x, p.y + 1)) {
        lockAndNext(board, current.shape, p.x, p.y);
        return p;
      }
      return { x: p.x, y: p.y + 1 };
    });
  }, [board, current, gameOver, lockAndNext]);

  useEffect(() => {
    const id = setInterval(tick, TICK_MS);
    return () => clearInterval(id);
  }, [tick]);

  useInput((input, key) => {
    if (input === 'q') {
      exit();
      return;
    }
    if (gameOver) return;
    if (key.leftArrow) {
      setPos((p) => {
        if (!collides(board, current.shape, p.x - 1, p.y)) {
          return { x: p.x - 1, y: p.y };
        }
        return p;
      });
    } else if (key.rightArrow) {
      setPos((p) => {
        if (!collides(board, current.shape, p.x + 1, p.y)) {
          return { x: p.x + 1, y: p.y };
        }
        return p;
      });
    } else if (key.downArrow) {
      setPos((p) => {
        if (!collides(board, current.shape, p.x, p.y + 1)) {
          return { x: p.x, y: p.y + 1 };
        }
        lockAndNext(board, current.shape, p.x, p.y);
        return p;
      });
    } else if (key.upArrow) {
      const rotated = rotate(current.shape);
      if (!collides(board, rotated, pos.x, pos.y)) {
        setCurrent({ ...current, shape: rotated });
      }
    }
  });

  // Build display grid
  const display: number[][] = board.map((r) => [...r]);
  for (let r = 0; r < current.shape.length; r++) {
    const row = current.shape[r];
    if (!row) continue;
    for (let c = 0; c < row.length; c++) {
      if (!row[c]) continue;
      const ny = pos.y + r;
      const nx = pos.x + c;
      if (ny >= 0 && ny < ROWS && nx >= 0 && nx < COLS) {
        const dispRow = display[ny];
        if (dispRow) dispRow[nx] = pieceColorIdx >= 0 ? pieceColorIdx + 1 : 1;
      }
    }
  }

  return (
    <Box flexDirection="column">
      <Text bold color="cyan">
        {'  TETRIS  '}
        <Text color="white">Score: {score}  Lines: {lines}</Text>
        {'  (q to quit)'}
      </Text>
      <Text>{'┌' + '──'.repeat(COLS) + '┐'}</Text>
      {display.map((row, y) => (
        <Text key={y}>
          {'│'}
          {row.map((cell, x) => {
            if (cell === 0) return <Text key={x}>{'  '}</Text>;
            const color = CELL_COLORS[(cell - 1) % CELL_COLORS.length] ?? 'white';
            return (
              <Text key={x} color={color} bold>
                {'██'}
              </Text>
            );
          })}
          {'│'}
        </Text>
      ))}
      <Text>{'└' + '──'.repeat(COLS) + '┘'}</Text>
      {gameOver && (
        <Text bold color="red">
          GAME OVER! Press q to exit.
        </Text>
      )}
      <Text dimColor>Arrow keys to move/rotate, q to quit</Text>
    </Box>
  );
}
