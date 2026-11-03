const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

export default function Dice({ value, rolling }: { value: number; rolling: boolean }) {
  return (
    <div
      className={`grid h-20 w-20 grid-cols-3 grid-rows-3 gap-1 rounded-2xl border-2 border-slate-300 bg-white p-3 shadow-lg ${
        rolling ? "animate-dice" : ""
      }`}
      aria-label={`Die showing ${value}`}
    >
      {Array.from({ length: 9 }, (_, i) => (
        <span
          key={i}
          className={`m-auto h-3 w-3 rounded-full ${PIPS[value]?.includes(i) ? "bg-slate-800" : ""}`}
        />
      ))}
    </div>
  );
}
