"use client";

import { useSyncExternalStore } from "react";

export type BoardTheme = {
  id: string;
  name: string;
  light: string;
  dark: string;
  lightText: string;
  darkText: string;
  frame: string;
};

/** Five bold board palettes. Default: Ivory. */
export const BOARD_THEMES: BoardTheme[] = [
  {
    id: "ivory",
    name: "Ivory",
    light: "#fafaf9",
    dark: "#18181b",
    lightText: "#18181b",
    darkText: "#fafaf9",
    frame: "#0a0a0a",
  },
  {
    id: "space",
    name: "Cosmic",
    light: "#1e3a5f",
    dark: "#0a1628",
    lightText: "#e0f2fe",
    darkText: "#22d3ee",
    frame: "#0a0a0a",
  },
  {
    id: "ember",
    name: "Ember",
    light: "#ffedd5",
    dark: "#ea580c",
    lightText: "#7c2d12",
    darkText: "#fff7ed",
    frame: "#9a3412",
  },
  {
    id: "neon",
    name: "Neon",
    light: "#fce7f3",
    dark: "#db2777",
    lightText: "#831843",
    darkText: "#fdf2f8",
    frame: "#9d174d",
  },
  {
    id: "jade",
    name: "Jade",
    light: "#d1fae5",
    dark: "#059669",
    lightText: "#064e3b",
    darkText: "#ecfdf5",
    frame: "#047857",
  },
];

const KEY = "snl.boardTheme";
const DEFAULT_ID = "ivory";
const listeners = new Set<() => void>();

function read(): string {
  try {
    const stored = localStorage.getItem(KEY);
    // Migrate old ids (classic → ivory)
    if (stored === "classic") return "ivory";
    if (stored && BOARD_THEMES.some((t) => t.id === stored)) return stored;
    return DEFAULT_ID;
  } catch {
    return DEFAULT_ID;
  }
}

export function setBoardTheme(id: string) {
  try {
    localStorage.setItem(KEY, id);
  } catch {
    // storage unavailable
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
    () => DEFAULT_ID,
  );
  return BOARD_THEMES.find((t) => t.id === id) ?? BOARD_THEMES[0];
}
