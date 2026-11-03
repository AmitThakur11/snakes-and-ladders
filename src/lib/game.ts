export const BOARD_SIZE = 100;

// head -> tail
export const SNAKES: Record<number, number> = {
  17: 7,
  49: 11,
  54: 34,
  62: 19,
  87: 36,
  93: 73,
  95: 75,
  98: 79,
};

// bottom -> top
export const LADDERS: Record<number, number> = {
  4: 14,
  9: 31,
  20: 38,
  28: 84,
  40: 59,
  51: 67,
  63: 81,
  71: 91,
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
  position: number; // 0 = off the board, 1..100 on the board
  isComputer: boolean;
};

/** Grid coordinates for a square, with row 0 at the bottom and rows snaking back and forth. */
export function squareToCoords(square: number): { row: number; col: number } {
  const idx = square - 1;
  const row = Math.floor(idx / 10);
  const offset = idx % 10;
  const col = row % 2 === 0 ? offset : 9 - offset;
  return { row, col };
}

/** Center of a square in a 0..100 coordinate space (origin top-left), for SVG and absolute positioning. */
export function squareCenter(square: number): { x: number; y: number } {
  if (square <= 0) return { x: -5, y: 95 };
  const { row, col } = squareToCoords(square);
  return { x: col * 10 + 5, y: (9 - row) * 10 + 5 };
}

export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}
