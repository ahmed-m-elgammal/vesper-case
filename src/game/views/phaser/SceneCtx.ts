/**
 * SceneCtx -- the shared context handed to every Phaser scene. Scenes stay
 * thin: they render, capture intents, and delegate every decision to the
 * ViewModels / root hooks.
 */

import type { GameVM } from '../../viewmodels/GameVM';
import type { RoomVM } from '../../viewmodels/RoomVM';

export interface SceneHooks {
  openClue(clueId: string): void;
  openGate(gateId: string): void;
  /** Open a conversation with a suspect or station person (hotspots). */
  openDialogue(suspectId: string): void;
  /** Open the desk drawer: the case-file registry (station interior). */
  openCaseFiles(): void;
  /** Open the service record: career ladder + history (station plaque). */
  openCareer?(): void;
  /** Play once-only narration for a station level's first entry. */
  narrate?(payload: { flag: string; lines: string[] }): void;
  toast(text: string, kind: 'clue' | 'info' | 'warn'): void;
  /** Play the sketch-wipe and swap scenes at midpoint. */
  wipe(mid: () => void): void;
}

export interface SceneCtx {
  vm: GameVM;
  hooks: SceneHooks;
}

/*
 * Module-scoped context holder: scenes read the context via getSceneCtx().
 * This avoids boot-order races with Phaser's registry (scenes can auto-start
 * before any postBoot callback runs).
 */
let activeCtx: SceneCtx | null = null;

export function setSceneCtx(ctx: SceneCtx): void {
  activeCtx = ctx;
}

export function getSceneCtx(): SceneCtx {
  if (!activeCtx) throw new Error('SceneCtx accessed before PhaserHost initialised it');
  return activeCtx;
}

export interface RoomSceneData {
  roomId: string;
  roomVM: RoomVM;
  ctx: SceneCtx;
}

export const DESIGN_W = 1280;
export const DESIGN_H = 720;
