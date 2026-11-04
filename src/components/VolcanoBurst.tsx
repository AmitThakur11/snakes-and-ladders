"use client";

import { useEffect, useState } from "react";

export const BLAST_HISTORY_MS = 15_000;

export type BlastEvent = {
  id: number;
  at: number;
  to: number;
  name: string;
  createdAt: number;
};

/** Compact blast log for the right sidebar — each entry auto-clears after 15s. */
export default function BlastHistory({
  events,
  liveId = null,
  onExpire,
}: {
  events: BlastEvent[];
  /** Currently animating blast (highlighted). */
  liveId?: number | null;
  /** Drop expired rows from parent state. */
  onExpire?: (remaining: BlastEvent[]) => void;
}) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!events.length) return;
    const id = window.setInterval(() => {
      const cutoff = Date.now() - BLAST_HISTORY_MS;
      const remaining = events.filter((e) => e.createdAt > cutoff);
      if (remaining.length !== events.length) onExpire?.(remaining);
      setNow(Date.now());
    }, 400);
    return () => window.clearInterval(id);
  }, [events, onExpire]);

  const visible = events.filter((e) => now - e.createdAt < BLAST_HISTORY_MS);
  if (!visible.length) return null;

  return (
    <div className="mt-3 mb-3 overflow-hidden rounded-xl border border-orange-400/30 bg-slate-950/55 ring-1 ring-orange-400/15">
      <div className="flex items-center justify-between gap-2 border-b border-orange-400/20 px-3 py-2">
        <p className="font-display text-[10px] font-bold uppercase tracking-[0.24em] text-orange-300">
          Blast history
        </p>
        <span className="font-mono text-[10px] text-orange-200/70">{visible.length}</span>
      </div>
      <ul className="max-h-36 space-y-0.5 overflow-y-auto px-2 py-1.5">
        {[...visible].reverse().map((e) => {
          const live = e.id === liveId;
          return (
            <li
              key={e.id}
              className={`flex items-center gap-2 rounded-lg px-2 py-1.5 text-xs ${
                live
                  ? "bg-orange-500/20 text-orange-50 ring-1 ring-orange-400/35"
                  : "text-slate-300"
              }`}
            >
              <span aria-hidden className={live ? "volcano-burst-emoji text-sm" : "text-sm opacity-70"}>
                🌋
              </span>
              <span className="min-w-0 flex-1 truncate font-semibold">{e.name}</span>
              <span className="shrink-0 font-mono text-[11px] text-amber-200/90">
                {e.at}
                <span className="mx-1 text-orange-300/70">→</span>
                {e.to}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
