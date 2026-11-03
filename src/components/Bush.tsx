/** A leafy bush with a few flowers, drawn to sit on a corner of the board. */
export default function Bush({ className = "", flip = false }: { className?: string; flip?: boolean }) {
  const leaves = [
    { cx: 30, cy: 62, r: 22, fill: "#2f6b2a" },
    { cx: 70, cy: 62, r: 22, fill: "#2f6b2a" },
    { cx: 50, cy: 46, r: 26, fill: "#3f8a35" },
    { cx: 24, cy: 46, r: 16, fill: "#3f8a35" },
    { cx: 77, cy: 44, r: 17, fill: "#3f8a35" },
    { cx: 40, cy: 30, r: 16, fill: "#52a743" },
    { cx: 62, cy: 28, r: 15, fill: "#52a743" },
    { cx: 50, cy: 66, r: 20, fill: "#2a5e25" },
  ];
  const shine = [
    { cx: 44, cy: 26, r: 5 },
    { cx: 64, cy: 24, r: 4 },
    { cx: 22, cy: 42, r: 4 },
    { cx: 76, cy: 40, r: 4 },
  ];
  const flowers = [
    { cx: 34, cy: 40, c: "#f472b6" },
    { cx: 66, cy: 52, c: "#facc15" },
    { cx: 52, cy: 34, c: "#ffffff" },
    { cx: 22, cy: 58, c: "#facc15" },
    { cx: 80, cy: 60, c: "#f472b6" },
  ];
  return (
    <svg
      viewBox="0 0 100 90"
      className={`pointer-events-none drop-shadow-md ${className}`}
      style={flip ? { transform: "scaleX(-1)" } : undefined}
      aria-hidden
    >
      {leaves.map((l, i) => (
        <circle key={i} {...l} stroke="#1d4019" strokeWidth="1.5" />
      ))}
      {shine.map((s, i) => (
        <circle key={i} {...s} fill="#86d26f" opacity="0.7" />
      ))}
      {flowers.map((f, i) => (
        <g key={i}>
          {[0, 72, 144, 216, 288].map((a) => (
            <circle
              key={a}
              cx={f.cx + Math.cos((a * Math.PI) / 180) * 3}
              cy={f.cy + Math.sin((a * Math.PI) / 180) * 3}
              r="2.4"
              fill={f.c}
            />
          ))}
          <circle cx={f.cx} cy={f.cy} r="1.8" fill="#f59e0b" />
        </g>
      ))}
    </svg>
  );
}
