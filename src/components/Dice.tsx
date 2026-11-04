"use client";

import { memo, useLayoutEffect, useRef } from "react";
import { DICE_ROLL_MS } from "@/lib/online";

const PIPS: Record<number, number[]> = {
  1: [4],
  2: [0, 8],
  3: [0, 4, 8],
  4: [0, 2, 6, 8],
  5: [0, 2, 4, 6, 8],
  6: [0, 2, 3, 5, 6, 8],
};

const SIZE = 80; // px — same as original
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

const EASING = "cubic-bezier(0.17, 0.67, 0.24, 1.04)";

type Rot = { x: number; y: number; z: number };

function pose(value: number, rollId: number): Rot {
  const show = FACES.find((f) => f.value === value)?.show ?? { x: 0, y: 0 };
  return {
    x: show.x + rollId * 720,
    y: show.y + rollId * 1080,
    z: rollId * 360,
  };
}

function transformOf({ x, y, z }: Rot) {
  return `rotateX(${x}deg) rotateY(${y}deg) rotateZ(${z}deg)`;
}

/**
 * Original 3D cube tumble + hop.
 * Fast re-rolls commit the prior landing pose before the next spin (no mid-cancel flicker).
 * Perspective wrapper is NOT size-clipped so the cube can tumble in open 3D space.
 */
function Dice({ value, rollId }: { value: number; rollId: number }) {
  const cubeRef = useRef<HTMLDivElement>(null);
  const hopRef = useRef<HTMLDivElement>(null);
  const shadowRef = useRef<HTMLDivElement>(null);
  const displayedRef = useRef<Rot>(pose(value, rollId));
  const prevRollIdRef = useRef(rollId);
  const pendingTargetRef = useRef<Rot | null>(null);

  useLayoutEffect(() => {
    const cube = cubeRef.current;
    if (!cube) return;

    const next = pose(value, rollId);
    const rollChanged = rollId !== prevRollIdRef.current;
    prevRollIdRef.current = rollId;

    const reduced =
      typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    const stopAnims = () => {
      cube.getAnimations().forEach((a) => a.cancel());
      hopRef.current?.getAnimations().forEach((a) => a.cancel());
      shadowRef.current?.getAnimations().forEach((a) => a.cancel());
      if (hopRef.current) hopRef.current.style.transform = "";
      if (shadowRef.current) {
        shadowRef.current.style.transform = "";
        shadowRef.current.style.opacity = "";
      }
    };

    // Finish any in-flight tumble instantly before starting the next (continuous play).
    if (pendingTargetRef.current) {
      stopAnims();
      displayedRef.current = pendingTargetRef.current;
      cube.style.transform = transformOf(displayedRef.current);
      pendingTargetRef.current = null;
    }

    const from = displayedRef.current;

    if (!rollChanged || rollId === 0 || reduced) {
      stopAnims();
      displayedRef.current = next;
      pendingTargetRef.current = null;
      cube.style.transform = transformOf(next);
      return;
    }

    stopAnims();
    cube.style.transform = transformOf(from);
    pendingTargetRef.current = next;

    const spin = cube.animate([{ transform: transformOf(from) }, { transform: transformOf(next) }], {
      duration: DICE_ROLL_MS,
      easing: EASING,
      fill: "forwards",
    });

    // Same hop path as the original dice-hop keyframes.
    const hop = hopRef.current?.animate(
      [
        { transform: "translateY(0) scale(1)" },
        { transform: "translateY(-46px) scale(1.06)", offset: 0.3 },
        { transform: "translateY(0) scale(1)", offset: 0.58 },
        { transform: "translateY(-12px)", offset: 0.68 },
        { transform: "translateY(0)", offset: 0.78 },
        { transform: "translateY(-4px)", offset: 0.86 },
        { transform: "translateY(0) scale(1)" },
      ],
      { duration: DICE_ROLL_MS, easing: "ease-in-out" },
    );

    const shadow = shadowRef.current?.animate(
      [
        { transform: "scaleX(1)", opacity: 1 },
        { transform: "scaleX(0.55)", opacity: 0.45, offset: 0.3 },
        { transform: "scaleX(1)", opacity: 1, offset: 0.58 },
        { transform: "scaleX(0.85)", opacity: 0.8, offset: 0.68 },
        { transform: "scaleX(1)", opacity: 1 },
      ],
      { duration: DICE_ROLL_MS, easing: "ease-in-out" },
    );

    spin.onfinish = () => {
      displayedRef.current = next;
      pendingTargetRef.current = null;
      cube.style.transform = transformOf(next);
      spin.cancel();
    };

    return () => {
      spin.onfinish = null;
      // Commit landing pose instead of reverting — prevents flicker on fast re-roll.
      if (pendingTargetRef.current) {
        displayedRef.current = pendingTargetRef.current;
        cube.style.transform = transformOf(pendingTargetRef.current);
      }
      spin.cancel();
      hop?.cancel();
      shadow?.cancel();
    };
  }, [value, rollId]);

  return (
    <div className="flex flex-col items-center" aria-label={`Die showing ${value}`} role="img">
      {/*
        Perspective only — do NOT lock width/height here or overflow clips the 3D tumble
        into a flat “square box”.
      */}
      <div
        ref={hopRef}
        style={{
          perspective: 500,
          perspectiveOrigin: "50% 50%",
          overflow: "visible",
        }}
      >
        <div
          ref={cubeRef}
          className="relative"
          style={{
            width: SIZE,
            height: SIZE,
            transformStyle: "preserve-3d",
            // transform is set by the layout effect above, before the first paint
            overflow: "visible",
          }}
        >
          {FACES.map((f) => (
            <div
              key={f.value}
              className="absolute inset-0 grid grid-cols-3 grid-rows-3 gap-1 rounded-2xl border-2 border-slate-300 bg-white p-3"
              style={{
                transform: f.transform,
                backfaceVisibility: "hidden",
                WebkitBackfaceVisibility: "hidden",
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
      <div ref={shadowRef} className="dice-shadow" />
    </div>
  );
}

export default memo(Dice);
