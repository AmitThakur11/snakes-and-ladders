import Avatar from "./Avatar";
import { avatarSeed } from "@/lib/avatar";

/** The avatar for the name being typed, with a dice badge; clicking it draws a new face. */
export default function AvatarPicker({ name, salt, onReroll }: { name: string; salt: number; onReroll: () => void }) {
  return (
    <button
      type="button"
      onClick={onReroll}
      className="relative shrink-0 rounded-full border-[3px] border-emerald-500 transition hover:scale-105"
      title="New avatar"
      aria-label="New avatar"
    >
      <Avatar seed={avatarSeed(name, salt)} className="h-12 w-12" />
      <span className="absolute -bottom-1 -right-1 rounded-full bg-white px-0.5 text-xs leading-5 shadow">🎲</span>
    </button>
  );
}
