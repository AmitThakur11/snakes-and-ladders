"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "./Avatar";
import { avatarSeed, randomSalt } from "@/lib/avatar";
import { getPlayerId, getSavedName, getSavedSalt, getSocket, saveName, saveSalt } from "@/lib/socket";

export default function OnlineMenu() {
  const router = useRouter();
  const [name, setName] = useState(getSavedName);
  const [salt, setSalt] = useState(getSavedSalt);
  const [digits, setDigits] = useState(["", "", "", ""]);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);
  const digitRefs = useRef<Array<HTMLInputElement | null>>([]);

  const reroll = () => {
    const next = randomSalt();
    setSalt(next);
    saveSalt(next);
  };

  const code = digits.join("");

  const create = () => {
    if (!name.trim()) return setError("Who’s climbing? Add your name first.");
    saveName(name.trim());
    setPending(true);
    getSocket().emit(
      "room:create",
      { name: name.trim(), playerId: getPlayerId() },
      (res: { ok: true; code: string } | { ok: false; error: string }) => {
        setPending(false);
        if (res.ok) router.push(`/room/${res.code}`);
        else setError(res.error);
      },
    );
  };

  const join = () => {
    if (!name.trim()) return setError("Who’s climbing? Add your name first.");
    if (code.length !== 4) return setError("Need all 4 letters of the room code.");
    saveName(name.trim());
    router.push(`/room/${code}`);
  };

  const setDigit = (i: number, raw: string) => {
    const ch = raw.toUpperCase().replace(/[^A-Z]/g, "").slice(-1);
    setDigits((prev) => {
      const next = [...prev];
      next[i] = ch;
      return next;
    });
    setError("");
    if (ch && i < 3) digitRefs.current[i + 1]?.focus();
  };

  const onDigitKey = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[i] && i > 0) {
      digitRefs.current[i - 1]?.focus();
    }
    if (e.key === "Enter") {
      e.preventDefault();
      join();
    }
  };

  const onDigitPaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").toUpperCase().replace(/[^A-Z]/g, "").slice(0, 4);
    if (!pasted) return;
    const next = ["", "", "", ""];
    for (let i = 0; i < pasted.length; i++) next[i] = pasted[i]!;
    setDigits(next);
    setError("");
    digitRefs.current[Math.min(pasted.length, 3)]?.focus();
  };

  return (
    <div className="relative mx-auto w-full max-w-xl overflow-hidden lg:max-w-none">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[1.35rem] bg-[radial-gradient(ellipse_at_20%_0%,rgba(34,211,238,0.16),transparent_55%),radial-gradient(ellipse_at_90%_100%,rgba(245,158,11,0.12),transparent_50%),linear-gradient(160deg,rgba(2,6,23,0.92),rgba(15,23,42,0.75))]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 rounded-[1.35rem] opacity-40 [background-image:linear-gradient(rgba(148,163,184,0.07)_1px,transparent_1px),linear-gradient(90deg,rgba(148,163,184,0.07)_1px,transparent_1px)] [background-size:28px_28px] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]"
      />

      <div className="relative flex flex-col gap-4 rounded-[1.25rem] border border-cyan-400/20 p-4 shadow-[0_0_0_1px_rgba(255,255,255,0.03)_inset,0_20px_50px_rgba(0,0,0,0.5)] backdrop-blur-xl sm:gap-5 sm:p-5">
        {/* Callsign seal — same as first redesign: big avatar, then name */}
        <div className="flex flex-col items-center text-center">
          <p className="font-display text-[10px] font-semibold uppercase tracking-[0.38em] text-cyan-300/80">
            Callsign
          </p>
          <div className="relative mt-4">
            <span aria-hidden className="gate-pulse absolute -inset-3 rounded-full bg-cyan-400/15 blur-xl" />
            <button
              type="button"
              onClick={reroll}
              className="relative rounded-full border-[3px] border-cyan-300/70 shadow-[0_0_28px_rgba(34,211,238,0.35)] transition hover:scale-105"
              title="New avatar"
              aria-label="New avatar"
            >
              <Avatar seed={avatarSeed(name, salt)} className="h-16 w-16" />
              <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-950 px-1 text-sm leading-5 text-amber-300 shadow ring-1 ring-cyan-400/40">
                🎲
              </span>
            </button>
          </div>
          <label className="sr-only" htmlFor="online-display-name">
            Display name
          </label>
          <input
            id="online-display-name"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              setError("");
            }}
            maxLength={16}
            placeholder="Your name"
            className="mt-4 w-full max-w-[14rem] border-0 border-b border-cyan-400/35 bg-transparent px-1 py-2 text-center font-display text-2xl font-bold tracking-wide text-white outline-none placeholder:text-slate-500 focus:border-cyan-300"
          />
          <p className="mt-2 text-xs text-slate-500">Tap the face to reshuffle · same name for create & join</p>
        </div>

        {/* Host */}
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="group relative w-full overflow-hidden rounded-xl border border-cyan-300/35 bg-gradient-to-br from-cyan-500/20 via-slate-950/40 to-slate-950/10 px-4 py-3 text-left transition hover:border-cyan-300/70 hover:shadow-[0_0_28px_rgba(34,211,238,0.18)] disabled:opacity-50 sm:px-5"
        >
          <span
            aria-hidden
            className="absolute inset-y-0 left-0 w-0.5 bg-gradient-to-b from-cyan-200 via-cyan-400 to-cyan-700"
          />
          <span className="flex items-center justify-between gap-3">
            <span>
              <span className="font-display text-[9px] font-bold uppercase tracking-[0.28em] text-cyan-300">
                Host the table
              </span>
              <span className="mt-0.5 block font-display text-lg font-bold tracking-wide text-white">
                {pending ? "Opening portal…" : "Open a room"}
              </span>
            </span>
            <span
              aria-hidden
              className="font-display text-xl text-cyan-300/80 transition group-hover:translate-x-0.5 group-hover:text-cyan-200"
            >
              ↗
            </span>
          </span>
        </button>

        {/* Join */}
        <div>
          <div className="mb-2.5 flex items-center gap-3">
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
            <span className="font-display text-[9px] font-bold uppercase tracking-[0.3em] text-amber-300/90">
              Or beam into one
            </span>
            <span className="h-px flex-1 bg-gradient-to-r from-transparent via-amber-400/40 to-transparent" />
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              join();
            }}
            className="flex items-center gap-2.5"
          >
            <div className="flex gap-1.5" onPaste={onDigitPaste}>
              {digits.map((d, i) => (
                <input
                  key={i}
                  ref={(el) => {
                    digitRefs.current[i] = el;
                  }}
                  value={d}
                  onChange={(e) => setDigit(i, e.target.value)}
                  onKeyDown={(e) => onDigitKey(i, e)}
                  onFocus={(e) => e.target.select()}
                  maxLength={1}
                  inputMode="text"
                  autoCapitalize="characters"
                  aria-label={`Room code letter ${i + 1}`}
                  className="h-11 w-10 rounded-lg border border-amber-300/30 bg-slate-950/70 text-center font-mono text-lg font-bold text-amber-100 outline-none transition focus:border-amber-300 focus:shadow-[0_0_0_2px_rgba(245,158,11,0.2)] sm:h-12 sm:w-11"
                />
              ))}
            </div>
            <button
              type="submit"
              className="ui-btn ui-btn-accent ml-auto px-5 py-2.5 font-display text-xs uppercase tracking-wider"
            >
              Join
            </button>
          </form>
        </div>

        {error && (
          <p className="text-center text-sm font-medium text-rose-400 sm:text-left" role="alert">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
