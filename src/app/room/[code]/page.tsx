import { Suspense } from "react";
import Room from "./Room";

export default function RoomPage() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-8">
      <h1 className="text-center text-3xl font-extrabold tracking-tight text-white drop-shadow sm:text-4xl">
        🐍 Snakes &amp; Ladders 🪜
      </h1>
      <div className="w-full max-w-6xl">
        <Suspense fallback={<p className="text-center text-lg text-white">Loading…</p>}>
          <Room />
        </Suspense>
      </div>
    </main>
  );
}
