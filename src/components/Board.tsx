import Avatar from "./Avatar";
import { LADDERS, Player, SNAKES, squareCenter, squareToCoords } from "@/lib/game";

const CELL_COLORS = ["#fef3c7", "#fde68a", "#fed7aa", "#fecaca", "#e9d5ff", "#bfdbfe", "#bbf7d0"];

type Pt = { x: number; y: number };

/** Points along a wavy centreline from head (index 0) to tail. */
function snakeSpine(from: number, to: number): Pt[] {
  const a = squareCenter(from);
  const b = squareCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const waves = Math.max(2, Math.round(len / 14));
  const amp = 3;
  const steps = 60;
  return Array.from({ length: steps + 1 }, (_, i) => {
    const t = i / steps;
    // taper the wiggle near both ends so head and tail sit on their squares
    const w = Math.sin(t * Math.PI * waves) * amp * Math.sin(t * Math.PI);
    return { x: a.x + dx * t + nx * w, y: a.y + dy * t + ny * w };
  });
}

const toPath = (pts: Pt[]) => pts.map((p, i) => `${i ? "L" : "M"} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(" ");

/** Closed outline of a body that is full width at the head and narrows to a sharp tail. */
function snakeBody(spine: Pt[], halfWidth: number): string {
  const n = spine.length - 1;
  const left: Pt[] = [];
  const right: Pt[] = [];
  spine.forEach((p, i) => {
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
];

const HEAD_SIZE = 9; // board units (one square is 10)

function Snake({ from, to, skin }: { from: number; to: number; skin: (typeof SNAKE_SKINS)[number] }) {
  const head = squareCenter(from);
  const spine = snakeSpine(from, to);
  // the pattern stripe stops before the tail gets too thin to hold it
  const stripe = toPath(spine.slice(0, Math.round(spine.length * 0.8)));
  return (
    <g>
      <path d={snakeBody(spine, 1.5)} fill={skin.main} stroke={skin.dark} strokeWidth={0.5} strokeLinejoin="miter" strokeMiterlimit={20} />
      <path d={stripe} stroke={skin.light} strokeWidth={1} strokeDasharray="1.2 1.6" fill="none" strokeLinecap="round" />
      <image
        href={`/snakes/${skin.face}.webp`}
        x={head.x - HEAD_SIZE / 2}
        y={head.y - HEAD_SIZE / 2}
        width={HEAD_SIZE}
        height={HEAD_SIZE}
        style={{ filter: "drop-shadow(0 0.4px 0.6px rgb(0 0 0 / 0.5))" }}
      />
    </g>
  );
}

const WOOD = { edge: "#4a2a0e", base: "#a8692c", grain: "#d9a35f" };

function Ladder({ from, to }: { from: number; to: number }) {
  const a = squareCenter(from);
  const b = squareCenter(to);
  const len = Math.hypot(b.x - a.x, b.y - a.y);
  const ux = (b.x - a.x) / len;
  const uy = (b.y - a.y) / len;
  const gap = 2; // half the distance between the rails
  const nx = -uy * gap;
  const ny = ux * gap;
  // rails run a little past both squares' centres
  const over = 1.6;
  const s = { x: a.x - ux * over, y: a.y - uy * over };
  const e = { x: b.x + ux * over, y: b.y + uy * over };
  const rungs = Math.max(2, Math.round(len / 3.2));

  const rail = (side: 1 | -1, key: string) => {
    const x1 = s.x + nx * side;
    const y1 = s.y + ny * side;
    const x2 = e.x + nx * side;
    const y2 = e.y + ny * side;
    return (
      <g key={key} strokeLinecap="round">
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={WOOD.edge} strokeWidth={1.35} />
        <line x1={x1} y1={y1} x2={x2} y2={y2} stroke={WOOD.base} strokeWidth={0.85} />
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
          <line x1={c.x + nx * 1.1} y1={c.y + ny * 1.1} x2={c.x - nx * 1.1} y2={c.y - ny * 1.1} stroke={WOOD.edge} strokeWidth={1.05} />
          <line x1={c.x + nx * 1.1} y1={c.y + ny * 1.1} x2={c.x - nx * 1.1} y2={c.y - ny * 1.1} stroke={WOOD.base} strokeWidth={0.6} />
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

export default function Board({ players, currentId }: { players: Token[]; currentId: number | string | null }) {
  const cells = Array.from({ length: 100 }, (_, i) => i + 1);

  return (
    <div className="relative aspect-square w-full overflow-visible rounded-xl border-4 border-amber-900 bg-amber-50 shadow-2xl">
      <div className="grid h-full w-full grid-cols-10 grid-rows-10">
        {cells.map((n) => {
          const { row, col } = squareToCoords(n);
          return (
            <div
              key={n}
              style={{
                gridRow: 10 - row,
                gridColumn: col + 1,
                background: CELL_COLORS[(row + col) % CELL_COLORS.length],
              }}
              className="relative border border-amber-900/10"
            >
              <span className="absolute left-1 top-0.5 text-[clamp(8px,1.6vw,13px)] font-bold text-amber-900/70">
                {n === 100 ? "🏆" : n}
              </span>
            </div>
          );
        })}
      </div>

      <svg viewBox="0 0 100 100" className="pointer-events-none absolute inset-0 h-full w-full">
        {Object.entries(LADDERS).map(([from, to]) => (
          <Ladder key={`l${from}`} from={+from} to={to} />
        ))}
        {Object.entries(SNAKES).map(([from, to], i) => (
          <Snake key={`s${from}`} from={+from} to={to} skin={SNAKE_SKINS[i % SNAKE_SKINS.length]} />
        ))}
      </svg>

      {players
        .filter((p) => p.position > 0)
        .map((p) => {
          const { x, y } = squareCenter(p.position);
          const sharing = players.filter((o) => o.position === p.position);
          const k = sharing.findIndex((o) => o.id === p.id);
          const spread = sharing.length > 1 ? 1.8 : 0;
          const ox = (k % 2 === 0 ? -1 : 1) * spread;
          const oy = (k < 2 ? -1 : 1) * spread;
          return (
            <div
              key={p.id}
              className={`absolute z-10 h-[6.5%] w-[6.5%] -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] shadow-md transition-all duration-300 ease-out ${
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
  );
}
