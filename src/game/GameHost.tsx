"use client";

import { useEffect, useRef } from "react";
import { mountGame } from "./main";

/**
 * Browser-only mount component. Loaded via next/dynamic with ssr:false so
 * Phaser never enters the server bundle graph.
 */
export default function GameHost() {
  const ref = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const cleanup = mountGame(ref.current);
    return () => cleanup();
  }, []);

  return <div ref={ref} className="game-host" aria-label="Ink & Ashes game stage" />;
}
