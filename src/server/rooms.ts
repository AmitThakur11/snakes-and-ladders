import type { Server, Socket } from "socket.io";
import { BOARD_SIZE, LADDERS, SNAKES, rollDie } from "../lib/game";
import { cleanAvatar } from "../lib/avatar";
import { Ack, MAX_PLAYERS, OnlinePlayer, RoomState, ServerInfo, moveDuration } from "../lib/online";

type ServerPlayer = OnlinePlayer & { socketId: string | null };

type Room = Omit<RoomState, "players"> & {
  players: ServerPlayer[];
  busyUntil: number;
  seq: number;
  cleanupTimer: NodeJS.Timeout | null;
};

const rooms = new Map<string, Room>();
const ROOM_IDLE_MS = 10 * 60 * 1000;
const RECONNECT_GRACE_MS = 15 * 1000;

function newCode(): string {
  const letters = "ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code: string;
  do {
    code = Array.from({ length: 4 }, () => letters[Math.floor(Math.random() * letters.length)]).join("");
  } while (rooms.has(code));
  return code;
}

function cleanName(name: unknown): string {
  return (typeof name === "string" ? name.trim().slice(0, 16) : "") || "Player";
}

function cleanId(id: unknown): string | null {
  return typeof id === "string" && /^[\w-]{6,64}$/.test(id) ? id : null;
}

function toState(room: Room): RoomState {
  return {
    code: room.code,
    hostId: room.hostId,
    status: room.status,
    players: room.players.map((p) => ({
      id: p.id,
      name: p.name,
      avatar: p.avatar,
      colorIndex: p.colorIndex,
      position: p.position,
      connected: p.connected,
    })),
    currentIndex: room.currentIndex,
    winnerId: room.winnerId,
    lastMove: room.lastMove,
    log: room.log,
  };
}

function addLog(room: Room, msg: string) {
  room.log = [msg, ...room.log].slice(0, 30);
}

/** Move the turn to the next connected player (or stay put if nobody else is connected). */
function advanceTurn(room: Room) {
  const n = room.players.length;
  for (let i = 1; i <= n; i++) {
    const idx = (room.currentIndex + i) % n;
    if (room.players[idx].connected) {
      room.currentIndex = idx;
      return;
    }
  }
}

function resetGame(room: Room) {
  room.players.forEach((p) => (p.position = 0));
  room.status = "playing";
  room.currentIndex = 0;
  room.winnerId = null;
  room.lastMove = null;
  room.busyUntil = 0;
  if (!room.players[0].connected) advanceTurn(room);
  room.log = [`Game started! ${room.players[room.currentIndex].name} goes first.`];
}

function scheduleCleanup(room: Room) {
  if (room.cleanupTimer) clearTimeout(room.cleanupTimer);
  room.cleanupTimer = null;
  if (room.players.some((p) => p.connected)) return;
  room.cleanupTimer = setTimeout(() => rooms.delete(room.code), ROOM_IDLE_MS);
}

export function registerRoomHandlers(io: Server, info: ServerInfo) {
  const broadcast = (room: Room) => io.to(room.code).emit("room:state", toState(room));

  const handleLeave = (socket: Socket, explicit: boolean) => {
    const { code, playerId } = socket.data as { code?: string; playerId?: string };
    const room = code ? rooms.get(code) : undefined;
    if (!room || !playerId) return;
    const player = room.players.find((p) => p.id === playerId);
    // Ignore disconnects from an older tab when the player has since reconnected elsewhere.
    if (!player || (!explicit && player.socketId !== socket.id)) return;

    socket.leave(room.code);
    socket.data = {};
    player.socketId = null;

    // A dropped connection (refresh, phone screen locking) gets a grace period to rejoin the same seat.
    if (explicit) dropPlayer(room, playerId);
    else
      setTimeout(() => {
        const p = room.players.find((q) => q.id === playerId);
        if (p && p.socketId === null && rooms.get(room.code) === room) dropPlayer(room, playerId);
      }, RECONNECT_GRACE_MS);
  };

  const dropPlayer = (room: Room, playerId: string) => {
    const player = room.players.find((p) => p.id === playerId)!;
    if (room.status === "lobby") {
      room.players = room.players.filter((p) => p.id !== playerId);
    } else {
      player.connected = false;
      addLog(room, `${player.name} left the game.`);
      if (room.status === "playing" && room.players[room.currentIndex]?.id === playerId) advanceTurn(room);
    }

    if (room.players.length === 0) {
      rooms.delete(room.code);
      return;
    }
    if (room.hostId === playerId) {
      const next = room.players.find((p) => p.connected);
      if (next) room.hostId = next.id;
    }
    scheduleCleanup(room);
    broadcast(room);
  };

  io.on("connection", (socket) => {
    socket.on("room:create", (payload: { name?: unknown; playerId?: unknown }, ack: Ack<{ code: string }>) => {
      const playerId = cleanId(payload?.playerId);
      if (!playerId) return ack({ ok: false, error: "Invalid player id" });
      const code = newCode();
      rooms.set(code, {
        code,
        hostId: playerId,
        status: "lobby",
        players: [],
        currentIndex: 0,
        winnerId: null,
        lastMove: null,
        log: [],
        busyUntil: 0,
        seq: 0,
        cleanupTimer: null,
      });
      // The creator joins via room:join from the room page, like everyone else.
      scheduleCleanup(rooms.get(code)!);
      ack({ ok: true, code });
    });

    socket.on("room:join", (payload: { code?: unknown; name?: unknown; avatar?: unknown; playerId?: unknown }, ack: Ack<{ info: ServerInfo }>) => {
      const playerId = cleanId(payload?.playerId);
      const code = typeof payload?.code === "string" ? payload.code.toUpperCase() : "";
      const room = rooms.get(code);
      if (!playerId) return ack({ ok: false, error: "Invalid player id" });
      if (!room) return ack({ ok: false, error: "Room not found. It may have expired." });

      if (socket.data.code && socket.data.code !== code) handleLeave(socket, true);

      let player = room.players.find((p) => p.id === playerId);
      if (player) {
        player.connected = true;
        player.socketId = socket.id;
        if (room.status === "lobby") {
          player.name = cleanName(payload?.name);
          player.avatar = cleanAvatar(payload?.avatar);
        }
      } else {
        if (room.status !== "lobby") return ack({ ok: false, error: "That game has already started." });
        if (room.players.length >= MAX_PLAYERS) return ack({ ok: false, error: "Room is full (4 players max)." });
        const used = new Set(room.players.map((p) => p.colorIndex));
        const colorIndex = [0, 1, 2, 3].find((c) => !used.has(c))!;
        player = {
          id: playerId,
          name: cleanName(payload?.name),
          avatar: cleanAvatar(payload?.avatar),
          colorIndex,
          position: 0,
          connected: true,
          socketId: socket.id,
        };
        room.players.push(player);
      }
      if (!room.players.some((p) => p.id === room.hostId && p.connected)) room.hostId = playerId;

      socket.data = { code, playerId };
      socket.join(code);
      scheduleCleanup(room);
      ack({ ok: true, info });
      broadcast(room);
    });

    const withRoom = (fn: (room: Room, playerId: string, ack: Ack) => void) => (_: unknown, ack?: Ack) => {
      const reply: Ack = typeof ack === "function" ? ack : () => {};
      const { code, playerId } = socket.data as { code?: string; playerId?: string };
      const room = code ? rooms.get(code) : undefined;
      if (!room || !playerId) return reply({ ok: false, error: "Not in a room" });
      fn(room, playerId, reply);
    };

    socket.on(
      "game:start",
      withRoom((room, playerId, ack) => {
        if (room.hostId !== playerId) return ack({ ok: false, error: "Only the host can start the game." });
        if (room.status === "playing") return ack({ ok: false, error: "Game already running." });
        if (room.players.filter((p) => p.connected).length < 2)
          return ack({ ok: false, error: "Need at least 2 players." });
        // Players who dropped out before a restart don't get a seat in the new game.
        room.players = room.players.filter((p) => p.connected);
        resetGame(room);
        ack({ ok: true });
        broadcast(room);
      }),
    );

    socket.on(
      "game:roll",
      withRoom((room, playerId, ack) => {
        if (room.status !== "playing") return ack({ ok: false, error: "Game is not running." });
        const player = room.players[room.currentIndex];
        if (player.id !== playerId) return ack({ ok: false, error: "It's not your turn." });
        if (Date.now() < room.busyUntil) return ack({ ok: false, error: "Wait for the move to finish." });

        const roll = rollDie();
        const from = player.position;
        const landed = from + roll <= BOARD_SIZE ? from + roll : from;
        const final = SNAKES[landed] ?? LADDERS[landed] ?? landed;
        player.position = final;
        room.lastMove = { seq: ++room.seq, playerId, roll, from, landed, final };
        room.busyUntil = Date.now() + moveDuration(from, landed, final) + 100;

        if (landed === from) addLog(room, `${player.name} rolled ${roll} — needs exactly ${BOARD_SIZE - from} to win.`);
        else if (SNAKES[landed]) addLog(room, `🐍 ${player.name} rolled ${roll} and slid down from ${landed} to ${final}.`);
        else if (LADDERS[landed]) addLog(room, `🪜 ${player.name} rolled ${roll} and climbed from ${landed} to ${final}!`);
        else addLog(room, `${player.name} rolled ${roll} and moved to ${final}.`);

        if (final === BOARD_SIZE) {
          room.status = "finished";
          room.winnerId = player.id;
          addLog(room, `🏆 ${player.name} wins!`);
        } else if (roll === 6) {
          addLog(room, `🎲 ${player.name} rolled a 6 — extra turn!`);
        } else {
          advanceTurn(room);
        }
        ack({ ok: true });
        broadcast(room);
      }),
    );

    socket.on(
      "room:leave",
      withRoom((_room, _playerId, ack) => {
        handleLeave(socket, true);
        ack({ ok: true });
      }),
    );

    socket.on("disconnect", () => handleLeave(socket, false));
  });
}
