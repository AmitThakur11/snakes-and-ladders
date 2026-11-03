"use client";

import dynamic from "next/dynamic";
import { useParams } from "next/navigation";

// Uses browser storage and a live socket, so it renders on the client only.
const OnlineGame = dynamic(() => import("@/components/OnlineGame"), { ssr: false });

export default function Room() {
  const { code } = useParams<{ code: string }>();
  return <OnlineGame code={code.toUpperCase()} />;
}
