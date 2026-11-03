import Home from "@/components/Home";

export default function Page() {
  return (
    <main className="flex min-h-screen flex-col items-center gap-6 px-4 py-8">
      <h1 className="text-center text-4xl font-extrabold tracking-tight text-white drop-shadow sm:text-5xl">
        🐍 Snakes &amp; Ladders 🪜
      </h1>
      <div className="w-full max-w-6xl">
        <Home />
      </div>
    </main>
  );
}
