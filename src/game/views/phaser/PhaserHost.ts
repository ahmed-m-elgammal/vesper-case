/**
 * PhaserHost -- owns the Phaser.Game instance and the scene switching API.
 * The DOM overlay layer sits above the canvas; scenes only draw rooms/hub.
 */

import * as Phaser from 'phaser';
import { HubScene } from './HubScene';
import { RoomScene } from './RoomScene';
import { DESIGN_H, DESIGN_W, setSceneCtx, type SceneCtx, type RoomSceneData } from './SceneCtx';

export class PhaserHost {
  readonly game: Phaser.Game;

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
      scene: [HubScene, RoomScene],
    });
  }

  ready(): Promise<void> {
    return new Promise((resolve) => {
      if (this.game.isBooted) return resolve();
      this.game.events.once(Phaser.Core.Events.READY, () => resolve());
    });
  }

  showHub(): void {
    const s = this.game.scene;
    if (s.isActive('room')) s.stop('room');
    if (!s.isActive('hub')) s.start('hub');
  }

  showRoom(data: RoomSceneData): void {
    const s = this.game.scene;
    if (s.isActive('hub')) s.stop('hub');
    s.start('room', data);
  }

  destroy(): void {
    this.game.destroy(true);
  }
}
