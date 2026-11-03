"use client";

import { useEffect, useState } from "react";
import Avatar from "./Avatar";
import Bush from "./Bush";
import { BOARD_THEMES, setBoardTheme, useBoardTheme } from "@/lib/boardTheme";
import { BOARD_SIZE, GRID, LADDERS, Player, SNAKES, squareCenter, squareToCoords } from "@/lib/game";

const CELL = 100 / GRID; // one square in board units

type Pt = { x: number; y: number };

/**
 * Points along a wavy centreline from head (index 0) to tail. Advancing `phase` sends the
 * wave down the body towards the tail, which is what makes the snake slither.
 */
function snakeSpine(from: number, to: number, phase: number): Pt[] {
  const a = squareCenter(from);
  const b = squareCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const waves = Math.max(2, Math.round(len / (CELL * 1.4)));
  const amp = CELL * 0.22;
  const steps = 60;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    // the neck stays still so the head sits on its square; the tail is free to swing
    const env = Math.sin(Math.min(1, t / 0.3) * (Math.PI / 2)) * (1 - 0.35 * t);
    const w = Math.sin(t * Math.PI * waves - phase) * amp * env;
    return { x: a.x + dx * t + nx * w, y: a.y + dy * t + ny * w };
  });
}

const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

// The body runs this far along the spine; the rattle covers the rest.
const RATTLE_AT = 0.9;

/** Unit tangent of the spine at index i. */
function tangent(spine: Pt[], i: number): Pt {
  const n = spine.length - 1;
  const prev = spine[Math.max(0, i - 1)];
  const next = spine[Math.min(n, i + 1)];
  const l = Math.hypot(next.x - prev.x, next.y - prev.y) || 1;
  return { x: (next.x - prev.x) / l, y: (next.y - prev.y) / l };
}

/** Closed outline of a body that is full width at the head and narrows towards the rattle. */
function snakeBody(spine: Pt[], halfWidth: number): string {
  const n = spine.length - 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  spine.slice(0, Math.round(n * RATTLE_AT) + 1).forEach((p, i) => {
    const prev = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(n, i + 1)];
    const tx = next.x - prev.x;
    const ty = next.y - prev.y;
    const tl = Math.hypot(tx, ty) || 1;
    const t = i / n;
    // full width for the first ~55%, then taper to a point
    const w = halfWidth * Math.pow(Math.min(1, (1 - t) / 0.45), 0.85);
    left.push({ x: p.x - (ty / tl) * w, y: p.y + (tx / tl) * w });
    right.push({ x: p.x + (ty / tl) * w, y: p.y - (tx / tl) * w });
  });
  return `${toPath([...left, ...right.reverse()])} Z`;
}

// Each snake gets one of the illustrated faces in public/snakes, with body colours to match it.
const SNAKE_SKINS = [
  { face: "01_green", dark: "#1f3d12", main: "#4d8a2a", light: "#c9d98a" },
  { face: "04_red", dark: "#5c1408", main: "#c2381a", light: "#f59a6b" },
  { face: "05_blue", dark: "#0f3550", main: "#2f7fb3", light: "#a9e0e8" },
  { face: "10_yellow_black", dark: "#1a1206", main: "#e09a1c", light: "#2b1d08" },
  { face: "06_purple", dark: "#231a33", main: "#5b4a78", light: "#a596c4" },
  { face: "11_teal", dark: "#0d3b3a", main: "#24857f", light: "#9fd9cf" },
  { face: "03_brown", dark: "#3a2a14", main: "#8a6a3a", light: "#e0c98f" },
  { face: "08_gray", dark: "#2a2a2a", main: "#7a7a76", light: "#cfcfc9" },
  { face: "12_crimson", dark: "#3d0a0a", main: "#8f1d1d", light: "#e07a5f" },
  { face: "07_olive", dark: "#2c3310", main: "#6b7a2a", light: "#d4d98a" },
];

const HEAD_SIZE = CELL * 0.62;

/**
 * A rattlesnake rattle: a stack of ridged segments, biggest at the tail, smallest at the tip,
 * that buzz in short bursts.
 */
function Rattle({ spine, index }: { spine: Pt[]; index: number }) {
  const i = Math.round((spine.length - 1) * RATTLE_AT);
  const base = spine[i];
  const dir = tangent(spine, i);
  const angle = (Math.atan2(dir.y, dir.x) * 180) / Math.PI;
  const segments = [0.58, 0.53, 0.47, 0.41, 0.33];
  return (
    <g
      className="snake-rattle"
      style={{
        transformBox: "view-box",
        transformOrigin: `${base.x}px ${base.y}px`,
        animationDelay: `${-index * 0.9}s`,
      }}
    >
      {segments.map((ry, k) => {
        const d = 0.3 + k * 0.48;
        return (
          <ellipse
            key={k}
            cx={base.x + dir.x * d}
            cy={base.y + dir.y * d}
            rx={0.36}
            ry={ry}
            transform={`rotate(${angle} ${base.x + dir.x * d} ${base.y + dir.y * d})`}
            fill={k % 2 ? "#cdb27a" : "#e3cf9e"}
            stroke="#6b5330"
            strokeWidth={0.14}
          />
        );
      }).reverse()}
    </g>
  );
}

type SnakeProps = { from: number; to: number; skin: (typeof SNAKE_SKINS)[number]; phase: number; index: number };

function Snake({ from, to, skin, phase, index }: SnakeProps) {
  const head = squareCenter(from);
  const spine = snakeSpine(from, to, phase);
  // the pattern stripe stops before the tail gets too thin to hold it
  const stripe = toPath(spine.slice(0, Math.round(spine.length * 0.8)));
  return (
    <g>
      <path
        d={snakeBody(spine, CELL * 0.1)}
        fill={skin.main}
        stroke={skin.dark}
        strokeWidth={0.35}
        strokeLinejoin="miter"
        strokeMiterlimit={20}
      />
      <path d={stripe} stroke={skin.light} strokeWidth={0.6} strokeDasharray="0.8 1.1" fill="none" strokeLinecap="round" />
      <Rattle spine={spine} index={index} />
      <image
        href={`/snakes/${skin.face}.webp`}
        x={head.x - HEAD_SIZE / 2}
        y={head.y - HEAD_SIZE / 2}
        width={HEAD_SIZE}
        height={HEAD_SIZE}
        className="snake-head"
        style={{
          filter: "drop-shadow(0 0.4px 0.6px rgb(0 0 0 / 0.5))",
          // stagger the head shakes so the snakes don't move in unison
          animationDelay: `${-index * 1.3}s`,
          animationDuration: `${5 + (index % 3) * 0.8}s`,
        }}
      />
    </g>
  );
}

/** All snakes, re-drawn about 30 times a second while their bodies slither. */
function Snakes() {
  const [time, setTime] = useState(0);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reduced) return;
    let frame = 0;
    let last = 0;
    const tick = (now: number) => {
      if (now - last > 33) {
        last = now;
        setTime(now / 1000);
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, []);

  return (
    <>
      {Object.entries(SNAKES).map(([from, to], i) => (
        <Snake
          key={`s${from}`}
          from={+from}
          to={to}
          skin={SNAKE_SKINS[i % SNAKE_SKINS.length]}
          index={i}
          // each snake slithers at its own pace, starting at a different point in the wave
          phase={time * (0.7 + (i % 4) * 0.12) + i * 1.7}
        />
      ))}
    </>
  );
}

const WOOD = { edge: "#4a2a0e", base: "#a8692c", grain: "#d9a35f" };

function Ladder({ from, to }: { from: number; to: number }) {
  const a = squareCenter(from);
  const b = squareCenter(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const gap = CELL * 0.19; // half the distance between the rails
  const nx = -uy * gap;
  const ny = ux * gap;
  // rails run a little past both squares' centres
  const over = CELL * 0.15;
  const s = { x: a.x - ux * over, y: a.y - uy * over };
  const e = { x: b.x + ux * over, y: b.y + uy * over };
  const rungs = Math.max(2, Math.round(len / (CELL * 0.32)));

  const rail = (side: 1 | -1, key: string) => {
    const x1 = s.x + nx * side;
    const y1 = s.y + ny * side;
    const x2 = e.x + nx * side;
    const y2 = e.y + ny * side;
    return (
      <g key={key} strokeLinecap="round">
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={WOOD.edge} strokeWidth={1.15} />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={WOOD.base} strokeWidth={0.7} />
        <line
          x1={x1 - nx * 0.08}
          y1={y1 - ny * 0.08}
          x2={x2 - nx * 0.08}
          y2={y2 - ny * 0.08}
          stroke={WOOD.grain}
          strokeWidth={0.22}
          strokeDasharray="4 1.2 2 0.8"
        />
      </g>
    );
  };

  const steps = Array.from({ length: rungs }, (_, i) => {
    const d = over + ((i + 0.5) / rungs) * len;
    return { x: s.x + ux * d, y: s.y + uy * d };
  });

  const body = (
    <>
      {steps.map((c, i) => (
        <g key={`r${i}`} strokeLinecap="round">
          <line x1={c.x + nx * 1.1} y1={c.y + ny * 1.1} x2={c.x - nx * 1.1} y2={c.y - ny * 1.1} stroke={WOOD.edge} strokeWidth={0.9} />
          <line x1={c.x + nx * 1.1} y1={c.y + ny * 1.1} x2={c.x - nx * 1.1} y2={c.y - ny * 1.1} stroke={WOOD.base} strokeWidth={0.5} />
        </g>
      ))}
      {rail(1, "left")}
      {rail(-1, "right")}
      {steps.map((c, i) => (
        <g key={`p${i}`} fill={WOOD.edge}>
          <circle cx={c.x + nx} cy={c.y + ny} r={0.22} />
          <circle cx={c.x - nx} cy={c.y - ny} r={0.22} />
        </g>
      ))}
    </>
  );

  return (
    <g>
      <g transform="translate(0.45 0.6)" opacity={0.22} style={{ filter: "blur(0.35px)" }}>
        <line x1={s.x + nx} y1={s.y + ny} x2={e.x + nx} y2={e.y + ny} stroke="#000" strokeWidth={1.4} strokeLinecap="round" />
        <line x1={s.x - nx} y1={s.y - ny} x2={e.x - nx} y2={e.y - ny} stroke="#000" strokeWidth={1.4} strokeLinecap="round" />
        {steps.map((c, i) => (
          <line key={i} x1={c.x + nx} y1={c.y + ny} x2={c.x - nx} y2={c.y - ny} stroke="#000" strokeWidth={1} />
        ))}
      </g>
      {body}
    </g>
  );
}

export type Token = Pick<Player, "name" | "color" | "position" | "avatar"> & { id: number | string };

function ThemePicker() {
  const theme = useBoardTheme();
  return (
    <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
      <span className="text-sm font-medium text-white/90 drop-shadow">Board:</span>
      {BOARD_THEMES.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => setBoardTheme(t.id)}
          title={t.name}
          aria-label={`${t.name} board`}
          aria-pressed={theme.id === t.id}
          className={`h-8 w-8 overflow-hidden rounded-full border-2 shadow transition hover:scale-110 ${
            theme.id === t.id ? "scale-110 border-white ring-2 ring-white/60" : "border-white/40"
          }`}
          style={{ background: `linear-gradient(135deg, ${t.light} 50%, ${t.dark} 50%)` }}
        />
      ))}
    </div>
  );
}

export default function Board({ players, currentId }: { players: Token[]; currentId: number | string | null }) {
  const cells = Array.from({ length: BOARD_SIZE }, (_, i) => i + 1);
  const theme = useBoardTheme();
  const place = (n: number) => {
    const { row, col } = squareToCoords(n);
    return { gridRow: GRID - row, gridColumn: col + 1, dark: (row + col) % 2 === 1 };
  };
  const gridStyle = { gridTemplateColumns: `repeat(${GRID}, 1fr)`, gridTemplateRows: `repeat(${GRID}, 1fr)` };

  return (
    // padding leaves room for the corner bushes without making the page scroll sideways
    <div className="px-[7%] pb-[5%] pt-[7%]">
      <div
        className="relative aspect-square w-full rounded-xl border-[6px] shadow-2xl"
        style={{ borderColor: theme.frame, background: theme.light }}
      >
        <div className="grid h-full w-full overflow-hidden rounded-md" style={gridStyle}>
          {cells.map((n) => {
            const { gridRow, gridColumn, dark } = place(n);
            return <div key={n} style={{ gridRow, gridColumn, background: dark ? theme.dark : theme.light }} />;
          })}
        </div>

        <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
          {Object.entries(LADDERS).map(([from, to]) => (
            <Ladder key={`l${from}`} from={+from} to={to} />
          ))}
          <Snakes />
        </svg>

        {/* corner bushes sit under the numbers and tokens, so they never hide a square */}
        <Bush className="absolute -left-[8%] -top-[8%] w-[14%]" />
        <Bush className="absolute -right-[8%] -top-[8%] w-[14%]" flip />
        <Bush className="absolute -bottom-[7%] -left-[8%] w-[14%]" flip />
        <Bush className="absolute -bottom-[7%] -right-[8%] w-[14%]" />

        {/* square numbers sit above the snakes, ladders and bushes so they're always readable */}
        <div className="pointer-events-none absolute inset-0 grid" style={gridStyle}>
          {cells.map((n) => {
            const { gridRow, gridColumn, dark } = place(n);
            return (
              <div key={n} style={{ gridRow, gridColumn }} className="relative">
                <span
                  className="absolute left-[3px] top-[2px] rounded px-[3px] text-[clamp(7px,1.25vw,11px)] font-bold leading-tight"
                  style={{
                    color: dark ? theme.darkText : theme.lightText,
                    background: `${dark ? theme.dark : theme.light}cc`,
                  }}
                >
                  {n === BOARD_SIZE ? "🏆" : n}
                </span>
              </div>
            );
          })}
        </div>

        {players
          .filter((p) => p.position > 0)
          .map((p) => {
            const { x, y } = squareCenter(p.position);
            const sharing = players.filter((o) => o.position === p.position);
            const k = sharing.findIndex((o) => o.id === p.id);
            const spread = sharing.length > 1 ? CELL * 0.18 : 0;
            const ox = (k % 2 === 0 ? -1 : 1) * spread;
            const oy = (k < 2 ? -1 : 1) * spread;
            return (
              <div
                key={p.id}
                className={`absolute z-10 h-[5.6%] w-[5.6%] -translate-x-1/2 -translate-y-1/2 rounded-full border-2 shadow-md transition-all duration-300 ease-out ${
                  p.id === currentId ? "z-20 ring-4 ring-white/80" : ""
                }`}
                style={{
                  left: `${x + ox}%`,
                  top: `${y + oy}%`,
                  background: p.color.fill,
                  borderColor: p.color.fill,
                }}
                title={p.name}
              >
                <Avatar seed={p.avatar} className="h-full w-full" />
              </div>
            );
          })}
      </div>
      <ThemePicker />
    </div>
  );
}
