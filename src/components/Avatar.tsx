import { memo } from "react";
import { avatarParts } from "@/lib/avatar";

/** A round cartoon face drawn from `seed` (see lib/avatar). Scales to whatever box it's given. */
function Avatar({ seed, className = "h-8 w-8" }: { seed: string; className?: string }) {
  const p = avatarParts(seed);
  const ink = "#1f2937";

  return (
    <svg viewBox="0 0 64 64" className={`shrink-0 rounded-full ${className}`} aria-hidden>
      <circle cx="32" cy="32" r="32" fill={p.bg} />

      {/* hair behind the head */}
      {p.hair === 4 && <circle cx="32" cy="12" r="8" fill={p.hairColor} />}
      {p.hair === 5 &&
        [14, 22, 32, 42, 50].map((x, i) => <circle key={i} cx={x} cy={i % 2 ? 15 : 19} r="8" fill={p.hairColor} />)}

      {/* head */}
      <ellipse cx="32" cy="36" rx="19" ry="20" fill={p.skin} />
      <ellipse cx="13" cy="38" rx="3.5" ry="5" fill={p.skin} />
      <ellipse cx="51" cy="38" rx="3.5" ry="5" fill={p.skin} />

      {/* hair on top */}
      {p.hair === 1 && <path d="M24 18 Q30 6 34 16 Q38 8 42 18 Z" fill={p.hairColor} />}
      {p.hair === 2 && <path d="M13 32 Q14 14 32 14 Q50 14 51 32 Q42 22 30 24 Q20 25 13 32 Z" fill={p.hairColor} />}
      {p.hair === 3 && (
        <path d="M14 28 L18 14 L23 22 L28 10 L32 20 L37 9 L41 21 L46 13 L50 28 Q32 18 14 28 Z" fill={p.hairColor} />
      )}
      {(p.hair === 4 || p.hair === 5) && (
        <path d="M13 31 Q14 15 32 15 Q50 15 51 31 Q32 21 13 31 Z" fill={p.hairColor} />
      )}

      {/* eyes */}
      {p.eyes === 0 && (
        <g fill={ink}>
          <circle cx="25" cy="36" r="2.6" />
          <circle cx="39" cy="36" r="2.6" />
        </g>
      )}
      {p.eyes === 1 && (
        <g>
          <circle cx="25" cy="35" r="4.6" fill="#fff" stroke={ink} strokeWidth="1" />
          <circle cx="39" cy="35" r="4.6" fill="#fff" stroke={ink} strokeWidth="1" />
          <circle cx="26" cy="36" r="2.2" fill={ink} />
          <circle cx="40" cy="36" r="2.2" fill={ink} />
        </g>
      )}
      {p.eyes === 2 && (
        <g fill="none" stroke={ink} strokeWidth="2.4" strokeLinecap="round">
          <path d="M21 37 Q25 32 29 37" />
          <path d="M35 37 Q39 32 43 37" />
        </g>
      )}
      {p.eyes === 3 && (
        <g stroke={ink} strokeWidth="2.4" strokeLinecap="round">
          <circle cx="25" cy="36" r="2.6" fill={ink} stroke="none" />
          <path d="M35 36 L43 36" />
        </g>
      )}

      {/* extras */}
      {p.extra === 1 && (
        <g fill="none" stroke={ink} strokeWidth="1.8">
          <circle cx="25" cy="36" r="6" />
          <circle cx="39" cy="36" r="6" />
          <path d="M31 36 L33 36" />
        </g>
      )}
      {p.extra === 2 && (
        <g fill="#b45309" opacity="0.55">
          {[
            [20, 42],
            [23, 44],
            [18, 45],
            [44, 42],
            [41, 44],
            [46, 45],
          ].map(([x, y], i) => (
            <circle key={i} cx={x} cy={y} r="0.9" />
          ))}
        </g>
      )}
      {p.extra === 3 && (
        <g fill="#ec4899">
          <path d="M42 16 L50 11 L50 21 Z" />
          <path d="M58 16 L50 11 L50 21 Z" />
          <circle cx="50" cy="16" r="2.2" fill="#be185d" />
        </g>
      )}
      {p.cheeks && (
        <g fill="#f87171" opacity="0.35">
          <ellipse cx="20" cy="44" rx="3.5" ry="2.2" />
          <ellipse cx="44" cy="44" rx="3.5" ry="2.2" />
        </g>
      )}

      {/* mouth */}
      {p.mouth === 0 && <path d="M26 46 Q32 51 38 46" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />}
      {p.mouth === 1 && <path d="M24 45 Q32 54 40 45 Z" fill="#fff" stroke={ink} strokeWidth="1.8" strokeLinejoin="round" />}
      {p.mouth === 2 && <ellipse cx="32" cy="47.5" rx="3.6" ry="4" fill="#7f1d1d" stroke={ink} strokeWidth="1.4" />}
      {p.mouth === 3 && (
        <g>
          <path d="M25 45 Q32 51 39 45" fill="none" stroke={ink} strokeWidth="2.2" strokeLinecap="round" />
          <path d="M30 47.5 Q32 53 34 47.5 Z" fill="#f472b6" />
        </g>
      )}
    </svg>
  );
}

export default memo(Avatar);
