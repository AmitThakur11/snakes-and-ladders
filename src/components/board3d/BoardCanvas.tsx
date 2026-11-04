"use client";

import { Suspense, memo, useEffect, useLayoutEffect, useMemo, useRef } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { ContactShadows, Html, OrbitControls, useAnimations, useGLTF } from "@react-three/drei";
import { SkeletonUtils } from "three-stdlib";
import * as THREE from "three";
import {
  BOARD_SIZE,
  GRID,
  LADDERS,
  SNAKES,
  squareToCoords,
  squareToWorld,
} from "@/lib/game";
import { BoardTheme, useBoardTheme } from "@/lib/boardTheme";
import type { Token } from "../Board";

const BOARD_EDGE_ARGS: [number, number, number] = [GRID + 0.65, 0.1, GRID + 0.65];
const BOARD_PLANE_ARGS: [number, number] = [GRID, GRID];
const START_PAD_ARGS: [number, number] = [0.48, 28];
const TOKEN_BASE_ARGS: [number, number, number, number] = [0.26, 0.26, 0.08, 16];
const TOKEN_BODY_ARGS: [number, number, number, number] = [0.18, 0.2, 4, 12];
const TOKEN_HEAD_ARGS: [number, number, number] = [0.18, 14, 14];
const TOKEN_RING_ARGS: [number, number] = [0.38, 24];

const SNAKE_MODEL = "/models/snake-quaternius.glb";

/** Tint map for Quaternius snake materials (CC0). */
const SNAKE_SKINS: Record<
  number,
  { main: string; belly: string; accent: string; eye: string }
> = {
  99: { main: "#2f7a28", belly: "#a8d46a", accent: "#1e5a1a", eye: "#f0c419" },
  92: { main: "#9a3b28", belly: "#e8b089", accent: "#6a2018", eye: "#f0c419" },
  87: { main: "#2a6f7a", belly: "#9fd0d8", accent: "#164850", eye: "#f0c419" },
  80: { main: "#6b5230", belly: "#d8c090", accent: "#3f3018", eye: "#f0c419" },
  37: { main: "#2e7a52", belly: "#b5d89a", accent: "#1a4a32", eye: "#f0c419" },
  14: { main: "#7a2e48", belly: "#e0a8b8", accent: "#4a1828", eye: "#f0c419" },
};

/** Flat black & white (or themed) checkered board texture. */
function buildBoardTexture(theme: BoardTheme): THREE.CanvasTexture {
  const size = 1024;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d")!;
  const cell = size / GRID;

  for (let n = 1; n <= BOARD_SIZE; n++) {
    const { row, col } = squareToCoords(n);
    const x = col * cell;
    const y = (GRID - 1 - row) * cell;
    const dark = (row + col) % 2 === 1;
    ctx.fillStyle = dark ? theme.dark : theme.light;
    ctx.fillRect(x, y, cell + 0.5, cell + 0.5);

    ctx.strokeStyle = "rgba(0,0,0,0.12)";
    ctx.lineWidth = 1;
    ctx.strokeRect(x + 0.5, y + 0.5, cell - 1, cell - 1);

    ctx.fillStyle = dark ? theme.darkText : theme.lightText;
    ctx.font = `700 ${Math.floor(cell * 0.26)}px system-ui, sans-serif`;
    ctx.textBaseline = "top";
    ctx.fillText(n === BOARD_SIZE ? "★" : String(n), x + cell * 0.08, y + cell * 0.08);

    if (n === BOARD_SIZE) {
      ctx.fillStyle = "rgba(250, 204, 21, 0.28)";
      ctx.fillRect(x, y, cell, cell);
    }
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  tex.needsUpdate = true;
  return tex;
}

/** Flat board on the XZ plane — rotate the camera for table or wall view. */
function BoardSurface({ theme }: { theme: BoardTheme }) {
  const texture = useMemo(() => buildBoardTexture(theme), [theme]);
  useEffect(() => () => texture.dispose(), [texture]);

  return (
    <group>
      {/* Black board-side border (not a UI box — just the table edge) */}
      <mesh position={[0, -0.06, 0]} receiveShadow>
        <boxGeometry args={BOARD_EDGE_ARGS} />
        <meshStandardMaterial color="#0a0a0a" roughness={0.55} metalness={0.12} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.001, 0]} receiveShadow>
        <planeGeometry args={BOARD_PLANE_ARGS} />
        <meshBasicMaterial map={texture} />
      </mesh>
      <mesh position={[-(GRID - 1) / 2 - 1.25, 0.02, (GRID - 1) / 2]} rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={START_PAD_ARGS} />
        <meshBasicMaterial color="#fbbf24" />
      </mesh>
    </group>
  );
}

/** Straight wooden ladder — parallel rails, even rungs, pegs (real board-game style). */
function Ladder3D({ from, to }: { from: number; to: number }) {
  const built = useMemo(() => {
    const [ax, , az] = squareToWorld(from);
    const [bx, , bz] = squareToWorld(to);
    const y = 0.15;
    const start = new THREE.Vector3(ax, y, az);
    const end = new THREE.Vector3(bx, y, bz);
    const len = start.distanceTo(end);
    const forward = end.clone().sub(start).normalize();
    const mid = start.clone().lerp(end, 0.5);

    let side = new THREE.Vector3().crossVectors(forward, new THREE.Vector3(0, 1, 0));
    if (side.lengthSq() < 1e-6) side.set(1, 0, 0);
    else side.normalize();

    const railQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), forward);
    const rungQuat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), side);

    const halfW = 0.175;
    const railLen = len + 0.14;
    const rungCount = Math.max(3, Math.round(len / 0.36));
    const sideOffset = side.clone().multiplyScalar(halfW);

    const rungs = Array.from({ length: rungCount }, (_, i) => {
      const t = (i + 1) / (rungCount + 1);
      const p = start.clone().lerp(end, t);
      return {
        pos: [p.x, p.y + 0.012, p.z] as [number, number, number],
        leftPeg: p.clone().add(sideOffset).toArray() as [number, number, number],
        rightPeg: p.clone().sub(sideOffset).toArray() as [number, number, number],
      };
    });

    return {
      leftPos: mid.clone().add(sideOffset).toArray() as [number, number, number],
      rightPos: mid.clone().sub(sideOffset).toArray() as [number, number, number],
      railQuat,
      rungQuat,
      railLen,
      rungs,
      halfW,
      mid: mid.toArray() as [number, number, number],
      shadowQuat: new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, Math.atan2(forward.x, forward.z))),
    };
  }, [from, to]);

  const woodDark = "#5c3418";
  const woodMid = "#8f5a2a";
  const woodLight = "#c4894a";

  return (
    <group>
      {/* Soft ground shadow */}
      <mesh position={[built.mid[0], 0.015, built.mid[2]]} quaternion={built.shadowQuat}>
        <planeGeometry args={[built.halfW * 2.8, built.railLen * 0.92]} />
        <meshBasicMaterial color="#000" transparent opacity={0.16} depthWrite={false} />
      </mesh>

      {/* Rails (rectangular timber) */}
      {([built.leftPos, built.rightPos] as const).map((pos, i) => (
        <group key={i} position={pos} quaternion={built.railQuat}>
          <mesh castShadow>
            <boxGeometry args={[0.06, 0.075, built.railLen]} />
            <meshStandardMaterial color={woodDark} roughness={0.78} metalness={0.02} />
          </mesh>
          {/* Highlight strip on top */}
          <mesh position={[0, 0.028, 0]}>
            <boxGeometry args={[0.032, 0.02, built.railLen * 0.97]} />
            <meshStandardMaterial color={woodMid} roughness={0.62} metalness={0.02} />
          </mesh>
        </group>
      ))}

      {/* Rungs + pegs */}
      {built.rungs.map((r, i) => (
        <group key={i}>
          <mesh position={r.pos} quaternion={built.rungQuat} castShadow>
            <cylinderGeometry args={[0.028, 0.028, built.halfW * 2 + 0.05, 12]} />
            <meshStandardMaterial color={woodLight} roughness={0.55} metalness={0.03} />
          </mesh>
          <mesh position={r.leftPeg} castShadow>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshStandardMaterial color={woodDark} roughness={0.7} />
          </mesh>
          <mesh position={r.rightPeg} castShadow>
            <sphereGeometry args={[0.03, 10, 10]} />
            <meshStandardMaterial color={woodDark} roughness={0.7} />
          </mesh>
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
    const lift = 0.12 + Math.sin(t * Math.PI) * 0.05;
    pts.push(new THREE.Vector3(a.x + dx * t + nx * w, lift, a.z + dz * t + nz * w));
  }
  return new THREE.CatmullRomCurve3(pts);
}

/** Soft tapered body that links the GLB head to the tail square. */
function createBodyTube(curve: THREE.CatmullRomCurve3, tubular = 48, radial = 8): THREE.BufferGeometry {
  const frames = curve.computeFrenetFrames(tubular, false);
  const pos: number[] = [];
  const nrm: number[] = [];
  const uv: number[] = [];
  const idx: number[] = [];

  for (let i = 0; i <= tubular; i++) {
    const t = i / tubular;
    const p = curve.getPointAt(t);
    const T = frames.tangents[i];
    const up = new THREE.Vector3(0, 1, 0);
    let back = new THREE.Vector3().crossVectors(T, new THREE.Vector3().crossVectors(up, T)).normalize();
    if (back.lengthSq() < 1e-6) back = frames.normals[i].clone();
    const side = new THREE.Vector3().crossVectors(T, back).normalize();

    // Leave room for the Quaternius mesh; tube is the sliding tail path
    let radius: number;
    if (t < 0.22) radius = 0.015;
    else if (t < 0.38) radius = THREE.MathUtils.lerp(0.06, 0.12, (t - 0.22) / 0.16);
    else radius = THREE.MathUtils.lerp(0.12, 0.02, Math.pow((t - 0.38) / 0.62, 1.05));

    for (let j = 0; j <= radial; j++) {
      const ang = (j / radial) * Math.PI * 2;
      const cos = Math.cos(ang);
      const sin = Math.sin(ang);
      const rx = radius;
      const ry = radius * 0.55;
      const nx = cos * back.x + sin * side.x;
      const ny = cos * back.y + sin * side.y;
      const nz = cos * back.z + sin * side.z;
      pos.push(p.x + cos * ry * back.x + sin * rx * side.x, p.y + cos * ry * back.y + sin * rx * side.y, p.z + cos * ry * back.z + sin * rx * side.z);
      const nl = Math.hypot(nx, ny, nz) || 1;
      nrm.push(nx / nl, ny / nl, nz / nl);
      uv.push(t * 4, 0.5 - 0.5 * cos);
    }
  }
  for (let i = 0; i < tubular; i++) {
    for (let j = 0; j < radial; j++) {
      const a = i * (radial + 1) + j;
      const b = a + radial + 1;
      idx.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute("normal", new THREE.Float32BufferAttribute(nrm, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

function tintSnakeMaterials(
  root: THREE.Object3D,
  skin: (typeof SNAKE_SKINS)[number],
) {
  root.traverse((obj) => {
    const mesh = obj as THREE.Mesh;
    if (!mesh.isMesh) return;
    // Shadows on six snake meshes are a major multiplayer GPU cost — tokens keep casting.
    mesh.castShadow = false;
    mesh.receiveShadow = false;
    mesh.frustumCulled = true;
    const mats = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    const next = mats.map((mat) => {
      const m = (mat as THREE.MeshStandardMaterial).clone();
      const name = (m.name || "").toLowerCase();
      if (name.includes("darkgreen")) m.color.set(skin.main);
      else if (name.includes("lightgreen")) m.color.set(skin.belly);
      else if (name.includes("darkred")) m.color.set(skin.accent);
      else if (name.includes("yellow") || name.includes("purple")) m.color.set(skin.eye);
      m.roughness = 0.42;
      m.metalness = 0.08;
      m.needsUpdate = true;
      return m;
    });
    mesh.material = next.length === 1 ? next[0]! : next;
  });
}

/** Quaternius CC0 snake (Poly Pizza) — real mesh head + body path for board play. */
function Snake3D({
  from,
  to,
  skin,
  index,
}: {
  from: number;
  to: number;
  skin: (typeof SNAKE_SKINS)[number];
  index: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const modelRef = useRef<THREE.Group>(null);
  const { scene, animations } = useGLTF(SNAKE_MODEL);

  const clone = useMemo(() => SkeletonUtils.clone(scene), [scene]);

  useEffect(() => {
    tintSnakeMaterials(clone, skin);
  }, [clone, skin]);

  const { actions } = useAnimations(animations, modelRef);

  useEffect(() => {
    const idle = actions["SnakeArmature|Snake_Idle"];
    if (!idle) return;
    idle.reset().setLoop(THREE.LoopRepeat, Infinity).play();
    idle.timeScale = 0.85;
    return () => {
      idle.stop();
    };
  }, [actions]);

  const { bodyGeo, place } = useMemo(() => {
    const curve = snakeCurve(from, to, index * 1.37);
    const bodyGeo = createBodyTube(curve);
    const headPos = curve.getPointAt(0.04);
    const tan = curve.getTangentAt(0.04).normalize();
    // Face along the drop so the open jaws read toward lower squares
    const face = new THREE.Vector3(tan.x, 0, tan.z);
    if (face.lengthSq() < 1e-6) face.set(0, 0, 1);
    else face.normalize();
    const quat = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), face);
    // Quaternius bind pose ~3.2 tall — sized to dominate each head square
    const pathLen = curve.getLength();
    const scale = THREE.MathUtils.clamp(0.55 + pathLen * 0.03, 0.62, 1.05);
    return {
      bodyGeo,
      place: {
        pos: [headPos.x, 0, headPos.z] as [number, number, number],
        quat,
        scale,
      },
    };
  }, [from, to, index]);

  return (
    <group ref={groupRef}>
      <mesh geometry={bodyGeo}>
        <meshStandardMaterial color={skin.main} roughness={0.48} metalness={0.06} />
      </mesh>

      <group ref={modelRef} position={place.pos} quaternion={place.quat} scale={place.scale}>
        <primitive object={clone} />
      </group>
    </group>
  );
}

const Snake3DMemo = memo(Snake3D);
const Ladder3DMemo = memo(Ladder3D);

useGLTF.preload(SNAKE_MODEL);

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
  /** 0 = idle lerp; 0..1 = lofted blast/teleport arc. */
  const arc = useRef(0);

  useLayoutEffect(() => {
    if (!ref.current) {
      target.current.set(bx + ox, baseY, bz + oz);
      from.current.copy(target.current);
      return;
    }
    const next = new THREE.Vector3(bx + ox, baseY, bz + oz);
    const dist = next.distanceTo(target.current);
    from.current.copy(ref.current.position);
    from.current.y = baseY;
    target.current.copy(next);
    // Big jumps (mine blast / snake-ladder) fly in an arc so the position change reads clearly.
    arc.current = dist > 1.15 ? 0.001 : 0;
    invalidate();
  }, [bx, bz, ox, oz, invalidate]);

  useFrame((state, dt) => {
    if (!ref.current) return;
    const p = ref.current.position;
    const t = target.current;
    if (arc.current > 0 && arc.current < 1) {
      arc.current = Math.min(1, arc.current + dt * 1.35);
      const u = arc.current;
      p.x = THREE.MathUtils.lerp(from.current.x, t.x, u);
      p.z = THREE.MathUtils.lerp(from.current.z, t.z, u);
      p.y = baseY + Math.sin(u * Math.PI) * Math.min(2.4, from.current.distanceTo(t) * 0.45 + 0.8);
      ref.current.rotation.y += dt * 8;
      state.invalidate();
      if (arc.current >= 1) arc.current = 0;
      return;
    }
    const k = Math.min(1, dt * 12);
    p.x = THREE.MathUtils.lerp(p.x, t.x, k);
    p.z = THREE.MathUtils.lerp(p.z, t.z, k);
    const moving = (t.x - p.x) ** 2 + (t.z - p.z) ** 2 > 1e-6;
    if (active) {
      p.y = baseY + 0.1 + Math.sin(performance.now() * 0.006) * 0.08;
      ref.current.rotation.y += dt * 1.4;
      state.invalidate();
    } else {
      p.y = THREE.MathUtils.lerp(p.y, baseY, 0.15);
      if (moving || Math.abs(p.y - baseY) > 0.002) state.invalidate();
    }
  });

  const finished = token.rank != null;

  return (
    <group ref={ref} position={[bx + ox, baseY, bz + oz]}>
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
  const theme = useBoardTheme();

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

      <BoardSurface theme={theme} />

      {Object.entries(LADDERS).map(([from, to]) => (
        <Ladder3DMemo key={`l${from}`} from={+from} to={to} />
      ))}
      <Suspense fallback={null}>
        {Object.entries(SNAKES).map(([from, to], i) => (
          <Snake3DMemo
            key={`s${from}`}
            from={+from}
            to={to}
            skin={SNAKE_SKINS[+from] ?? SNAKE_SKINS[99]!}
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
  const started = useRef(performance.now());
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
