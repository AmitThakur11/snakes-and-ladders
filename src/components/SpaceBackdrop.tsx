"use client";

/** Fixed full-page space field — stars + nebula wash behind the whole UI. */
export default function SpaceBackdrop() {
  return (
    <div aria-hidden className="pointer-events-none fixed inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-[#030712]" />
      <div className="space-nebula absolute inset-0" />
      <div className="space-stars absolute inset-0 opacity-90" />
      <div className="space-stars-sm absolute inset-0 opacity-70" />
      <div className="absolute inset-0 bg-gradient-to-b from-cyan-500/5 via-transparent to-amber-500/5" />
    </div>
  );
}
