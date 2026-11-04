"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Board, { Token } from "./Board";
import Avatar from "./Avatar";
import AvatarPicker from "./AvatarPicker";
import Dice from "./Dice";
import BlastHistory, { type BlastEvent } from "./VolcanoBurst";
import JumpToDice, { DICE_SECTION_ID } from "./JumpToDice";
import { PLAYER_COLORS, rankLabel } from "@/lib/game";
import {
  DICE_ROLL_MS,
  LastMove,
  MAX_PLAYERS,
  MINE_BLAST_MS,
  MINE_PAUSE_MS,
  RoomState,
  ServerInfo,
  SLIDE_MS,
  SLIDE_PAUSE_MS,
  STEP_MS,
} from "@/lib/online";
import { avatarSeed, randomSalt } from "@/lib/avatar";
import { getPlayerId, getSavedName, getSavedSalt, getSocket, saveName, saveSalt } from "@/lib/socket";
import { playDiceRoll, playMoveStep, playVolcanoBurst, prefetchSfx } from "@/lib/sfx";

// Hidden tabs throttle timers, which would make moves pile up; skip the animation there instead.
const sleep = (ms: number) =>
  document.hidden ? Promise.resolve() : new Promise((r) => setTimeout(r, ms));
type AckRes = { ok: true } | { ok: false; error: string };

export default function OnlineGame({ code }: { code: string }) {
  const router = useRouter();
  // Rendered client-only (see the room page), so browser storage is safe to read here.
  const [name, setName] = useState(getSavedName);
  const [nameDraft, setNameDraft] = useState("");
  const [salt, setSalt] = useState(getSavedSalt);
  const [room, setRoom] = useState<RoomState | null>(null);
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(true);
  const [info, setInfo] = useState<ServerInfo | null>(null);
  const [display, setDisplay] = useState<Record<string, number>>({});
  const [dice, setDice] = useState(1);
  const [rollId, setRollId] = useState(0);
  const [animating, setAnimating] = useState(false);
  const [rollPending, setRollPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const [mineBurst, setMineBurst] = useState<{ id: number; at: number; to: number } | null>(null);
  const [blastHistory, setBlastHistory] = useState<BlastEvent[]>([]);
  const [myId] = useState(getPlayerId);

  const roomRef = useRef<RoomState | null>(null);
  const lastSeq = useRef<number | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pendingMoves = useRef(0);
  const blastIdRef = useRef(0);
  const prevStatus = useRef<RoomState["status"] | null>(null);

  useEffect(() => {
    prefetchSfx();
  }, []);

  // New match → clear local blast log (client-only history).
  useEffect(() => {
    const status = room?.status ?? null;
    if (status === "playing" && prevStatus.current && prevStatus.current !== "playing") {
      setBlastHistory([]);
      blastIdRef.current = 0;
      setMineBurst(null);
    }
    prevStatus.current = status;
  }, [room?.status]);

  const syncDisplay = (r: RoomState) =>
    setDisplay(Object.fromEntries(r.players.map((p) => [p.id, p.position])));

  const animate = useCallback(async (mv: LastMove) => {
    setAnimating(true);
    setMineBurst(null);
    setDice(mv.roll);
    setRollId((n) => n + 1);
    playDiceRoll();
    await sleep(DICE_ROLL_MS);
    for (let pos = mv.from + 1; pos <= mv.landed && mv.landed !== mv.from; pos++) {
      setDisplay((d) => ({ ...d, [mv.playerId]: pos }));
      playMoveStep();
      await sleep(STEP_MS);
    }
    let slideFrom = mv.landed;
    if (mv.mineAt != null && mv.mineTo != null) {
      const id = ++blastIdRef.current;
      const who = roomRef.current?.players.find((p) => p.id === mv.playerId)?.name ?? "Player";
      const event: BlastEvent = { id, at: mv.mineAt, to: mv.mineTo, name: who, createdAt: Date.now() };
      setBlastHistory((prev) => [...prev, event]);
      setMineBurst({ id, at: mv.mineAt, to: mv.mineTo });
      playVolcanoBurst();
      await sleep(MINE_PAUSE_MS);
      setDisplay((d) => ({ ...d, [mv.playerId]: mv.mineTo! }));
      playMoveStep();
      await sleep(MINE_BLAST_MS);
      setMineBurst(null);
      slideFrom = mv.mineTo;
    }
    if (mv.final !== slideFrom) {
      await sleep(SLIDE_PAUSE_MS);
      setDisplay((d) => ({ ...d, [mv.playerId]: mv.final }));
      playMoveStep();
      await sleep(SLIDE_MS);
    }
    pendingMoves.current--;
    if (pendingMoves.current === 0) {
      if (roomRef.current) syncDisplay(roomRef.current);
      setAnimating(false);
    }
  }, []);

  // Socket wiring: join on connect (and on every reconnect), listen for room updates.
  useEffect(() => {
    if (!name || !myId) return;
    const socket = getSocket();

    const join = () =>
      socket.emit("room:join", { code, name, avatar: avatarSeed(name, salt), playerId: myId }, (res: AckRes & { info?: ServerInfo }) => {
        if (!res.ok) setError(res.error);
        else if (res.info) setInfo(res.info);
      });

    const onState = (r: RoomState) => {
      roomRef.current = r;
      setRoom(r);
      setError("");
      const mv = r.lastMove;
      if (lastSeq.current === null) {
        // First state we see: jump straight there, no replay.
        lastSeq.current = mv?.seq ?? 0;
        if (mv) setDice(mv.roll);
        syncDisplay(r);
      } else if (mv && mv.seq !== lastSeq.current) {
        lastSeq.current = mv.seq;
        pendingMoves.current++;
        queue.current = queue.current.then(() => animate(mv));
      } else if (pendingMoves.current === 0) {
        syncDisplay(r);
      }
    };

    const onConnect = () => {
      setConnected(true);
      join();
    };
    const onDisconnect = () => setConnected(false);

    socket.on("connect", onConnect);
    socket.on("disconnect", onDisconnect);
    socket.on("room:state", onState);
    if (socket.connected) join();

    return () => {
      socket.off("connect", onConnect);
      socket.off("disconnect", onDisconnect);
      socket.off("room:state", onState);
    };
  }, [code, name, salt, myId, animate]);

  const me = room?.players.find((p) => p.id === myId);
  const current = room?.players[room.currentIndex];
  const isHost = room?.hostId === myId;
  const myTurn = room?.status === "playing" && current?.id === myId && !animating && !rollPending;

  // Stable token list — Board memo skips when only unrelated room fields change.
  const tokens: Token[] = useMemo(() => {
    if (!room) return [];
    return room.players.map((p) => ({
      id: p.id,
      name: p.name,
      color: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length],
      avatar: p.avatar,
      position: display[p.id] ?? p.position,
      rank: p.rank,
    }));
  }, [room, display]);

  const roll = useCallback(() => {
    if (!myTurn) return;
    setRollPending(true);
    const send = () =>
      getSocket().emit("game:roll", null, (res: AckRes) => {
        // Our animation can finish a moment before the server's; just try again shortly.
        if (!res.ok && res.error.startsWith("Wait")) return void setTimeout(send, 300);
        setRollPending(false);
        if (!res.ok) setError(res.error);
      });
    send();
  }, [myTurn]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.code === "Space" || e.code === "Enter") && myTurn && !(e.target instanceof HTMLInputElement)) {
        e.preventDefault();
        roll();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [myTurn, roll]);

  const startGame = () =>
    getSocket().emit("game:start", null, (res: AckRes) => {
      if (!res.ok) setError(res.error);
      else setError("");
    });

  const leave = () => {
    getSocket().emit("room:leave", null, () => router.push("/"));
  };

  // A link other devices can open: swap localhost for this machine's LAN address.
  const shareUrl = (() => {
    if (typeof window === "undefined") return "";
    const { protocol, hostname, port } = window.location;
    const local = hostname === "localhost" || hostname === "127.0.0.1";
    const host = local && info?.lanAddresses[0] ? `${info.lanAddresses[0]}:${info.port}` : `${hostname}${port ? `:${port}` : ""}`;
    return `${protocol}//${host}/room/${code}`;
  })();

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard blocked — the link is visible to copy by hand
    }
  };

  // --- Name prompt (opened a shared link without a saved name) ---
  if (name === "") {
    return (
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!nameDraft.trim()) return;
          saveName(nameDraft.trim());
          setName(nameDraft.trim());
        }}
        className="mx-auto w-full max-w-md ui-panel p-6"
      >
        <h2 className="mb-1 font-display text-xl font-bold tracking-wide text-white">Join room {code}</h2>
        <p className="mb-4 text-sm text-slate-400">Pick a name the other players will see.</p>
        <div className="mb-4 flex items-center gap-3">
          <AvatarPicker
            name={nameDraft}
            salt={salt}
            onReroll={() => {
              const next = randomSalt();
              setSalt(next);
              saveSalt(next);
            }}
          />
          <input
            autoFocus
            value={nameDraft}
            onChange={(e) => setNameDraft(e.target.value)}
            maxLength={16}
            placeholder="Your name"
            className="min-w-0 flex-1 ui-input"
          />
        </div>
        <button className="ui-btn ui-btn-primary w-full py-3">
          Join
        </button>
      </form>
    );
  }

  if (error && !room) {
    return (
      <div className="mx-auto w-full max-w-md ui-panel p-6 text-center">
        <p className="mb-4 font-semibold text-rose-400">{error}</p>
        <Link href="/" className="font-semibold text-cyan-300 underline">
          Back to home
        </Link>
      </div>
    );
  }

  if (!room) {
    return <p className="text-center text-lg text-white">Connecting to room {code}…</p>;
  }

  const playerList = (
    <ul className="space-y-1.5">
      {room.players.map((p) => (
        <li
          key={p.id}
          className={`flex items-center justify-between rounded-lg px-2 py-1 ${
            room.status === "playing" && p.id === current?.id ? "bg-cyan-500/10 ring-1 ring-cyan-400/25" : ""
          } ${p.connected ? "" : "opacity-40"}`}
        >
          <span className="flex items-center gap-2 text-slate-200">
            <span
              className="rounded-full border-2"
              style={{ borderColor: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length].fill }}
            >
              <Avatar seed={p.avatar} className="h-7 w-7" />
            </span>
            {p.name}
            {p.id === myId && <span className="text-xs text-cyan-300">(you)</span>}
            {p.id === room.hostId && <span className="text-xs text-amber-600">★ host</span>}
            {!p.connected && <span className="text-xs text-slate-400">offline</span>}
          </span>
          {room.status !== "lobby" && (
            <span className="flex items-center gap-1.5 font-mono text-sm text-slate-400">
              {p.rank != null && (
                <span className="rounded bg-amber-400/15 px-1.5 text-xs font-bold text-amber-300">
                  {rankLabel(p.rank)}
                </span>
              )}
              {p.rank != null ? "done" : display[p.id] || "start"}
            </span>
          )}
        </li>
      ))}
    </ul>
  );

  const banner = !connected && (
    <p className="mb-4 rounded-lg bg-amber-400/15 px-3 py-2 text-center text-sm font-medium text-amber-200 ring-1 ring-amber-400/25">
      Connection lost — reconnecting…
    </p>
  );

  // --- Lobby ---
  if (room.status === "lobby") {
    return (
      <div className="mx-auto w-full max-w-md ui-panel p-6">
        {banner}
        <p className="text-center text-sm font-medium uppercase tracking-wide text-slate-500">Room code</p>
        <p className="mb-3 text-center font-mono text-5xl font-extrabold tracking-[0.3em] text-cyan-200">{code}</p>
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-slate-950/60 p-2 ring-1 ring-cyan-400/15">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-400">{shareUrl}</span>
          <button onClick={copyLink} className="shrink-0 rounded-md bg-white px-3 py-1 text-sm font-semibold text-slate-200 shadow">
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <h3 className="mb-2 font-display font-bold tracking-wide text-white">
          Players ({room.players.length}/{MAX_PLAYERS})
        </h3>
        {playerList}

        {isHost ? (
          <button
            onClick={startGame}
            disabled={room.players.length < 2}
            className="ui-btn ui-btn-primary mt-6 w-full py-3 text-lg"
          >
            {room.players.length < 2 ? "Waiting for players…" : "Start game"}
          </button>
        ) : (
          <p className="mt-6 text-center text-slate-500">Waiting for the host to start…</p>
        )}
        {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
        <button onClick={leave} className="mt-4 w-full text-sm text-slate-400 hover:text-slate-400">
          Leave room
        </button>
      </div>
    );
  }

  // --- Playing / finished ---
  const showPodium = room.status === "finished" && !animating;
  const podium = [...room.players].filter((p) => p.rank != null).sort((a, b) => (a.rank ?? 99) - (b.rank ?? 99));
  const mover = animating ? room.players.find((p) => p.id === room.lastMove?.playerId) : null;
  const myFinished = me?.rank != null;

  return (
    <div className="flex h-[calc(100dvh-4.5rem)] w-full min-h-[420px] flex-col gap-4 lg:flex-row lg:items-stretch">
      <div className="relative min-h-[320px] min-w-0 flex-1 lg:min-h-0">
        <Board
          players={tokens}
          currentId={showPodium ? null : (mover?.id ?? current?.id ?? null)}
          burstSquare={mineBurst?.at ?? null}
        />
        <JumpToDice />
      </div>

      <aside className="flex w-full shrink-0 flex-col gap-3 overflow-y-auto lg:w-80 lg:max-h-full">
        <div id={DICE_SECTION_ID} className="ui-panel p-5">
          {banner}
          {showPodium ? (
            <div className="text-center">
              <p className="font-display text-2xl font-bold text-white">Final podium</p>
              <ol className="mt-3 space-y-2 text-left">
                {podium.map((p) => (
                  <li key={p.id} className="flex items-center gap-2 rounded-lg bg-slate-50 px-2 py-1.5">
                    <span className="w-10 text-sm font-bold text-amber-600">{rankLabel(p.rank!)}</span>
                    <span
                      className="rounded-full border-2"
                      style={{ borderColor: PLAYER_COLORS[p.colorIndex % PLAYER_COLORS.length].fill }}
                    >
                      <Avatar seed={p.avatar} className="h-8 w-8" />
                    </span>
                    <span className="font-semibold text-slate-200">
                      {p.name}
                      {p.id === myId ? " (you)" : ""}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          ) : (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-200">
              {mover ? (
                <>
                  <span
                    className="rounded-full border-2"
                    style={{ borderColor: PLAYER_COLORS[mover.colorIndex % PLAYER_COLORS.length].fill }}
                  >
                    <Avatar seed={mover.avatar} className="h-8 w-8" />
                  </span>
                  {mover.name} is moving…
                </>
              ) : myFinished ? (
                <>You finished {me?.rank != null ? rankLabel(me.rank) : ""} — watching the race…</>
              ) : current ? (
                <>
                  <span
                    className="rounded-full border-2"
                    style={{ borderColor: PLAYER_COLORS[current.colorIndex % PLAYER_COLORS.length].fill }}
                  >
                    <Avatar seed={current.avatar} className="h-8 w-8" />
                  </span>
                  {current.id === myId ? "Your turn!" : `${current.name}'s turn`}
                </>
              ) : null}
            </p>
          )}

          <div className="my-4 flex justify-center overflow-visible py-6">
            {/* tapping the die rolls it, same as the Roll dice button */}
            <button
              type="button"
              onClick={roll}
              disabled={!me || showPodium || !myTurn || myFinished}
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

          {showPodium ? (
            isHost ? (
              <button
                onClick={startGame}
                className="ui-btn ui-btn-primary w-full py-3"
              >
                Play again
              </button>
            ) : (
              <p className="text-center text-sm text-slate-400">Waiting for the host to start a new game…</p>
            )
          ) : me ? (
            <button
              onClick={roll}
              disabled={!myTurn || myFinished}
              className="ui-btn ui-btn-primary w-full py-3 text-lg"
            >
              {myFinished
                ? "Finished — watching…"
                : myTurn
                  ? "Roll dice"
                  : mineBurst
                    ? "Volcano blast…"
                    : (animating || rollPending) && current?.id === myId
                      ? "Moving…"
                      : animating
                        ? `${current?.name ?? "Player"} is moving…`
                        : current
                          ? `Waiting for ${current.name}…`
                          : "Waiting for next turn…"}
            </button>
          ) : (
            <p className="text-center text-sm text-slate-400">You&apos;re watching this game.</p>
          )}
          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
        </div>

        <div className="ui-panel p-5">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-display font-bold tracking-wide text-white">Room {code}</h3>
            <button onClick={leave} className="text-xs text-slate-400 hover:text-slate-400">
              Leave
            </button>
          </div>
          {playerList}
        </div>

      </aside>
    </div>
  );
}
