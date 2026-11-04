"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { createPortal } from "react-dom";

const DICE_SECTION_ID = "dice-controls";

const noSubscribe = () => () => {};

/** Fixed bottom-right ↓ shortcut; only while the board is up and dice is off-screen. */
export default function JumpToDice() {
  // true in the browser, false while server rendering (the portal needs document.body)
  const mounted = useSyncExternalStore(noSubscribe, () => true, () => false);
  const [show, setShow] = useState(false);

  useEffect(() => {
    const dice = document.getElementById(DICE_SECTION_ID);
    if (!dice) return;

    const sync = () => {
      const rect = dice.getBoundingClientRect();
      const inView = rect.top < window.innerHeight * 0.85 && rect.bottom > 0;
      setShow(!inView);
    };

    sync();
    const io = new IntersectionObserver(sync, { threshold: [0, 0.15, 0.4] });
    io.observe(dice);
    window.addEventListener("scroll", sync, { passive: true, capture: true });
    window.addEventListener("resize", sync);

    return () => {
      io.disconnect();
      window.removeEventListener("scroll", sync, true);
      window.removeEventListener("resize", sync);
    };
  }, []);

  if (!mounted || !show) return null;

  return createPortal(
    <button
      type="button"
      aria-label="Scroll to dice"
      onClick={() => {
        document.getElementById(DICE_SECTION_ID)?.scrollIntoView({ behavior: "smooth", block: "start" });
      }}
      className="pointer-events-auto fixed bottom-6 right-4 z-[9999] flex h-12 w-12 items-center justify-center rounded-full bg-cyan-500 text-white shadow-[0_8px_28px_rgba(8,145,178,0.55)] ring-2 ring-cyan-300/40 transition hover:bg-cyan-400 lg:hidden"
    >
      <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2.5" aria-hidden>
        <path d="M6 9l6 6 6-6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </button>,
    document.body,
  );
}

export { DICE_SECTION_ID };
