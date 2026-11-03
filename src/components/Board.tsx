import { LADDERS, Player, SNAKES, squareCenter, squareToCoords } from "@/lib/game";

const CELL_COLORS = ["#fef3c7", "#fde68a", "#fed7aa", "#fecaca", "#e9d5ff", "#bfdbfe", "#bbf7d0"];

function snakePath(from: number, to: number): string {
  const a = squareCenter(from);
  const b = squareCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = -dy / len;
  const ny = dx / len;
  const waves = Math.max(2, Math.round(len / 14));
  const amp = 3;
  const steps = 40;
  let d = `M ${a.x} ${a.y}`;
  for (let i = 1; i <= steps; i++) {
    const t = i / steps;
    // taper the wiggle near both ends so head and tail sit on their squares
    const w = Math.sin(t * Math.PI * waves) * amp * Math.sin(t * Math.PI);
    d += ` L ${a.x + dx * t + nx * w} ${a.y + dy * t + ny * w}`;
  }
  return d;
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
  const d = snakePath(from, to);
  return (
    <g>
      <path d={d} stroke={skin.dark} strokeWidth={3.8} fill="none" strokeLinecap="round" />
      <path d={d} stroke={skin.main} strokeWidth={2.8} fill="none" strokeLinecap="round" />
      <path d={d} stroke={skin.light} strokeWidth={1} strokeDasharray="1.2 1.6" fill="none" strokeLinecap="round" />
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

function Ladder({ from, to }: { from: number; to: number }) {
  const a = squareCenter(from);
  const b = squareCenter(to);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.hypot(dx, dy);
  const nx = (-dy / len) * 1.8;
  const ny = (dx / len) * 1.8;
  const rungs = Math.max(2, Math.floor(len / 4));
  return (
    <g stroke="#78350f" strokeLinecap="round">
      <line x1={a.x + nx} y1={a.y + ny} x2={b.x + nx} y2={b.y + ny} strokeWidth={1.1} />
      <line x1={a.x - nx} y1={a.y - ny} x2={b.x - nx} y2={b.y - ny} strokeWidth={1.1} />
      {Array.from({ length: rungs }, (_, i) => {
        const t = (i + 0.5) / rungs;
        const cx = a.x + dx * t;
        const cy = a.y + dy * t;
        return <line key={i} x1={cx + nx} y1={cy + ny} x2={cx - nx} y2={cy - ny} strokeWidth={0.7} stroke="#b45309" />;
      })}
    </g>
  );
}

export type Token = Pick<Player, "name" | "color" | "position"> & { id: number | string };

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
              className={`absolute z-10 flex h-[5.5%] w-[5.5%] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border-2 text-[clamp(8px,1.4vw,12px)] font-bold text-white shadow-md transition-all duration-300 ease-out ${
                p.id === currentId ? "ring-4 ring-white/80" : ""
              }`}
              style={{
                left: `${x + ox}%`,
                top: `${y + oy}%`,
                background: p.color.fill,
                borderColor: p.color.ring,
              }}
              title={p.name}
            >
              {p.name[0]?.toUpperCase()}
            </div>
          );
        })}
    </div>
  );
}
