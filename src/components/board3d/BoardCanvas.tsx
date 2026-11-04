"use client";

import { Suspense, memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { STEP_MS } from "@/lib/online";
import {
  BOARD_SIZE,
  GRID,
  LADDERS,
  SNAKES,
  squareToCoords,
  squareToWorld,
} from "@/lib/game";
import type { Token } from "../Board";

const BOARD_PLANE_ARGS: [number, number] = [GRID, GRID];
const START_PAD_ARGS: [number, number] = [0.48, 28];
const TOKEN_BASE_ARGS: [number, number, number, number] = [0.26, 0.26, 0.08, 16];
const TOKEN_BODY_ARGS: [number, number, number, number] = [0.18, 0.2, 4, 12];
const TOKEN_HEAD_ARGS: [number, number, number] = [0.18, 14, 14];
const TOKEN_RING_ARGS: [number, number] = [0.38, 24];

// Wooden tactile board: kraft-card squares, serif numbers, raised dots and peg holes,
// a polished rosewood frame, flat painted ladders and cut-out snakes.
const CARD = "#c8a06c";
const GRID_LINE = "#4a2c17";
const NUMBER_INK = "#1c140c";
const ROSEWOOD = "#6b2614";
const LADDER_PAINT = "#f5a92a";
const LADDER_EDGE = "#b8700c";
const SNAKE_PAINTS = ["#e2402a", "#1b1b1b", "#7b2d1a"];

/** Small deterministic PRNG so the card speckle and dot patterns never change between renders. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Kraft-card squares with grid lines, braille-style raised dots, peg holes and serif numbers. */
function buildBoardTexture(): THREE.CanvasTexture {
  const size = 2048;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cell = size / GRID;
  const rand = seeded(7);

  ctx.fillStyle = GRID_LINE;
  ctx.fillRect(0, 0, size, size);

  for (let n = 1; n <= BOARD_SIZE; n++) {
    const { row, col } = squareToCoords(n);
    const x = col * cell;
    const y = (GRID - 1 - row) * cell;
    const inset = cell * 0.025;
    const w = cell - inset * 2;

    // card face with a slight per-square shade, then speckle
    const shade = 0.94 + rand() * 0.1;
    const base = new THREE.Color(CARD).multiplyScalar(shade);
    ctx.fillStyle = `#${base.getHexString()}`;
    ctx.fillRect(x + inset, y + inset, w, w);
    for (let i = 0; i < 90; i++) {
      ctx.fillStyle = rand() < 0.5 ? "rgba(255,240,210,0.18)" : "rgba(70,40,15,0.12)";
      ctx.fillRect(x + inset + rand() * w, y + inset + rand() * w, 2, 2);
    }
    // embossed edge: light top-left, shadow bottom-right
    ctx.fillStyle = "rgba(255,245,220,0.22)";
    ctx.fillRect(x + inset, y + inset, w, cell * 0.018);
    ctx.fillRect(x + inset, y + inset, cell * 0.018, w);
    ctx.fillStyle = "rgba(40,20,5,0.25)";
    ctx.fillRect(x + inset, y + inset + w - cell * 0.02, w, cell * 0.02);
    ctx.fillRect(x + inset + w - cell * 0.02, y + inset, cell * 0.02, w);

    // braille-style raised dots (2×3 cells, pattern from the square number), top-left
    const bits = (n * 37 + 11) % 63 || 1;
    for (let b = 0; b < 6; b++) {
      if (!((bits >> b) & 1)) continue;
      const dx = x + cell * (0.16 + (b % 2) * 0.07);
      const dy = y + cell * (0.14 + Math.floor(b / 2) * 0.07);
      const r = cell * 0.022;
      ctx.fillStyle = "rgba(60,35,12,0.35)";
      ctx.beginPath();
      ctx.arc(dx + r * 0.35, dy + r * 0.35, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "#efe2c4";
      ctx.beginPath();
      ctx.arc(dx, dy, r, 0, Math.PI * 2);
      ctx.fill();
    }
    // two peg holes in the middle of the square
    for (const hx of [0.42, 0.58]) {
      ctx.fillStyle = "#1a0f06";
      ctx.beginPath();
      ctx.arc(x + cell * hx, y + cell * 0.5, cell * 0.042, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = "rgba(255,240,210,0.25)";
      ctx.beginPath();
      ctx.arc(x + cell * hx, y + cell * 0.5 + cell * 0.042, cell * 0.042, 0, Math.PI);
      ctx.fill();
    }

    // bold serif number, bottom-right
    ctx.fillStyle = NUMBER_INK;
    ctx.font = `700 ${Math.floor(cell * 0.25)}px Georgia, "Times New Roman", serif`;
    ctx.textAlign = "right";
    ctx.textBaseline = "alphabetic";
    ctx.fillText(String(n), x + cell * 0.9, y + cell * 0.9);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

const FRAME_W = 0.26; // rosewood frame width, in squares
const FRAME_H = 0.14;

/** Card board on the XZ plane inside a raised, glossy rosewood frame. */
function BoardSurface() {
  const texture = useMemo(() => buildBoardTexture(), []);
  useEffect(() => () => texture.dispose(), [texture]);
  const half = GRID / 2;
  const bars: { pos: [number, number, number]; size: [number, number, number] }[] = [
    { pos: [0, FRAME_H / 2 - 0.04, -half - FRAME_W / 2], size: [GRID + FRAME_W * 2, FRAME_H, FRAME_W] },
    { pos: [0, FRAME_H / 2 - 0.04, half + FRAME_W / 2], size: [GRID + FRAME_W * 2, FRAME_H, FRAME_W] },
    { pos: [-half - FRAME_W / 2, FRAME_H / 2 - 0.04, 0], size: [FRAME_W, FRAME_H, GRID] },
    { pos: [half + FRAME_W / 2, FRAME_H / 2 - 0.04, 0], size: [FRAME_W, FRAME_H, GRID] },
  ];

  return (
    <group>
      <mesh position={[0, -0.07, 0]} receiveShadow>
        <boxGeometry args={[GRID + FRAME_W * 2, 0.1, GRID + FRAME_W * 2]} />
        <meshStandardMaterial color={ROSEWOOD} roughness={0.5} metalness={0.05} />
      </mesh>
      {bars.map((b, i) => (
        <mesh key={i} position={b.pos} castShadow receiveShadow>
          <boxGeometry args={b.size} />
          <meshStandardMaterial color={ROSEWOOD} roughness={0.32} metalness={0.08} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={BOARD_PLANE_ARGS} />
        {/* a little self-light keeps the card warm under the scene's cool space lighting */}
        <meshStandardMaterial
          map={texture}
          emissive="#ffffff"
          emissiveMap={texture}
          emissiveIntensity={0.32}
          roughness={0.9}
          metalness={0}
        />
      </mesh>
      <mesh position={[-(GRID - 1) / 2 - 1.25, 0.02, (GRID - 1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={START_PAD_ARGS} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
    </group>
  );
}

/** Flat painted ladder lying on the board: two rails, evenly spaced rungs, rivets at each joint. */
function Ladder3D({ from, to }: { from: number; to: number }) {
  const built = useMemo(() => {
    const [ax, , az] = squareToWorld(from);
    const [bx, , bz] = squareToWorld(to);
    const start = new THREE.Vector3(ax, 0, az);
    const end = new THREE.Vector3(bx, 0, bz);
    const len = start.distanceTo(end);
    const forward = end.clone().sub(start).normalize();
    const mid = start.clone().lerp(end, 0.5);
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
    const railLen = len + 0.3;
    const rungCount = Math.max(3, Math.round(len / 0.3));
    const rungZ = Array.from({ length: rungCount }, (_, i) => -len / 2 + ((i + 0.5) / rungCount) * len);
    return { mid: [mid.x, 0.012, mid.z] as [number, number, number], quat, railLen, rungZ };
  }, [from, to]);

  const halfW = 0.15;
  const t = 0.016; // paint-sheet thickness

  return (
    <group position={built.mid} quaternion={built.quat}>
      {[-halfW, halfW].map((x) => (
        <group key={x}>
          <mesh position={[x, 0, 0]} castShadow receiveShadow>
            <boxGeometry args={[0.085, t, built.railLen]} />
            <meshStandardMaterial color={LADDER_EDGE} roughness={0.5} />
          </mesh>
          <mesh position={[x, t * 0.6, 0]}>
            <boxGeometry args={[0.062, t, built.railLen - 0.02]} />
            <meshStandardMaterial color={LADDER_PAINT} roughness={0.45} />
          </mesh>
        </group>
      ))}
      {built.rungZ.map((z) => (
        <group key={z}>
          <mesh position={[0, t * 0.3, z]} castShadow>
            <boxGeometry args={[halfW * 2, t, 0.06]} />
            <meshStandardMaterial color={LADDER_PAINT} roughness={0.45} />
          </mesh>
          {[-halfW, halfW].map((x) => (
            <mesh key={x} position={[x, t * 1.3, z]}>
              <cylinderGeometry args={[0.013, 0.013, 0.006, 10]} />
              <meshStandardMaterial color="#5a3a12" roughness={0.4} metalness={0.4} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  );
}

/** Wavy path from head square → tail square. */
function snakeCurve(from: number, to: number, phase: number): THREE.CatmullRomCurve3 {
  const [ax, , az] = squareToWorld(from);
  const [bx, , bz] = squareToWorld(to);
  const a = new THREE.Vector3(ax, 0.14, az);
  const b = new THREE.Vector3(bx, 0.1, bz);
  const dx = b.x - a.x;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dz) || 1;
  const nx = -dz / len;
  const nz = dx / len;
  const waves = Math.max(2, Math.round(len / 1.4));
  const amp = Math.min(0.38, 0.18 + len * 0.035);
  const pts: THREE.Vector3[] = [];
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const env = Math.sin(Math.min(1, t / 0.2) * (Math.PI / 2)) * Math.sin(t * Math.PI);
    const w = Math.sin(t * Math.PI * waves - phase) * amp * env;
    // the whole body lies on the floor (just above the board surface)
    pts.push(new THREE.Vector3(a.x + dx * t + nx * w, 0.13, a.z + dz * t + nz * w));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/**
 * Outline of a flat cut-out snake in board coordinates: a pointed, slightly wider head at the
 * head square, a slim body following the curve, tapering to a sharp tail.
 */
function snakeOutline(curve: THREE.CatmullRomCurve3): THREE.Shape {
  const L = curve.getLength();
  const start = curve.getPointAt(0);
  const dir = curve.getTangentAt(0); // towards the tail
  const f = new THREE.Vector2(-dir.x, -dir.z).normalize(); // head points away from the body
  const n = new THREE.Vector2(-f.y, f.x);
  const c = new THREE.Vector2(start.x, start.z);
  const at = (along: number, across: number) => c.clone().addScaledVector(f, along).addScaledVector(n, across);

  // head (local: along = towards the tip, across = sideways)
  const headLeft = [at(0.2, 0), at(0.12, 0.07), at(0.02, 0.095), at(-0.08, 0.075)];
  const headRight = [at(-0.08, -0.075), at(0.02, -0.095), at(0.12, -0.07)];

  const left: THREE.Vector2[] = [];
  const right: THREE.Vector2[] = [];
  const steps = 90;
  const tNeck = Math.min(0.2, 0.1 / L);
  for (let i = 0; i <= steps; i++) {
    const t = tNeck + (1 - tNeck) * (i / steps);
    const p = curve.getPointAt(t);
    const tan = curve.getTangentAt(t);
    const nn = new THREE.Vector2(-tan.z, tan.x).normalize();
    // body half-width: slim neck, steady body, long taper to a point
    const k = (t - tNeck) / (1 - tNeck);
    const w = k < 0.55 ? THREE.MathUtils.lerp(0.055, 0.065, k / 0.55) : 0.065 * Math.pow((1 - k) / 0.45, 0.9);
    const q = new THREE.Vector2(p.x, p.z);
    left.push(q.clone().addScaledVector(nn, w));
    right.push(q.clone().addScaledVector(nn, -w));
  }
  // the body's "left" side is on the head's right, because the head faces the other way
  const pts = [...headLeft, ...right, ...left.reverse(), ...headRight];
  // shape space (x, y) maps to world (x, -z) once the mesh is laid flat
  return new THREE.Shape(pts.map((v) => new THREE.Vector2(v.x, -v.y)));
}

/** A flat painted cut-out snake lying on the board, with two small rivet eyes. */
function Snake3D({ from, to, index }: { from: number; to: number; index: number }) {
  const { geo, eyes } = useMemo(() => {
    const curve = snakeCurve(from, to, index * 1.37);
    const geo = new THREE.ExtrudeGeometry(snakeOutline(curve), { depth: 0.022, bevelEnabled: false, curveSegments: 4 });
    const start = curve.getPointAt(0);
    const dir = curve.getTangentAt(0);
    const f = new THREE.Vector3(-dir.x, 0, -dir.z).normalize();
    const n = new THREE.Vector3(-f.z, 0, f.x);
    const eyes = [1, -1].map((side) =>
      start.clone().setY(0).addScaledVector(f, 0.07).addScaledVector(n, side * 0.05).toArray() as [number, number, number],
    );
    return { geo, eyes };
  }, [from, to, index]);

  useEffect(() => () => geo.dispose(), [geo]);
  const paint = SNAKE_PAINTS[index % SNAKE_PAINTS.length];

  return (
    <group>
      <mesh geometry={geo} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.006, 0]} castShadow receiveShadow>
        <meshStandardMaterial color={paint} roughness={0.35} metalness={0.05} />
      </mesh>
      {eyes.map((p, i) => (
        <mesh key={i} position={[p[0], 0.03, p[2]]}>
          <cylinderGeometry args={[0.014, 0.014, 0.008, 10]} />
          <meshStandardMaterial color="#e8dcc0" roughness={0.3} metalness={0.3} />
        </mesh>
      ))}
    </group>
  );
}

const Snake3DMemo = memo(Snake3D);
const Ladder3DMemo = memo(Ladder3D);


const Token3D = memo(function Token3D({
  token,
  ox,
  oz,
  active,
}: {
  token: Token;
  ox: number;
  oz: number;
  active: boolean;
}) {
  const ref = useRef<THREE.Group>(null);
  const invalidate = useThree((s) => s.invalidate);
  const [bx, , bz] = squareToWorld(token.position);
  const baseY = 0.42;
  const target = useRef(new THREE.Vector3(bx + ox, baseY, bz + oz));
  const from = useRef(new THREE.Vector3(bx + ox, baseY, bz + oz));
  // Where the token first appears. Passing the live square as the position prop would make
  // React snap the token to each new square before the animation below gets to move it.
  const [initialPos] = useState<[number, number, number]>(() => [bx + ox, baseY, bz + oz]);
  /** Progress of the current move, 0..1 (1 = resting on the target). */
  const progress = useRef(1);
  /** Length of the current move in seconds, and how high it hops. */
  const moveSecs = useRef(STEP_MS / 1000);
  const hopHeight = useRef(0);

  useLayoutEffect(() => {
    if (!ref.current) {
      target.current.set(bx + ox, baseY, bz + oz);
      from.current.copy(target.current);
      return;
    }
    const next = new THREE.Vector3(bx + ox, baseY, bz + oz);
    from.current.copy(ref.current.position);
    from.current.y = baseY;
    const dist = from.current.distanceTo(next);
    target.current.copy(next);
    if (dist < 1e-4) return;
    // One square: a quick hop that fills the gap between steps. Bigger moves (snakes, ladders,
    // blasts) fly in a higher, slower arc so the jump reads clearly.
    const big = dist > 1.6; // the step off the start pad (~1.35) is still a normal hop
    moveSecs.current = big ? THREE.MathUtils.clamp(0.45 + dist * 0.06, 0.55, 0.95) : (STEP_MS / 1000) * 0.95;
    hopHeight.current = big ? Math.min(1.6, dist * 0.3 + 0.5) : dist < 0.5 ? 0.06 : 0.22;
    progress.current = 0;
    invalidate();
  }, [bx, bz, ox, oz, invalidate]);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const p = ref.current.position;
    const t = target.current;
    if (progress.current < 1) {
      // eased glide with a hop: slow start and landing, highest in the middle
      progress.current = Math.min(1, progress.current + Math.min(dt, 0.05) / moveSecs.current);
      const u = progress.current;
      const e = u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2;
      p.x = THREE.MathUtils.lerp(from.current.x, t.x, e);
      p.z = THREE.MathUtils.lerp(from.current.z, t.z, e);
      p.y = baseY + Math.sin(u * Math.PI) * hopHeight.current;
      if (hopHeight.current > 0.5) ref.current.rotation.y += dt * 6;
      state.invalidate();
      return;
    }
    p.x = t.x;
    p.z = t.z;
    if (active) {
      p.y = baseY + 0.1 + Math.sin(performance.now() * 0.006) * 0.08;
      ref.current.rotation.y += dt * 1.4;
      state.invalidate();
    } else {
      p.y = THREE.MathUtils.lerp(p.y, baseY, 0.15);
      if (Math.abs(p.y - baseY) > 0.002) state.invalidate();
    }
  });

  const finished = token.rank != null;

  return (
    <group ref={ref} position={initialPos}>
      <mesh castShadow position={[0, -0.14, 0]}>
        <cylinderGeometry args={TOKEN_BASE_ARGS} />
        <meshStandardMaterial color={token.color.ring} roughness={0.45} metalness={0.25} />
      </mesh>
      <mesh castShadow>
        <capsuleGeometry args={TOKEN_BODY_ARGS} />
        <meshStandardMaterial
          color={token.color.fill}
          emissive={active ? token.color.fill : "#000"}
          emissiveIntensity={active ? 0.4 : 0}
          roughness={0.35}
          metalness={0.22}
        />
      </mesh>
      <mesh position={[0, 0.3, 0]} castShadow>
        <sphereGeometry args={TOKEN_HEAD_ARGS} />
        <meshStandardMaterial color={token.color.fill} roughness={0.3} metalness={0.2} />
      </mesh>
      {finished && (
        <Html center distanceFactor={7} position={[0, 0.7, 0]} style={{ pointerEvents: "none" }}>
          <div className="rounded-full bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-amber-300 shadow">
            #{token.rank}
          </div>
        </Html>
      )}
      {active && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.36, 0]}>
          <circleGeometry args={TOKEN_RING_ARGS} />
          <meshBasicMaterial color="#22c55e" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  );
});

function Tokens({ players, currentId }: { players: Token[]; currentId: number | string | null }) {
  // Precompute stack slots once per position snapshot — avoids lateral jumps mid-render.
  const slots = useMemo(() => {
    const bySquare = new Map<number, Token[]>();
    for (const p of players) {
      const list = bySquare.get(p.position);
      if (list) list.push(p);
      else bySquare.set(p.position, [p]);
    }
    const out = new Map<string | number, { ox: number; oz: number }>();
    for (const group of bySquare.values()) {
      const spread = group.length > 1 ? 0.2 : 0;
      group.forEach((p, k) => {
        out.set(p.id, {
          ox: (k % 2 === 0 ? -1 : 1) * spread,
          oz: (k < 2 ? -1 : 1) * spread * (group.length > 2 ? 1 : 0.35),
        });
      });
    }
    return out;
  }, [players]);

  return (
    <>
      {players.map((p) => {
        const slot = slots.get(p.id) ?? { ox: 0, oz: 0 };
        return (
          <Token3D
            key={String(p.id)}
            token={p}
            ox={slot.ox}
            oz={slot.oz}
            active={p.id === currentId && p.rank == null}
          />
        );
      })}
    </>
  );
}

/** Board / snakes / lights — independent of token steps so room ticks don’t rebuild them. */
const StaticDecor = memo(function StaticDecor() {

  return (
    <>
      {/* CSS SpaceBackdrop already draws stars — skip heavy R3F Stars to cut flicker/lag. */}
      <ambientLight intensity={0.55} />
      <directionalLight
        castShadow
        position={[6, 14, 8]}
        intensity={1.35}
        color="#e0f2fe"
        shadow-mapSize={[512, 512]}
        shadow-camera-far={40}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
      />
      <pointLight position={[-8, 6, -6]} intensity={0.45} color="#22d3ee" />
      <hemisphereLight args={["#94a3b8", "#020617", 0.4]} />

      <BoardSurface />

      {Object.entries(LADDERS).map(([from, to]) => (
        <Ladder3DMemo key={`l${from}`} from={+from} to={to} />
      ))}
      <Suspense fallback={null}>
        {Object.entries(SNAKES).map(([from, to], i) => (
          <Snake3DMemo
            key={`s${from}`}
            from={+from}
            to={to}
            index={i}
          />
        ))}
      </Suspense>

      <ContactShadows position={[0, 0.01, 0]} opacity={0.22} scale={14} blur={1.6} far={5} color="#020617" />
    </>
  );
});

/** Demand frameloop needs one kick on mount so the first frame paints. */
function KickFrame() {
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    invalidate();
  }, [invalidate]);
  return null;
}

/** Darken the mined square, then erupt lava columns — only while burstSquare is set. */
function MineBlastFX({ square }: { square: number }) {
  const [x, , z] = squareToWorld(square);
  // set when the blast starts (effect below), not during render
  const started = useRef(0);
  const darkRef = useRef<THREE.MeshStandardMaterial>(null);
  const lavaRef = useRef<THREE.MeshStandardMaterial>(null);
  const ringRef = useRef<THREE.MeshBasicMaterial>(null);
  const colA = useRef<THREE.Mesh>(null);
  const colB = useRef<THREE.Mesh>(null);
  const colC = useRef<THREE.Mesh>(null);

  useEffect(() => {
    started.current = performance.now();
  }, [square]);

  useFrame((state) => {
    const t = (performance.now() - started.current) / 1000;
    // 0–0.35s: square goes black; then lava rises.
    const black = t < 0.35 ? t / 0.35 : Math.max(0, 1 - (t - 0.35) / 1.2);
    if (darkRef.current) darkRef.current.opacity = 0.15 + black * 0.75;
    const erupt = Math.max(0, Math.min(1, (t - 0.25) / 0.35));
    const fade = t > 1.1 ? Math.max(0, 1 - (t - 1.1) / 0.7) : 1;
    if (lavaRef.current) {
      lavaRef.current.opacity = 0.55 * erupt * fade;
      lavaRef.current.emissiveIntensity = 1.2 * erupt * fade;
    }
    if (ringRef.current) ringRef.current.opacity = 0.85 * erupt * fade;
    const h = erupt * (0.6 + Math.sin(t * 18) * 0.08) * fade;
    if (colA.current) {
      colA.current.scale.y = 0.01 + h * 2.2;
      colA.current.position.y = colA.current.scale.y / 2;
    }
    if (colB.current) {
      colB.current.scale.y = 0.01 + h * 1.6;
      colB.current.position.y = colB.current.scale.y / 2;
    }
    if (colC.current) {
      colC.current.scale.y = 0.01 + h * 1.9;
      colC.current.position.y = colC.current.scale.y / 2;
    }
    state.invalidate();
  });

  return (
    <group position={[x, 0.03, z]}>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[0.92, 0.92]} />
        <meshStandardMaterial ref={darkRef} color="#050505" transparent opacity={0.2} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[0.28, 0.48, 28]} />
        <meshBasicMaterial ref={ringRef} color="#fb923c" transparent opacity={0} depthWrite={false} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.025, 0]}>
        <circleGeometry args={[0.34, 24]} />
        <meshStandardMaterial
          ref={lavaRef}
          color="#ea580c"
          emissive="#f97316"
          emissiveIntensity={0}
          transparent
          opacity={0}
          depthWrite={false}
        />
      </mesh>
      <mesh ref={colA} position={[-0.12, 0.05, 0.08]}>
        <cylinderGeometry args={[0.05, 0.09, 1, 8]} />
        <meshStandardMaterial color="#fb923c" emissive="#ea580c" emissiveIntensity={1.4} transparent opacity={0.85} />
      </mesh>
      <mesh ref={colB} position={[0.1, 0.05, -0.06]}>
        <cylinderGeometry args={[0.04, 0.07, 1, 8]} />
        <meshStandardMaterial color="#fbbf24" emissive="#f59e0b" emissiveIntensity={1.2} transparent opacity={0.8} />
      </mesh>
      <mesh ref={colC} position={[0.02, 0.05, 0.12]}>
        <cylinderGeometry args={[0.035, 0.06, 1, 8]} />
        <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={1.1} transparent opacity={0.75} />
      </mesh>
      <pointLight color="#fb923c" intensity={2.2} distance={4} decay={2} position={[0, 0.6, 0]} />
    </group>
  );
}

function Scene({
  players,
  currentId,
  burstSquare,
}: {
  players: Token[];
  currentId: number | string | null;
  burstSquare: number | null;
}) {
  return (
    <>
      <KickFrame />
      <StaticDecor />
      {burstSquare != null && burstSquare > 0 && <MineBlastFX square={burstSquare} />}
      <Tokens players={players} currentId={currentId} />
      <OrbitControls
        makeDefault
        enablePan={false}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI - 0.15}
        minDistance={5}
        maxDistance={32}
        target={[0, 0.2, 0]}
      />
    </>
  );
}

function BoardCanvas({
  players,
  currentId,
  burstSquare = null,
}: {
  players: Token[];
  currentId: number | string | null;
  burstSquare?: number | null;
}) {
  return (
    <div className="relative h-full min-h-[280px] w-full">
      <Canvas
        shadows
        className="!absolute !inset-0 !h-full !w-full !bg-transparent"
        dpr={[1, 1.5]}
        camera={{ position: [9, 12, 11], fov: 36, near: 0.1, far: 80 }}
        gl={{ antialias: true, alpha: true, powerPreference: "high-performance", stencil: false }}
        frameloop="demand"
        style={{ width: "100%", height: "100%" }}
      >
        <Suspense fallback={null}>
          <Scene players={players} currentId={currentId} burstSquare={burstSquare} />
        </Suspense>
      </Canvas>
    </div>
  );
}

export default memo(BoardCanvas);
