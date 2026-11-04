"use client";

import dynamic from "next/dynamic";
import { memo } from "react";
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
