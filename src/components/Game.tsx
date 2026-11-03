"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Board from "./Board";
import Avatar from "./Avatar";
import Dice from "./Dice";
import { BOARD_SIZE, LADDERS, PLAYER_COLORS, Player, SNAKES, rollDie } from "@/lib/game";
import { DICE_ROLL_MS } from "@/lib/online";
import { avatarSeed, randomSalt } from "@/lib/avatar";

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// `salt` picks the avatar for a name; re-rolling it draws a new face.
type SetupEntry = { name: string; isComputer: boolean; salt: number };

const DEFAULT_SETUP: SetupEntry[] = [
  { name: "Player 1", isComputer: false, salt: 1 },
  { name: "Computer", isComputer: true, salt: 2 },
  { name: "Player 3", isComputer: false, salt: 3 },
  { name: "Player 4", isComputer: false, salt: 4 },
];

export default function Game() {
  const [setup, setSetup] = useState<SetupEntry[]>(DEFAULT_SETUP);
  const [playerCount, setPlayerCount] = useState(2);
  const [players, setPlayers] = useState<Player[] | null>(null);
  const [current, setCurrent] = useState(0);
  const [dice, setDice] = useState(1);
  const [rollId, setRollId] = useState(0);
  const [busy, setBusy] = useState(false);
  const [winner, setWinner] = useState<Player | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const playersRef = useRef<Player[]>([]);

  const addLog = (msg: string) => setLog((l) => [msg, ...l].slice(0, 30));

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
    }));
    playersRef.current = ps;
    setPlayers(ps);
    setCurrent(0);
    setWinner(null);
    setDice(1);
    setLog([`Game started! ${ps[0].name} goes first.`]);
  };

  const takeTurn = useCallback(async () => {
    if (busy || winner || !playersRef.current.length) return;
    setBusy(true);

    // The die tumbles and lands on the roll before the token moves.
    const roll = rollDie();
    setDice(roll);
    setRollId((n) => n + 1);
    await sleep(DICE_ROLL_MS);

    const player = playersRef.current[current];
    const start = player.position;
    const target = start + roll;

    if (target > BOARD_SIZE) {
      addLog(`${player.name} rolled ${roll} — needs exactly ${BOARD_SIZE - start} to win.`);
    } else {
      for (let pos = start + 1; pos <= target; pos++) {
        movePlayer(player.id, pos);
        await sleep(220);
      }
      let final = target;
      if (SNAKES[target]) {
        final = SNAKES[target];
        await sleep(250);
        movePlayer(player.id, final);
        addLog(`🐍 ${player.name} rolled ${roll} and slid down from ${target} to ${final}.`);
        await sleep(500);
      } else if (LADDERS[target]) {
        final = LADDERS[target];
        await sleep(250);
        movePlayer(player.id, final);
        addLog(`🪜 ${player.name} rolled ${roll} and climbed from ${target} to ${final}!`);
        await sleep(500);
      } else {
        addLog(`${player.name} rolled ${roll} and moved to ${final}.`);
      }

      if (final === BOARD_SIZE) {
        const won = playersRef.current[current];
        setWinner(won);
        addLog(`🏆 ${won.name} wins!`);
        setBusy(false);
        return;
      }
    }

    if (roll === 6) {
      addLog(`🎲 ${player.name} rolled a 6 — extra turn!`);
    } else {
      setCurrent((c) => (c + 1) % playersRef.current.length);
    }
    setBusy(false);
  }, [busy, winner, current]);

  // Computer players roll automatically
  useEffect(() => {
    if (!players || winner || busy) return;
    if (!players[current]?.isComputer) return;
    const t = setTimeout(takeTurn, 700);
    return () => clearTimeout(t);
  }, [players, current, busy, winner, takeTurn]);

  // Space / Enter rolls for human players
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
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white/90 p-6 shadow-xl">
        <h2 className="mb-4 text-xl font-bold text-slate-800">New game</h2>
        <label className="mb-2 block text-sm font-medium text-slate-600">Number of players</label>
        <div className="mb-5 flex gap-2">
          {[2, 3, 4].map((n) => (
            <button
              key={n}
              onClick={() => setPlayerCount(n)}
              className={`flex-1 rounded-lg py-2 font-semibold transition ${
                playerCount === n ? "bg-emerald-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              {n}
            </button>
          ))}
        </div>
        <div className="space-y-3">
          {setup.slice(0, playerCount).map((s, i) => (
            <div key={i} className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setSetup((prev) => prev.map((p, j) => (j === i ? { ...p, salt: randomSalt() } : p)))}
                className="relative shrink-0 rounded-full border-[3px] transition hover:scale-105"
                style={{ borderColor: PLAYER_COLORS[i].fill }}
                title="New avatar"
                aria-label={`New avatar for ${s.name || `player ${i + 1}`}`}
              >
                <Avatar seed={avatarSeed(s.name || `Player ${i + 1}`, s.salt)} className="h-10 w-10" />
                <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-0.5 text-[10px] leading-4 shadow">🎲</span>
              </button>
              <input
                value={s.name}
                onChange={(e) =>
                  setSetup((prev) => prev.map((p, j) => (j === i ? { ...p, name: e.target.value } : p)))
                }
                className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-emerald-500"
                maxLength={16}
              />
              <label className="flex shrink-0 items-center gap-1 text-sm text-slate-600">
                <input
                  type="checkbox"
                  checked={s.isComputer}
                  onChange={(e) =>
                    setSetup((prev) => prev.map((p, j) => (j === i ? { ...p, isComputer: e.target.checked } : p)))
                  }
                />
                CPU
              </label>
            </div>
          ))}
        </div>
        <button
          onClick={startGame}
          className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-lg font-bold text-white shadow hover:bg-emerald-700"
        >
          Start game
        </button>
        <p className="mt-4 text-xs text-slate-500">
          Roll a 6 for an extra turn. You need the exact number to land on 100.
        </p>
      </div>
    );
  }

  const active = players[current];

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
      <div className="mx-auto w-full max-w-[min(90vh,640px)] flex-1">
        <Board players={players} currentId={winner ? -1 : active.id} />
      </div>

      <aside className="flex w-full flex-col gap-4 lg:w-80">
        <div className="rounded-2xl bg-white/90 p-5 shadow-xl">
          {winner ? (
            <div className="text-center">
              <div className="relative mx-auto w-fit">
                <Avatar seed={winner.avatar} className="h-20 w-20" />
                <span className="absolute -right-3 -top-3 text-3xl">🏆</span>
              </div>
              <p className="mt-2 text-2xl font-bold" style={{ color: winner.color.ring }}>
                {winner.name} wins!
              </p>
            </div>
          ) : (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-700">
              <span className="rounded-full border-2" style={{ borderColor: active.color.fill }}>
                <Avatar seed={active.avatar} className="h-8 w-8" />
              </span>
              {active.name}&apos;s turn
            </p>
          )}

          <div className="my-4 flex justify-center">
            <Dice value={dice} rollId={rollId} />
          </div>

          {winner ? (
            <div className="flex gap-2">
              <button
                onClick={startGame}
                className="flex-1 rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700"
              >
                Play again
              </button>
              <button
                onClick={() => setPlayers(null)}
                className="flex-1 rounded-xl bg-slate-200 py-3 font-bold text-slate-700 hover:bg-slate-300"
              >
                New setup
              </button>
            </div>
          ) : (
            <button
              onClick={takeTurn}
              disabled={busy || active.isComputer}
              className="w-full rounded-xl bg-emerald-600 py-3 text-lg font-bold text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {active.isComputer ? "Computer is thinking…" : busy ? "Moving…" : "Roll dice"}
            </button>
          )}
        </div>

        <div className="rounded-2xl bg-white/90 p-5 shadow-xl">
          <h3 className="mb-2 font-bold text-slate-800">Players</h3>
          <ul className="space-y-1.5">
            {players.map((p) => (
              <li
                key={p.id}
                className={`flex items-center justify-between rounded-lg px-2 py-1 ${
                  p.id === active.id && !winner ? "bg-emerald-50" : ""
                }`}
              >
                <span className="flex items-center gap-2 text-slate-700">
                  <span className="rounded-full border-2" style={{ borderColor: p.color.fill }}>
                    <Avatar seed={p.avatar} className="h-7 w-7" />
                  </span>
                  {p.name} {p.isComputer && <span className="text-xs text-slate-400">(CPU)</span>}
                </span>
                <span className="font-mono text-sm text-slate-500">{p.position || "start"}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="rounded-2xl bg-white/90 p-5 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Game log</h3>
            {!winner && (
              <button onClick={() => setPlayers(null)} className="text-xs text-slate-400 hover:text-slate-600">
                Quit
              </button>
            )}
          </div>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-600">
            {log.map((l, i) => (
              <li key={i} className={i === 0 ? "font-medium text-slate-800" : ""}>
                {l}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
