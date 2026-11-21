"use client";

import dynamic from "next/dynamic";

/**
 * Thin host page: the entire game is framework-agnostic vanilla TypeScript
 * (MVVM: observables + viewmodels + Phaser scenes + plain DOM overlays)
 * mounted below this page. React only provides the mount point; the game
 * bundle is browser-only (ssr:false).
 */
const GameHost = dynamic(() => import("@/game/GameHost"), {
  ssr: false,
  loading: () => (
    <div className="game-host" aria-hidden="true">
      <div className="boot-splash">
        <div className="boot-circle" />
        <div className="boot-text">Opening the case file...</div>
      </div>
    </div>
  ),
});

export default function Home() {
  return (
    <main
      className="game-root"
      aria-label="Ink & Ashes, a detective deduction game"
    >
      <GameHost />
    </main>
  );
}
