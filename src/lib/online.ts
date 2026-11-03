// Types and timings shared by the Socket.IO server and the online client.

export const MAX_PLAYERS = 4;

// Client animation timings. The server waits this long before accepting the next roll.
export const DICE_SHAKE_MS = 560;
export const STEP_MS = 220;
export const SLIDE_PAUSE_MS = 250;
export const SLIDE_MS = 500;

export function moveDuration(from: number, landed: number, final: number): number {
  let ms = DICE_SHAKE_MS + Math.max(0, landed - from) * STEP_MS;
  if (final !== landed) ms += SLIDE_PAUSE_MS + SLIDE_MS;
  return ms;
}

export type OnlinePlayer = {
  id: string;
  name: string;
  colorIndex: number;
  position: number;
  connected: boolean;
};

export type LastMove = {
  seq: number;
  playerId: string;
  roll: number;
  from: number;
  landed: number; // square reached by the roll (same as `from` if the roll overshot 100)
  final: number; // square after any snake or ladder
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
