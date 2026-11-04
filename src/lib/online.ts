// Types and timings shared by the Socket.IO server and the online client.

export const MAX_PLAYERS = 6;

// Client animation timings. The server waits this long before accepting the next roll.
export const DICE_ROLL_MS = 900;
export const STEP_MS = 180;
export const SLIDE_PAUSE_MS = 250;
export const SLIDE_MS = 500;
/** Pause on the mined square (black flash → lava), then arc-teleport. */
export const MINE_PAUSE_MS = 900;
export const MINE_BLAST_MS = 1200;

export function moveDuration(
  from: number,
  landed: number,
  final: number,
  mineTo: number | null = null,
): number {
  let ms = DICE_ROLL_MS + Math.max(0, landed - from) * STEP_MS;
  if (mineTo != null) {
    ms += MINE_PAUSE_MS + MINE_BLAST_MS;
    if (final !== mineTo) ms += SLIDE_PAUSE_MS + SLIDE_MS;
  } else if (final !== landed) {
    ms += SLIDE_PAUSE_MS + SLIDE_MS;
  }
  return ms;
}

export type OnlinePlayer = {
  id: string;
  name: string;
  avatar: string; // seed for <Avatar>
  colorIndex: number;
  position: number;
  connected: boolean;
  rank: number | null; // 1 = first place; null while still racing
};

export type LastMove = {
  seq: number;
  playerId: string;
  roll: number;
  from: number;
  landed: number; // square reached by the roll (same as `from` if the roll overshot the last square)
  /** Square where a hidden mine detonated; null if none. */
  mineAt: number | null;
  /** Teleport destination after the mine; null if none. */
  mineTo: number | null;
  final: number; // square after mine (if any) and any snake or ladder
};

export type RoomState = {
  code: string;
  hostId: string;
  status: "lobby" | "playing" | "finished";
  players: OnlinePlayer[];
  currentIndex: number;
  winnerId: string | null;
  lastMove: LastMove | null;
  log: string[];
};

export type Ack<T = object> = (res: ({ ok: true } & T) | { ok: false; error: string }) => void;

export type ServerInfo = { lanAddresses: string[]; port: number };
