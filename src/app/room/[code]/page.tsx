import { Suspense } from "react";
import BrandLogo from "@/components/BrandLogo";
import Room from "./Room";

export default function RoomPage() {
  return (
    <main className="relative min-h-[100dvh] w-full px-3 py-3 sm:px-4 sm:py-4">
      <div className="mx-auto flex w-full max-w-[1600px] flex-col gap-2">
        <BrandLogo compact className="justify-center sm:justify-start" />
        <Suspense fallback={<p className="text-center text-lg text-cyan-200/80">Loading…</p>}>
          <Room />
        </Suspense>
      </div>
    </main>
  );
}
