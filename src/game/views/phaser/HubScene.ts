/**
 * HubScene -- the dollhouse cutaway. Renders hub.svg and overlays invisible
 * tap plates (from rooms[].hubPlate) for each room; locked rooms show a
 * parchment note instead of entering.
 */

import * as Phaser from 'phaser';
import { getSceneCtx, type SceneCtx } from './SceneCtx';
import { withBase } from '../../core/assetUrl';

export class HubScene extends Phaser.Scene {
  private ctx!: SceneCtx;
  private unsubs: Array<() => void> = [];

  constructor() {
    super('hub');
  }

  preload(): void {
    this.load.image('hub', withBase('/art/hub.svg'));
  }

  create(): void {
    this.ctx = getSceneCtx();
    const vm = this.ctx.vm;

    const img = this.add.image(960, 500, 'hub');
    img.setOrigin(0.5);
    const zoom = Math.min(1280 / 1920, 720 / 1000) * 0.98;
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(960, 500);

    // Room plates
    for (const room of vm.repo.roomList) {
      const [x, y, w, h] = room.hubPlate;
      const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
      zone.setName(`room:${room.id}`);
      const unlocked = () => vm.unlockedRooms$.value.includes(room.id);

      const ring = this.add.rectangle(x + w / 2, y + h / 2, w - 8, h - 8).setStrokeStyle(3, 0xb4552d, 0.9).setVisible(false);

      zone.on('pointerover', () => {
        if (unlocked()) ring.setVisible(true);
      });
      zone.on('pointerout', () => ring.setVisible(false));
      zone.on('pointerup', () => {
        if (unlocked()) {
          this.ctx.hooks.wipe(() => {
            vm.enterRoom(room.id);
          });
        } else if (room.act <= 1) {
          this.ctx.hooks.toast('That room is still sealed. Follow the case.', 'warn');
        } else {
          const actNames: Record<number, string> = {
            2: 'Act 2 -- the kitchen and the stairs. It opens when the parlour\'s account closes.',
            3: 'Act 3 -- bedrooms, bathroom and study. It opens when the dark half hour has its arithmetic.',
            4: 'Act 4 -- attic and basement. Next build.',
            5: 'Act 5 -- interrogations and the accusation. Next build.',
          };
          this.ctx.hooks.toast(actNames[room.act] ?? 'A later act. Next build.', 'info');
        }
      });

      // keep ring in sync with unlocks
      this.unsubs.push(
        vm.unlockedRooms$.subscribe(() => {
          if (!unlocked()) ring.setVisible(false);
        })
      );
    }

    // Rain caption flicker (subtitle-friendly ambience cue)
    this.time.addEvent({
      delay: 22000,
      loop: true,
      callback: () => {
        if (this.ctx.vm.state.settings.subtitles) {
          this.ctx.vm.bus.emit('caption', { text: '[rain, distant thunder]' });
        }
      },
    });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      if (this.textures.exists('hub')) this.textures.remove('hub');
    });
  }
}

