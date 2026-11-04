export const GRID = 10; // classic 10×10 board (1–100)
export const BOARD_SIZE = GRID * GRID;
const CELL = 100 / GRID; // one square in the board's 0..100 coordinate space

/**
 * Snakes & ladders matching the reference board
 * (1 bottom-left → 100 top-left / WIN, serpentine rows).
 * Snakes: head → tail. Ladders: bottom → top (never onto 100).
 */
export const SNAKES: Record<number, number> = {
  99: 16, // big green/yellow
  92: 48, // magenta
  87: 55, // blue
  80: 43, // lavender
  37: 20, // teal
  14: 7, // small pink
};

export const LADDERS: Record<number, number> = {
  5: 26,
  9: 51,
  22: 41,
  28: 47,
  58: 75,
  67: 83,
  70: 89,
  90: 97,
};

export const PLAYER_COLORS = [
  { name: "Red", fill: "#ef4444", ring: "#991b1b" },
  { name: "Blue", fill: "#3b82f6", ring: "#1e3a8a" },
  { name: "Green", fill: "#22c55e", ring: "#14532d" },
  { name: "Yellow", fill: "#facc15", ring: "#854d0e" },
  { name: "Orange", fill: "#f97316", ring: "#9a3412" },
  { name: "Cyan", fill: "#06b6d4", ring: "#155e75" },
];

export type Player = {
  id: number;
  name: string;
  color: (typeof PLAYER_COLORS)[number];
  position: number; // 0 = off the board, 1..BOARD_SIZE on the board
  isComputer: boolean;
  avatar: string; // seed for <Avatar>
  rank: number | null; // 1 = first place; null while still racing
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

/**
 * World position on the flat board (cell size 1, origin at board centre).
 * X/Z = on the board plane, Y = up. Orbit freely for table or wall view.
 */
export function squareToWorld(square: number): [number, number, number] {
  if (square <= 0) return [-(GRID - 1) / 2 - 1.35, 0.4, (GRID - 1) / 2];
  const { row, col } = squareToCoords(square);
  const x = col - (GRID - 1) / 2;
  const z = (GRID - 1) / 2 - row;
  return [x, 0.4, z];
}

export function rollDie(): number {
  return Math.floor(Math.random() * 6) + 1;
}

/** Hidden volcano mines placed once at match start (never shown until stepped on). */
export const MINE_COUNT = 20;

/** Pick unique squares 1..99 — finish (100) stays mine-free. */
export function generateMines(count = MINE_COUNT): number[] {
  const pool = Array.from({ length: BOARD_SIZE - 1 }, (_, i) => i + 1);
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const a = pool[i]!;
    pool[i] = pool[j]!;
    pool[j] = a;
  }
  return pool.slice(0, Math.min(count, pool.length));
}

/** Blast to any other square on the board (up or down), including 100. */
export function pickMineTeleport(from: number): number {
  if (BOARD_SIZE <= 1) return from;
  let to = from;
  while (to === from) {
    to = Math.floor(Math.random() * BOARD_SIZE) + 1;
  }
  return to;
}

export function applySnakeOrLadder(square: number): number {
  return SNAKES[square] ?? LADDERS[square] ?? square;
}

/**
 * After walking onto `landed`: if a mine is there, consume it and teleport once,
 * then apply snake/ladder on the resulting square. Mines do not chain.
 */
export function resolveLanding(
  landed: number,
  mines: number[],
): { mines: number[]; mineAt: number | null; mineTo: number | null; final: number } {
  const idx = mines.indexOf(landed);
  if (idx === -1) {
    return { mines, mineAt: null, mineTo: null, final: applySnakeOrLadder(landed) };
  }
  const nextMines = mines.filter((_, i) => i !== idx);
  const mineTo = pickMineTeleport(landed);
  return {
    mines: nextMines,
    mineAt: landed,
    mineTo,
    final: applySnakeOrLadder(mineTo),
  };
}

export function nextFinishRank(players: { rank: number | null }[]): number {
  return players.filter((p) => p.rank != null).length + 1;
}

/** Match ends when only one racer is left (2nd-last has finished). */
export function matchShouldEnd(players: { rank: number | null }[]): boolean {
  return players.filter((p) => p.rank == null).length <= 1;
}

export function rankLabel(rank: number): string {
  if (rank === 1) return "1st";
  if (rank === 2) return "2nd";
  if (rank === 3) return "3rd";
  return `${rank}th`;
}
