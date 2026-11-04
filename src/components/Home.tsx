"use client";

import { useCallback, useState } from "react";
import dynamic from "next/dynamic";
import BrandLogo from "./BrandLogo";
import Game from "./Game";

const OnlineMenu = dynamic(() => import("./OnlineMenu"), { ssr: false });

function ModeToggle({
  mode,
  onChange,
  compact,
}: {
  mode: "online" | "local";
  onChange: (m: "online" | "local") => void;
  compact?: boolean;
}) {
  return (
    <div
      className={`inline-flex shrink-0 rounded-2xl border border-cyan-400/25 bg-slate-950/60 p-1 shadow-[0_0_28px_rgba(34,211,238,0.12)] backdrop-blur-md ${
        compact ? "" : "sm:p-1.5"
      }`}
    >
      {(["online", "local"] as const).map((m) => (
        <button
          key={m}
          type="button"
          onClick={() => onChange(m)}
          className={`rounded-xl font-display font-bold uppercase tracking-wider transition ${
            compact ? "px-3 py-1.5 text-[10px] sm:text-xs" : "px-5 py-2.5 text-xs sm:px-6 sm:text-sm"
          } ${
            mode === m
              ? "bg-gradient-to-r from-cyan-400 to-cyan-600 text-slate-950 shadow-lg shadow-cyan-500/30"
              : "text-slate-300 hover:bg-white/5 hover:text-white"
          }`}
        >
          {m === "online" ? "Online" : "This device"}
        </button>
      ))}
    </div>
  );
}

export default function Home() {
  const [mode, setMode] = useState<"online" | "local">("online");
  const [boardActive, setBoardActive] = useState(false);
  const [exitRequest, setExitRequest] = useState(0);

  const onBoardActiveChange = useCallback((active: boolean) => {
    setBoardActive(active);
  }, []);

  const switchMode = (m: "online" | "local") => {
    setMode(m);
    setBoardActive(false);
  };

  return (
    <div
      className={
        boardActive
          ? "flex min-h-0 flex-col gap-3"
          : "grid min-h-[100dvh] grid-cols-1 content-center gap-8 py-8 sm:gap-10 sm:py-10 lg:grid-cols-2 lg:items-center lg:gap-12 lg:py-8 xl:gap-16"
      }
    >
      {boardActive ? (
        <header className="flex items-center justify-between gap-4 pt-1 sm:pt-2">
          <BrandLogo compact />
          <button
            type="button"
            onClick={() => setExitRequest((n) => n + 1)}
            className="ui-btn ui-btn-ghost px-5 py-2.5 font-display text-xs font-bold uppercase tracking-wider"
          >
            Exit
          </button>
        </header>
      ) : (
        <section className="flex flex-col items-center gap-4 text-center sm:gap-5 lg:items-start lg:text-left">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.42em] text-cyan-300/90 sm:text-xs">
            Cosmic tabletop
          </p>
          <BrandLogo hero />
          <p className="max-w-lg text-sm leading-relaxed text-slate-400 sm:text-base">
            Climb the stars. Dodge the snakes. Play online or on this device.
          </p>
        </section>
      )}

      <section
        className={
          boardActive
            ? "flex min-h-0 w-full flex-1 flex-col"
            : "flex w-full flex-col gap-4 sm:gap-5"
        }
      >
        {!boardActive && (
          <div className="flex justify-center lg:justify-start">
            <ModeToggle mode={mode} onChange={switchMode} />
          </div>
        )}

        {mode === "online" ? <OnlineMenu /> : null}

        {/* One stable Game mount — never remount on layout change */}
        {mode === "local" ? (
          <div className={boardActive ? "min-h-0 flex-1" : "w-full"}>
            <Game onBoardActiveChange={onBoardActiveChange} exitRequest={exitRequest} />
          </div>
        ) : null}
      </section>
    </div>
  );
}
