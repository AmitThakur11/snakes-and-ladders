import Home from "@/components/Home";

export default function Page() {
  return (
    <main className="relative min-h-[100dvh] w-full pt-4 sm:pt-5">
      <div className="mx-auto w-full max-w-7xl px-4 sm:px-6 lg:px-8 xl:max-w-[1400px]">
        <Home />
      </div>
    </main>
  );
}
