"use client";

import { useState } from "react";
import dynamic from "next/dynamic";
import Game from "./Game";

// Reads the saved name from browser storage, so it renders on the client only.
const OnlineMenu = dynamic(() => import("./OnlineMenu"), { ssr: false });

export default function Home() {
  const [mode, setMode] = useState<"online" | "local">("online");

  return (
    <div className="flex flex-col items-center gap-6">
      <div className="flex rounded-xl bg-white/20 p-1 backdrop-blur">
        {(["online", "local"] as const).map((m) => (
          <button
            key={m}
            onClick={() => setMode(m)}
            className={`rounded-lg px-5 py-2 font-semibold transition ${
              mode === m ? "bg-white text-emerald-700 shadow" : "text-white hover:bg-white/10"
            }`}
          >
            {m === "online" ? "🌐 Online" : "📱 This device"}
          </button>
        ))}
      </div>
      {mode === "online" ? <OnlineMenu /> : <Game />}
    </div>
  );
}
