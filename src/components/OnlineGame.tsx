"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import Board, { Token } from "./Board";
import Avatar from "./Avatar";
import AvatarPicker from "./AvatarPicker";
import Dice from "./Dice";
import { PLAYER_COLORS } from "@/lib/game";
import { DICE_ROLL_MS, LastMove, RoomState, ServerInfo, SLIDE_MS, SLIDE_PAUSE_MS, STEP_MS } from "@/lib/online";
import { avatarSeed, randomSalt } from "@/lib/avatar";
import { getPlayerId, getSavedName, getSavedSalt, getSocket, saveName, saveSalt } from "@/lib/socket";

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
  const [myId] = useState(getPlayerId);

  const roomRef = useRef<RoomState | null>(null);
  const lastSeq = useRef<number | null>(null);
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pendingMoves = useRef(0);

  const syncDisplay = (r: RoomState) =>
    setDisplay(Object.fromEntries(r.players.map((p) => [p.id, p.position])));

  const animate = useCallback(async (mv: LastMove) => {
    setAnimating(true);
    setDice(mv.roll);
    setRollId((n) => n + 1);
    await sleep(DICE_ROLL_MS);
    for (let pos = mv.from + 1; pos <= mv.landed && mv.landed !== mv.from; pos++) {
      setDisplay((d) => ({ ...d, [mv.playerId]: pos }));
      await sleep(STEP_MS);
    }
    if (mv.final !== mv.landed) {
      await sleep(SLIDE_PAUSE_MS);
      setDisplay((d) => ({ ...d, [mv.playerId]: mv.final }));
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
        className="mx-auto w-full max-w-md rounded-2xl bg-white/90 p-6 shadow-xl"
      >
        <h2 className="mb-1 text-xl font-bold text-slate-800">Join room {code}</h2>
        <p className="mb-4 text-sm text-slate-500">Pick a name the other players will see.</p>
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
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-emerald-500"
          />
        </div>
        <button className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700">
          Join
        </button>
      </form>
    );
  }

  if (error && !room) {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white/90 p-6 text-center shadow-xl">
        <p className="mb-4 font-semibold text-red-600">{error}</p>
        <Link href="/" className="font-semibold text-emerald-700 underline">
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
            room.status === "playing" && p.id === current?.id ? "bg-emerald-50" : ""
          } ${p.connected ? "" : "opacity-40"}`}
        >
          <span className="flex items-center gap-2 text-slate-700">
            <span className="rounded-full border-2" style={{ borderColor: PLAYER_COLORS[p.colorIndex].fill }}>
              <Avatar seed={p.avatar} className="h-7 w-7" />
            </span>
            {p.name}
            {p.id === myId && <span className="text-xs text-emerald-600">(you)</span>}
            {p.id === room.hostId && <span className="text-xs text-amber-600">★ host</span>}
            {!p.connected && <span className="text-xs text-slate-400">offline</span>}
          </span>
          {room.status !== "lobby" && (
            <span className="font-mono text-sm text-slate-500">{display[p.id] || "start"}</span>
          )}
        </li>
      ))}
    </ul>
  );

  const banner = !connected && (
    <p className="mb-4 rounded-lg bg-amber-100 px-3 py-2 text-center text-sm font-medium text-amber-800">
      Connection lost — reconnecting…
    </p>
  );

  // --- Lobby ---
  if (room.status === "lobby") {
    return (
      <div className="mx-auto w-full max-w-md rounded-2xl bg-white/90 p-6 shadow-xl">
        {banner}
        <p className="text-center text-sm font-medium uppercase tracking-wide text-slate-500">Room code</p>
        <p className="mb-3 text-center font-mono text-5xl font-extrabold tracking-[0.3em] text-slate-800">{code}</p>
        <div className="mb-5 flex items-center gap-2 rounded-lg bg-slate-100 p-2">
          <span className="min-w-0 flex-1 truncate font-mono text-xs text-slate-600">{shareUrl}</span>
          <button onClick={copyLink} className="shrink-0 rounded-md bg-white px-3 py-1 text-sm font-semibold text-slate-700 shadow">
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>

        <h3 className="mb-2 font-bold text-slate-800">Players ({room.players.length}/4)</h3>
        {playerList}

        {isHost ? (
          <button
            onClick={startGame}
            disabled={room.players.length < 2}
            className="mt-6 w-full rounded-xl bg-emerald-600 py-3 text-lg font-bold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {room.players.length < 2 ? "Waiting for players…" : "Start game"}
          </button>
        ) : (
          <p className="mt-6 text-center text-slate-500">Waiting for the host to start…</p>
        )}
        {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
        <button onClick={leave} className="mt-4 w-full text-sm text-slate-400 hover:text-slate-600">
          Leave room
        </button>
      </div>
    );
  }

  // --- Playing / finished ---
  const tokens: Token[] = room.players.map((p) => ({
    id: p.id,
    name: p.name,
    color: PLAYER_COLORS[p.colorIndex],
    avatar: p.avatar,
    position: display[p.id] ?? p.position,
  }));
  const winner = room.status === "finished" && !animating ? room.players.find((p) => p.id === room.winnerId) : null;
  const mover = animating ? room.players.find((p) => p.id === room.lastMove?.playerId) : null;

  return (
    <div className="flex w-full flex-col gap-6 lg:flex-row lg:items-start">
      <div className="mx-auto w-full max-w-[min(90vh,640px)] flex-1">
        <Board players={tokens} currentId={winner ? null : (mover?.id ?? current?.id ?? null)} />
      </div>

      <aside className="flex w-full flex-col gap-4 lg:w-80">
        <div className="rounded-2xl bg-white/90 p-5 shadow-xl">
          {banner}
          {winner ? (
            <div className="text-center">
              <div className="relative mx-auto w-fit">
                <Avatar seed={winner.avatar} className="h-20 w-20" />
                <span className="absolute -right-3 -top-3 text-3xl">🏆</span>
              </div>
              <p className="mt-2 text-2xl font-bold" style={{ color: PLAYER_COLORS[winner.colorIndex].ring }}>
                {winner.id === myId ? "You win!" : `${winner.name} wins!`}
              </p>
            </div>
          ) : (
            <p className="flex items-center justify-center gap-2 text-lg font-semibold text-slate-700">
              {mover ? (
                <>
                  <span className="rounded-full border-2" style={{ borderColor: PLAYER_COLORS[mover.colorIndex].fill }}>
                    <Avatar seed={mover.avatar} className="h-8 w-8" />
                  </span>
                  {mover.name} is moving…
                </>
              ) : current ? (
                <>
                  <span className="rounded-full border-2" style={{ borderColor: PLAYER_COLORS[current.colorIndex].fill }}>
                    <Avatar seed={current.avatar} className="h-8 w-8" />
                  </span>
                  {current.id === myId ? "Your turn!" : `${current.name}'s turn`}
                </>
              ) : null}
            </p>
          )}

          <div className="my-4 flex justify-center">
            <Dice value={dice} rollId={rollId} />
          </div>

          {winner ? (
            isHost ? (
              <button
                onClick={startGame}
                className="w-full rounded-xl bg-emerald-600 py-3 font-bold text-white hover:bg-emerald-700"
              >
                Play again
              </button>
            ) : (
              <p className="text-center text-sm text-slate-500">Waiting for the host to start a new game…</p>
            )
          ) : me ? (
            <button
              onClick={roll}
              disabled={!myTurn}
              className="w-full rounded-xl bg-emerald-600 py-3 text-lg font-bold text-white shadow transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {myTurn ? "Roll dice" : animating ? "Moving…" : "Waiting…"}
            </button>
          ) : (
            <p className="text-center text-sm text-slate-500">You&apos;re watching this game.</p>
          )}
          {error && <p className="mt-3 text-center text-sm text-red-600">{error}</p>}
        </div>

        <div className="rounded-2xl bg-white/90 p-5 shadow-xl">
          <div className="mb-2 flex items-center justify-between">
            <h3 className="font-bold text-slate-800">Room {code}</h3>
            <button onClick={leave} className="text-xs text-slate-400 hover:text-slate-600">
              Leave
            </button>
          </div>
          {playerList}
        </div>

        <div className="rounded-2xl bg-white/90 p-5 shadow-xl">
          <h3 className="mb-2 font-bold text-slate-800">Game log</h3>
          <ul className="max-h-48 space-y-1 overflow-y-auto text-sm text-slate-600">
            {room.log.map((l, i) => (
              <li key={`${room.log.length - i}`} className={i === 0 ? "font-medium text-slate-800" : ""}>
                {l}
              </li>
            ))}
          </ul>
        </div>
      </aside>
    </div>
  );
}
