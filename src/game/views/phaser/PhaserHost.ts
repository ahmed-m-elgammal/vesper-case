/**
 * PhaserHost -- owns the Phaser.Game instance and the scene switching API.
 * The DOM overlay layer sits above the canvas; scenes draw the precinct and
 * case rooms.
 */

import * as Phaser from 'phaser';
import { HubScene } from './HubScene';
import { RoomScene } from './RoomScene';
import { StationExtScene } from './StationExtScene';
import { StationIntScene } from './StationIntScene';
import { StationUpScene } from './StationUpScene';
import { DESIGN_H, DESIGN_W, setSceneCtx, type SceneCtx, type RoomSceneData } from './SceneCtx';

export class PhaserHost {
  readonly game: Phaser.Game;

  /** Station level -> Phaser scene key (level names and keys must not drift). */
  private static readonly STATION_KEY = {
    exterior: 'station-ext',
    interior: 'station-int',
    upper: 'station-up',
  } as const;

  constructor(parent: HTMLElement, ctx: SceneCtx) {
    setSceneCtx(ctx); // scenes read this via getSceneCtx()
    this.game = new Phaser.Game({
      type: Phaser.AUTO,
      parent,
      width: DESIGN_W,
      height: DESIGN_H,
      transparent: true,
      scale: {
        mode: Phaser.Scale.FIT,
        autoCenter: Phaser.Scale.CENTER_BOTH,
      },
      render: {
        antialias: true,
        roundPixels: false,
        powerPreference: 'low-power',
      },
      audio: { noAudio: true },
      input: { windowEvents: false },
      scene: [StationExtScene, StationIntScene, StationUpScene, HubScene, RoomScene],
    });
  }

  ready(): Promise<void> {
    return new Promise((resolve) => {
      if (this.game.isBooted) return resolve();
      this.game.events.once(Phaser.Core.Events.READY, () => resolve());
    });
  }

  showStation(level: 'exterior' | 'interior' | 'upper'): void {
    const s = this.game.scene;
    if (s.isActive('room')) s.stop('room');
    if (s.isActive('hub')) s.stop('hub');
    // Level names come from world.json ('interior'...); scene keys are the
    // short forms ('station-int'...). Map explicitly -- never concatenate.
    // Stop the other station scenes unconditionally: at boot the street scene
    // may still be in its loading phase, where isActive() is false but it
    // would come up later. stop() on a non-running scene is harmless.
    const key = PhaserHost.STATION_KEY[level];
    for (const other of ['station-ext', 'station-int', 'station-up'] as const) {
      if (other !== key) s.stop(other);
    }
    if (!s.isActive(key)) s.start(key);
  }

  showHub(): void {
    const s = this.game.scene;
    if (s.isActive('room')) s.stop('room');
    for (const st of ['station-ext', 'station-int', 'station-up'] as const) {
      if (s.isActive(st)) s.stop(st);
    }
    if (!s.isActive('hub')) s.start('hub');
  }

  showRoom(data: RoomSceneData): void {
    const s = this.game.scene;
    if (s.isActive('hub')) s.stop('hub');
    for (const st of ['station-ext', 'station-int', 'station-up'] as const) {
      if (s.isActive(st)) s.stop(st);
    }
    s.start('room', data);
  }

  destroy(): void {
    this.game.destroy(true);
  }
}
