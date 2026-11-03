"use client";

import { useSyncExternalStore } from "react";

export type BoardTheme = {
  id: string;
  name: string;
  light: string; // light squares
  dark: string; // dark squares
  lightText: string;
  darkText: string;
  frame: string;
};

export const BOARD_THEMES: BoardTheme[] = [
  { id: "classic", name: "Classic", light: "#f8f8f6", dark: "#1c1c1c", lightText: "#1c1c1c", darkText: "#f8f8f6", frame: "#111111" },
  { id: "wood", name: "Wood", light: "#f0d9b5", dark: "#b58863", lightText: "#5c3a1e", darkText: "#fff7e8", frame: "#5c3a1e" },
  { id: "jungle", name: "Jungle", light: "#ecfccb", dark: "#4d7c0f", lightText: "#365314", darkText: "#f7fee7", frame: "#365314" },
  { id: "ocean", name: "Ocean", light: "#e0f2fe", dark: "#0369a1", lightText: "#0c4a6e", darkText: "#f0f9ff", frame: "#0c4a6e" },
  { id: "candy", name: "Candy", light: "#fdf2f8", dark: "#c084fc", lightText: "#831843", darkText: "#ffffff", frame: "#86198f" },
  { id: "midnight", name: "Midnight", light: "#475569", dark: "#0f172a", lightText: "#f1f5f9", darkText: "#cbd5e1", frame: "#020617" },
];

// The chosen theme is a per-browser preference, kept in localStorage and shared by every board on the page.
const KEY = "snl.boardTheme";
const listeners = new Set<() => void>();

function read(): string {
  try {
    return localStorage.getItem(KEY) ?? "classic";
  } catch {
    return "classic";
  }
}

export function setBoardTheme(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage unavailable — the choice just won't survive a reload
  }
  current = id;
  listeners.forEach((l) => l());
}

let current: string | null = null;

export function useBoardTheme(): BoardTheme {
  const id = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => (current ??= read()),
    () => "classic",
  );
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}
