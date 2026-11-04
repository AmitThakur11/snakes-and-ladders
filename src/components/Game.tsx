"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Board from "./Board";
import Avatar from "./Avatar";
import Dice from "./Dice";
import BlastHistory, { type BlastEvent } from "./VolcanoBurst";
import JumpToDice, { DICE_SECTION_ID } from "./JumpToDice";
import {
  BOARD_SIZE,
  PLAYER_COLORS,
  Player,
  generateMines,
  matchShouldEnd,
  nextFinishRank,
  rankLabel,
  resolveLanding,
  rollDie,
} from "@/lib/game";
import { DICE_ROLL_MS, MINE_BLAST_MS, MINE_PAUSE_MS } from "@/lib/online";
import { avatarSeed, randomSalt } from "@/lib/avatar";
import { playDiceRoll, playMoveStep, playVolcanoBurst, prefetchSfx } from "@/lib/sfx";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

type SetupEntry = { name: string; isComputer: boolean; salt: number };

const DEFAULT_SETUP: SetupEntry[] = [
  { name: "Player 1", isComputer: false, salt: 1 },
  { name: "Computer", isComputer: true, salt: 2 },
  { name: "Player 3", isComputer: false, salt: 3 },
  { name: "Player 4", isComputer: false, salt: 4 },
  { name: "Player 5", isComputer: false, salt: 5 },
  { name: "Player 6", isComputer: false, salt: 6 },
];

function nextActiveIndex(players: Player[], from: number): number {
  const n = players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (from + i) % n;
    if (players[idx].rank == null) return idx;
  }
  return from;
}

export default function Game({
  onBoardActiveChange,
  exitRequest = 0,
}: {
  onBoardActiveChange?: (active: boolean) => void;
  /** Incremented by parent Exit button to return to setup. */
  exitRequest?: number;
} = {}) {
  const [setup, setSetup] = useState<SetupEntry[]>(DEFAULT_SETUP);
  const [playerCount, setPlayerCount] = useState(2);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [dice, setDice] = useState(1);
  const [rollId, setRollId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [finished, setFinished] = useState(false);
  const [mineBurst, setMineBurst] = useState<{ id: number; at: number; to: number } | null>(null);
  const [blastHistory, setBlastHistory] = useState<BlastEvent[]>([]);
  const playersRef = useRef<Player[]>([]);
  const minesRef = useRef<number[]>([]);
  const blastIdRef = useRef(0);
  const lastExitRequest = useRef(0);

  useEffect(() => {
    prefetchSfx();
  }, []);

  // Notify parent when a match is active — only clear on unmount (not every players update)
  useEffect(() => {
    onBoardActiveChange?.(players != null);
  }, [players, onBoardActiveChange]);

  useEffect(() => {
    return () => onBoardActiveChange?.(false);
  }, [onBoardActiveChange]);

  useEffect(() => {
    if (exitRequest <= 0 || exitRequest === lastExitRequest.current) return;
    lastExitRequest.current = exitRequest;
    playersRef.current = [];
    minesRef.current = [];
    setPlayers(null);
    setFinished(false);
    setBusy(false);
    setMineBurst(null);
    setBlastHistory([]);
  }, [exitRequest]);

  const movePlayer = (id: number, position: number) => {
    playersRef.current = playersRef.current.map((p) => (p.id === id ? { ...p, position } : p));
    setPlayers(playersRef.current);
  };

  const startGame = () => {
    const ps: Player[] = setup.slice(0, playerCount).map((s, i) => ({
      id: i,
      name: s.name.trim() || `Player ${i + 1}`,
      color: PLAYER_COLORS[i],
      position: 0,
      isComputer: s.isComputer,
      avatar: avatarSeed(s.name.trim() || `Player ${i + 1}`, s.salt),
      rank: null,
    }));
    playersRef.current = ps;
    minesRef.current = generateMines();
    setPlayers(ps);
    setCurrent(0);
    setFinished(false);
    setDice(1);
    setMineBurst(null);
    setBlastHistory([]);
    blastIdRef.current = 0;
  };

  const takeTurn = useCallback(async () => {
    if (busy || finished || !playersRef.current.length) return;
    const player = playersRef.current[current];
    if (!player || player.rank != null) return;
    setBusy(true);
    setMineBurst(null);

    const roll = rollDie();
    setDice(roll);
    setRollId((n) => n + 1);
    playDiceRoll();
    await sleep(DICE_ROLL_MS);

    const start = player.position;
    const target = start + roll;

    if (target <= BOARD_SIZE) {
      for (let pos = start + 1; pos <= target; pos++) {
        movePlayer(player.id, pos);
        playMoveStep();
        await sleep(180);
      }

      const resolved = resolveLanding(target, minesRef.current);
      minesRef.current = resolved.mines;

      let slideFrom = target;
      if (resolved.mineAt != null && resolved.mineTo != null) {
        const id = ++blastIdRef.current;
        const event: BlastEvent = {
          id,
          at: resolved.mineAt,
          to: resolved.mineTo,
          name: player.name,
          createdAt: Date.now(),
        };
        setBlastHistory((prev) => [...prev, event]);
        setMineBurst({ id, at: resolved.mineAt, to: resolved.mineTo });
        playVolcanoBurst();
        await sleep(MINE_PAUSE_MS);
        movePlayer(player.id, resolved.mineTo);
        playMoveStep();
        await sleep(MINE_BLAST_MS);
        setMineBurst(null);
        slideFrom = resolved.mineTo;
      }

      const final = resolved.final;
      if (final !== slideFrom) {
        await sleep(250);
        movePlayer(player.id, final);
        playMoveStep();
        await sleep(400);
      }

      if (final === BOARD_SIZE) {
        const rank = nextFinishRank(playersRef.current);
        playersRef.current = playersRef.current.map((p) => (p.id === player.id ? { ...p, rank } : p));
        setPlayers(playersRef.current);

        if (matchShouldEnd(playersRef.current)) {
          const last = playersRef.current.find((p) => p.rank == null);
          if (last) {
            playersRef.current = playersRef.current.map((p) =>
              p.id === last.id ? { ...p, rank: playersRef.current.length } : p,
            );
            setPlayers(playersRef.current);
          }
          setFinished(true);
          setBusy(false);
          return;
        }
      }
    }

    if (roll !== 6 || playersRef.current[current]?.rank != null) {
      setCurrent((c) => nextActiveIndex(playersRef.current, c));
    }
    setBusy(false);
  }, [busy, finished, current]);

  useEffect(() => {
    if (!players || finished || busy) return;
    if (!players[current] || players[current].rank != null) {
      // skip a player who has already finished; deferred so it isn't a state update inside the effect
      const t = setTimeout(() => setCurrent((c) => nextActiveIndex(players, c)), 0);
      return () => clearTimeout(t);
    }
    if (!players[current].isComputer) return;
    const t = setTimeout(takeTurn, 700);
    return () => clearTimeout(t);
  }, [players, current, busy, finished, takeTurn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "Enter") && players && !players[current]?.isComputer) {
        e.preventDefault();
        takeTurn();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [players, current, takeTurn]);

  if (!players) {
    return (
      <div className="ui-panel mx-auto flex w-full max-w-xl flex-col p-6 sm:p-8 lg:max-w-none lg:min-h-[28rem] lg:p-9">
        <h2 className="font-display mb-5 text-xl font-bold tracking-wide text-white sm:text-2xl">New game</h2>
        <label className="mb-2.5 block text-xs font-semibold uppercase tracking-wider text-cyan-300/80">
          Number of players
        </label>
        <div className="mb-6 flex gap-2.5">
          {[2, 3, 4, 5, 6].map((n) => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`ui-btn flex-1 py-3 text-base font-semibold ${
                playerCount === n ? "ui-btn-primary" : "ui-btn-ghost"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="flex-1 space-y-3.5">
          {setup.slice(0, playerCount).map((s, i) => (
            <div key={i} className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSetup((prev) => prev.map((p, j) => (j === i ? { ...p, salt: randomSalt() } : p)))}
                className="relative shrink-0 rounded-full border-[3px] transition hover:scale-105"
                style={{ borderColor: PLAYER_COLORS[i].fill }}
                title="New avatar"
                aria-label={`New avatar for ${s.name || `player ${i + 1}`}`}
              >
                <Avatar seed={avatarSeed(s.name || `Player ${i + 1}`, s.salt)} className="h-11 w-11" />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-slate-900 px-0.5 text-[10px] leading-4 text-amber-300 shadow ring-1 ring-cyan-400/30">
                  🎲
                </span>
              </button>
              <input
                value={s.name}
                onChange={(e) =>
                  setSetup((prev) => prev.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))
                }
                className="ui-input min-w-0 flex-1"
                maxLength={16}
              />
              <label className="flex shrink-0 items-center gap-1.5 text-sm text-slate-400">
                <input
                  type="checkbox"
                  checked={s.isComputer}
                  onChange={(e) =>
                    setSetup((prev) => prev.map((p, j) => (j === i ? { ...p, isComputer: e.target.checked } : p)))
                  }
                  className="accent-cyan-400"
                />
                CPU
              </label>
            </div>
          ))}
        </div>
        <button onClick={startGame} className="ui-btn ui-btn-primary mt-7 w-full py-3.5 text-lg">
          Start game
        </button>
        <p className="mt-4 text-xs leading-relaxed text-slate-500">
          Roll a 6 for an extra turn. Exact landing on {BOARD_SIZE} finishes. Play continues until the 2nd-last
          player finishes so everyone gets a place.
        </p>
      </div>
    );
  }

  const active = players[current];
  const podium = [...players].filter((p) => p.rank != null).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const stillRacing = players.some((p) => p.rank == null);

  return (
    <div className="flex h-[calc(100dvh-3.5rem)] w-full min-h-[420px] flex-col gap-4 lg:flex-row lg:items-stretch">
      <div className="relative min-h-[320px] min-w-0 flex-1 lg:min-h-0">
        <Board
          players={players}
          currentId={finished ? null : active?.id ?? null}
          burstSquare={mineBurst?.at ?? null}
        />
        <JumpToDice />
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-80 lg:max-h-full">
        <div id={DICE_SECTION_ID} className="ui-panel p-5">
          {finished ? (
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-white">Final podium</p>
              <ol className="mt-3 space-y-2 text-left">
                {podium.map((p) => (
                  <li
                    key={p.id}
                    className="flex items-center gap-2 rounded-lg bg-slate-950/50 px-2 py-1.5 ring-1 ring-cyan-400/10"
                  >
                    <span className="w-10 text-sm font-bold text-amber-300">{rankLabel(p.rank!)}</span>
                    <span className="rounded-full border-2" style={{ borderColor: p.color.fill }}>
                      <Avatar seed={p.avatar} className="h-8 w-8" />
                    </span>
                    <span className="font-semibold text-slate-200">{p.name}</span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-100">
              <span className="rounded-full border-2" style={{ borderColor: active.color.fill }}>
                <Avatar seed={active.avatar} className="h-8 w-8" />
              </span>
              {active.name}&apos;s turn
            </p>
          )}

          <div className="my-4 flex justify-center overflow-visible py-6">
            {/* tapping the die rolls it, same as the Roll dice button */}
            <button
              type="button"
              onClick={takeTurn}
              disabled={finished || busy || active.isComputer || active.rank != null}
              aria-label="Roll dice"
              title="Tap to roll"
              className="rounded-2xl outline-none transition enabled:cursor-pointer enabled:hover:scale-105 enabled:active:scale-95 focus-visible:ring-2 focus-visible:ring-cyan-300 disabled:cursor-default"
            >
              <Dice value={dice} rollId={rollId} />
            </button>
          </div>

          <BlastHistory
            events={blastHistory}
            liveId={mineBurst?.id ?? null}
            onExpire={setBlastHistory}
          />

          {finished ? (
            <div className="flex gap-2">
              <button onClick={startGame} className="ui-btn ui-btn-primary flex-1 py-3">
                Play again
              </button>
              <button onClick={() => setPlayers(null)} className="ui-btn ui-btn-ghost flex-1 py-3">
                New setup
              </button>
            </div>
          ) : (
            <button
              onClick={takeTurn}
              disabled={busy || active.isComputer || active.rank != null}
              className="ui-btn ui-btn-primary w-full py-3 text-lg"
            >
              {busy
                ? mineBurst
                  ? "Volcano blast…"
                  : active.isComputer
                    ? `${active.name} is moving…`
                    : "Moving…"
                : active.isComputer
                  ? `Waiting for ${active.name}…`
                  : "Roll dice"}
            </button>
          )}
        </div>

        <div className="ui-panel p-5">
          <h3 className="font-display mb-2 font-bold tracking-wide text-white">
            {stillRacing ? "Players" : "Results"}
          </h3>
          <ul className="space-y-1.5">
            {[...players]
              .sort((a, b) => (a.rank ?? 100) - (b.rank ?? 100) || a.id - b.id)
              .map((p) => (
                <li
                  key={p.id}
                  className={`flex items-center justify-between rounded-lg px-2 py-1 ${
                    p.id === active?.id && !finished ? "bg-cyan-500/10 ring-1 ring-cyan-400/25" : ""
                  }`}
                >
                  <span className="flex items-center gap-2 text-slate-200">
                    <span className="rounded-full border-2" style={{ borderColor: p.color.fill }}>
                      <Avatar seed={p.avatar} className="h-7 w-7" />
                    </span>
                    {p.name} {p.isComputer && <span className="text-xs text-slate-500">(CPU)</span>}
                    {p.rank != null && (
                      <span className="rounded bg-amber-400/15 px-1.5 text-xs font-bold text-amber-300">
                        {rankLabel(p.rank)}
                      </span>
                    )}
                  </span>
                  <span className="font-mono text-sm text-slate-500">
                    {p.rank != null ? "done" : p.position || "start"}
                  </span>
                </li>
              ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
