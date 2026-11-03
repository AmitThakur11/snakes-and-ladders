"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { getPlayerId, getSavedName, getSocket, saveName } from "@/lib/socket";

export default function OnlineMenu() {
  const router = useRouter();
  const [name, setName] = useState(getSavedName);
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const create = () => {
    if (!name.trim()) return setError("Enter your name first.");
    saveName(name.trim());
    setPending(true);
    getSocket().emit(
      "room:create",
      { name: name.trim(), playerId: getPlayerId() },
      (res: { ok: true; code: string } | { ok: false; error: string }) => {
        setPending(false);
        if (res.ok) router.push(`/room/${res.code}`);
        else setError(res.error);
      },
    );
  };

  const join = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return setError("Enter your name first.");
    if (code.trim().length !== 4) return setError("Room codes are 4 letters.");
    saveName(name.trim());
    router.push(`/room/${code.trim().toUpperCase()}`);
  };

  return (
    <div className="w-full max-w-md rounded-2xl bg-white/90 p-6 shadow-xl">
      <h2 className="mb-1 text-xl font-bold text-slate-800">Play online</h2>
      <p className="mb-5 text-sm text-slate-500">Create a room and share the code with friends on other devices.</p>

      <label className="mb-1 block text-sm font-medium text-slate-600">Your name</label>
      <input
        value={name}
        onChange={(e) => {
          setName(e.target.value);
          setError("");
        }}
        maxLength={16}
        placeholder="e.g. Sam"
        className="mb-5 w-full rounded-lg border border-slate-300 px-3 py-2 text-slate-800 outline-none focus:border-emerald-500"
      />

      <button
        onClick={create}
        disabled={pending}
        className="w-full rounded-xl bg-emerald-600 py-3 text-lg font-bold text-white shadow hover:bg-emerald-700 disabled:opacity-50"
      >
        {pending ? "Creating…" : "Create room"}
      </button>

      <div className="my-5 flex items-center gap-3 text-xs uppercase text-slate-400">
        <span className="h-px flex-1 bg-slate-200" /> or join <span className="h-px flex-1 bg-slate-200" />
      </div>

      <form onSubmit={join} className="flex gap-2">
        <input
          value={code}
          onChange={(e) => {
            setCode(e.target.value.toUpperCase().replace(/[^A-Z]/g, ""));
            setError("");
          }}
          maxLength={4}
          placeholder="CODE"
          className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-center font-mono text-lg tracking-[0.4em] text-slate-800 outline-none focus:border-emerald-500"
        />
        <button className="rounded-xl bg-indigo-600 px-6 font-bold text-white hover:bg-indigo-700">Join</button>
      </form>

      {error && <p className="mt-4 text-sm font-medium text-red-600">{error}</p>}
    </div>
  );
}
