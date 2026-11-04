"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
import { BOARD_THEMES, setBoardTheme, useBoardTheme } from "@/lib/boardTheme";
import type { Player } from "@/lib/game";

export type Token = Pick<Player, "name" | "color" | "position" | "avatar"> & {
  id: number | string;
  rank?: number | null;
};

const BoardCanvas = dynamic(() => import("./board3d/BoardCanvas"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full min-h-[280px] w-full items-center justify-center font-display text-sm tracking-wide text-slate-300">
      Loading 3D board…
    </div>
  ),
});

/** Board color picker — right sidebar. Ivory is default; unselected chips stay clean. */
export function ThemePicker() {
  const theme = useBoardTheme();
  return (
    <div className="ui-panel p-4">
      <p className="font-display mb-3 text-[11px] font-semibold uppercase tracking-[0.22em] text-cyan-300/85">
        Board color
      </p>
      <div className="grid grid-cols-5 gap-1.5">
        {BOARD_THEMES.map((t) => {
          const active = theme.id === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => setBoardTheme(t.id)}
              title={t.name}
              aria-label={`${t.name} board`}
              aria-pressed={active}
              className="flex flex-col items-center gap-1 rounded-lg py-1 transition hover:bg-white/5"
            >
              <span
                className={`block h-9 w-9 rounded-full shadow-inner transition ${
                  active
                    ? "ring-2 ring-cyan-300 ring-offset-2 ring-offset-slate-950"
                    : "ring-1 ring-inset ring-white/15"
                }`}
                style={{ background: `linear-gradient(135deg, ${t.light} 48%, ${t.dark} 52%)` }}
              />
              <span
                className={`font-display text-[8px] font-semibold uppercase tracking-wide ${
                  active ? "text-cyan-200" : "text-slate-500"
                }`}
              >
                {t.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function tokensEqual(a: Token[], b: Token[]) {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const x = a[i]!;
    const y = b[i]!;
    if (
      x.id !== y.id ||
      x.position !== y.position ||
      x.rank !== y.rank ||
      x.color.fill !== y.color.fill ||
      x.avatar !== y.avatar
    ) {
      return false;
    }
  }
  return true;
}

function Board({
  players,
  currentId,
  burstSquare = null,
}: {
  players: Token[];
  currentId: number | string | null;
  /** Hidden mine square currently erupting (board VFX only). */
  burstSquare?: number | null;
}) {
  return (
    <div className="h-full min-h-0 w-full">
      <BoardCanvas players={players} currentId={currentId} burstSquare={burstSquare} />
    </div>
  );
}

/** Skip canvas work when dice/UI state changes but token positions do not. */
export default memo(
  Board,
  (prev, next) =>
    prev.currentId === next.currentId &&
    prev.burstSquare === next.burstSquare &&
    tokensEqual(prev.players, next.players),
);
