export const GRID = 11; // squares per row
export const BOARD_SIZE = GRID * GRID;
const CELL = 100 / GRID; // one square in the board's 0..100 coordinate space

// head -> tail
export const SNAKES: Record<number, number> = {
  28: 8,
  39: 18,
  52: 31,
  61: 40,
  77: 55,
  86: 63,
  98: 73,
  105: 83,
  114: 92,
  119: 97,
};

// bottom -> top
export const LADDERS: Record<number, number> = {
  3: 24,
  7: 29,
  14: 35,
  21: 44,
  33: 56,
  46: 68,
  58: 80,
  69: 91,
  81: 102,
  88: 110,
};

export const PLAYER_COLORS = [
  { name: "Red", fill: "#ef4444", ring: "#991b1b" },
  { name: "Blue", fill: "#3b82f6", ring: "#1e3a8a" },
  { name: "Green", fill: "#22c55e", ring: "#14532d" },
  { name: "Yellow", fill: "#facc15", ring: "#854d0e" },
];

export type Player = {
  id: number;
  name: string;
  color: (typeof PLAYER_COLORS)[number];
  position: number; // 0 = off the board, 1..BOARD_SIZE on the board
  isComputer: boolean;
  avatar: string; // seed for <Avatar>
};

/** Grid coordinates for a square, with row 0 at the bottom and rows snaking back and forth. */
export function squareToCoords(square: number): { row: number; col: number } {
  const idx = square - 1;
  const row = Math.floor(idx / GRID);
  const offset = idx % GRID;
  const col = row % 2 === 0 ? offset : GRID - 1 - offset;
  return { row, col };
}

/** Center of a square in a 0..100 coordinate space (origin top-left), for SVG and absolute positioning. */
export function squareCenter(square: number): { x: number; y: number } {
  if (square <= 0) return { x: -5, y: 95 };
  const { row, col } = squareToCoords(square);
  return { x: (col + 0.5) * CELL, y: (GRID - 1 - row + 0.5) * CELL };
}

export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}
