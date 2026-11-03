import { DICE_ROLL_MS } from "@/lib/online";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const SIZE = 80; // px
const HALF = SIZE / 2;

// Where each face sits on the cube, and the cube rotation that brings it to the front.
const FACES: { value: number; transform: string; show: { x: number; y: number } }[] = [
  { value: 1, transform: `translateZ(${HALF}px)`, show: { x: 0, y: 0 } },
  { value: 6, transform: `rotateY(180deg) translateZ(${HALF}px)`, show: { x: 0, y: 180 } },
  { value: 3, transform: `rotateY(90deg) translateZ(${HALF}px)`, show: { x: 0, y: -90 } },
  { value: 4, transform: `rotateY(-90deg) translateZ(${HALF}px)`, show: { x: 0, y: 90 } },
  { value: 2, transform: `rotateX(90deg) translateZ(${HALF}px)`, show: { x: -90, y: 0 } },
  { value: 5, transform: `rotateX(-90deg) translateZ(${HALF}px)`, show: { x: 90, y: 0 } },
];

/**
 * A 3D die. Bumping `rollId` makes it hop and tumble for DICE_ROLL_MS, landing on `value`.
 * The rotation only ever grows with rollId, so the CSS transition always spins forward.
 */
export default function Dice({ value, rollId }: { value: number; rollId: number }) {
  const show = FACES.find((f) => f.value === value)?.show ?? { x: 0, y: 0 };
  const x = show.x + rollId * 720;
  const y = show.y + rollId * 1080;
  const z = rollId * 360;
  // Alternate between two identical keyframes so the hop restarts on every roll.
  const hop = rollId === 0 ? "" : rollId % 2 ? "dice-hop-a" : "dice-hop-b";

  return (
    <div className="flex flex-col items-center" aria-label={`Die showing ${value}`} role="img">
      <div className={hop} style={{ perspective: 500, animationDuration: `${DICE_ROLL_MS}ms` }}>
        <div
          className="relative"
          style={{
            width: SIZE,
            height: SIZE,
            transformStyle: "preserve-3d",
            transform: `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`,
            transition: `transform ${DICE_ROLL_MS}ms cubic-bezier(0.17, 0.67, 0.24, 1.04)`,
          }}
        >
          {FACES.map((f) => (
            <div
              key={f.value}
              className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 rounded-2xl border-2 border-slate-300 bg-white p-3"
              style={{
                transform: f.transform,
                backfaceVisibility: "hidden",
                boxShadow: "inset 0 0 12px rgb(15 23 42 / 0.12)",
              }}
            >
              {Array.from({ length: 9 }, (_, i) => (
                <span
                  key={i}
                  className={`m-auto h-3 w-3 rounded-full ${PIPS[f.value].includes(i) ? "bg-slate-800" : ""}`}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
      <div className={`dice-shadow ${hop}-shadow`} style={{ animationDuration: `${DICE_ROLL_MS}ms` }} />
    </div>
  );
}
