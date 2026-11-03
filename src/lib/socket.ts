"use client";

import { io, Socket } from "socket.io-client";

let socket: Socket | null = null;

// Set NEXT_PUBLIC_SOCKET_URL when the game server is hosted separately (e.g. on Render);
// otherwise connect to the same server that served the page.
const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL;

export function getSocket(): Socket {
  if (!socket) socket = SOCKET_URL ? io(SOCKET_URL) : io();
  return socket;
}

function stored(key: string, storage = "local"): string | null {
  try {
    return (storage === "session" ? sessionStorage : localStorage).getItem(key);
  } catch {
    return null;
  }
}

function store(key: string, value: string, storage = "local") {
  try {
    (storage === "session" ? sessionStorage : localStorage).setItem(key, value);
  } catch {
    // storage unavailable (private mode etc.) — fine, we just won't remember it
  }
}

let memoryId: string | null = null;

/** Per-tab id (survives refresh, so you rejoin the same seat; separate tabs are separate players). */
export function getPlayerId(): string {
  const existing = stored("snl.playerId", "session") ?? memoryId;
  if (existing) return existing;
  // crypto.randomUUID only exists in secure contexts, and LAN addresses are plain http.
  const id = Array.from({ length: 4 }, () => Math.random().toString(36).slice(2, 8)).join("");
  memoryId = id;
  store("snl.playerId", id, "session");
  return id;
}

export const getSavedName = () => stored("snl.name") ?? "";
export const saveName = (name: string) => store("snl.name", name);
