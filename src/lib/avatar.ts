// Cartoon avatars generated from a seed string. The seed is built from the player's name plus a
// random "salt", so typing a name gives a face right away and re-rolling the salt gives a new one.

export function avatarSeed(name: string, salt: number): string {
  return `${name.trim().toLowerCase() || "player"}:${salt}`;
}

export const randomSalt = () => Math.floor(Math.random() * 1e6);

export function cleanAvatar(seed: unknown): string {
  return typeof seed === "string" ? seed.slice(0, 48) : "player:0";
}

// FNV-1a hash → mulberry32 PRNG, so the same seed always draws the same face.
function rng(seed: string) {
  let h = 2166136261;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BACKGROUNDS = ["#fde68a", "#bbf7d0", "#bfdbfe", "#fbcfe8", "#ddd6fe", "#fed7aa", "#a5f3fc", "#fecaca"];
const SKINS = ["#f9d7b9", "#f1c27d", "#e0ac69", "#c68642", "#8d5524", "#ffdbac"];
const HAIRS = ["#2b1b10", "#5a3825", "#a0522d", "#e8b04b", "#d9480f", "#1e293b", "#7c3aed", "#0ea5e9"];

export type AvatarParts = {
  bg: string;
  skin: string;
  hairColor: string;
  hair: number; // 0 bald, 1 tuft, 2 bangs, 3 spiky, 4 bun, 5 curly
  eyes: number; // 0 dots, 1 big, 2 happy, 3 wink
  mouth: number; // 0 smile, 1 grin, 2 open, 3 tongue
  extra: number; // 0 none, 1 glasses, 2 freckles, 3 bow
  cheeks: boolean;
};

export function avatarParts(seed: string): AvatarParts {
  const r = rng(seed);
  const pick = <T,>(list: T[]) => list[Math.floor(r() * list.length)];
  const n = (count: number) => Math.floor(r() * count);
  return {
    bg: pick(BACKGROUNDS),
    skin: pick(SKINS),
    hairColor: pick(HAIRS),
    hair: n(6),
    eyes: n(4),
    mouth: n(4),
    extra: n(4),
    cheeks: r() < 0.5,
  };
}
