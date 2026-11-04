"use client";

type BrandLogoProps = {
  compact?: boolean;
  className?: string;
  hero?: boolean;
};

/** Transparent snakes & ladders logo (user-provided PNG). */
export default function BrandLogo({ compact = false, hero = false, className = "" }: BrandLogoProps) {
  const src = "/brand/snakes-ladders-logo.png?v=6";

  if (hero) {
    return (
      <div className={`relative w-full ${className}`}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={src}
          alt="Snakes & Ladders"
          width={893}
          height={336}
          decoding="async"
          className="mx-auto block h-auto w-full object-contain"
        />
      </div>
    );
  }

  return (
    <div className={`flex items-center ${className}`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt="Snakes & Ladders"
        width={893}
        height={336}
        decoding="async"
        className={
          compact
            ? "h-[4.25rem] w-auto max-w-[min(70vw,360px)] object-contain sm:h-20"
            : "h-12 w-auto max-w-[300px] object-contain sm:h-14"
        }
      />
    </div>
  );
}

export function BrandMark({ size = "hero" }: { size?: "hero" | "compact" }) {
  return <BrandLogo hero={size === "hero"} compact={size === "compact"} />;
}
