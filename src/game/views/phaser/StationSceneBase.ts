/**
 * StationSceneBase -- shared renderer for the two precinct scenes. Every
 * hotspot (position, kind, label, payload) comes from world.json; the scene
 * only draws and delegates intents to the SceneCtx hooks. Extending the
 * world means editing data, never this file.
 */

import * as Phaser from 'phaser';
import { getSceneCtx, type SceneCtx } from './SceneCtx';
import type { StationHotspot, StationSceneData } from '../../data/types';

const WORLD_W = 1920;
const WORLD_H = 1080;

export abstract class StationSceneBase extends Phaser.Scene {
  protected ctx!: SceneCtx;
  private unsubs: Array<() => void> = [];
  private rainRects: Phaser.GameObjects.Rectangle[] = [];

  constructor(key: string) {
    super(key);
  }

  preload(): void {
    // ctx is set before the game boots (PhaserHost constructor) and must be
    // read here too: the art path comes from world.json.
    this.ctx = getSceneCtx();
    this.load.image(this.artKey(), this.sceneData().art);
  }

  create(): void {
    const vm = this.ctx.vm;

    const img = this.add.image(WORLD_W / 2, WORLD_H / 2, this.artKey());
    img.setOrigin(0.5);
    const zoom = Math.min(1280 / WORLD_W, 720 / WORLD_H) * 0.98;
    this.cameras.main.setZoom(zoom);
    this.cameras.main.centerOn(WORLD_W / 2, WORLD_H / 2);

    this.buildHotspots();

    // Location caption chip, bottom-left (HUD is hidden in the precinct).
    const title = this.sceneData().title;
    const chipBg = this.add.rectangle(0, 0, title.length * 13 + 46, 44, 0xf4ecdb, 0.92)
      .setStrokeStyle(2, 0x2e2a33, 0.8)
      .setDepth(900);
    const chipText = this.add
      .text(0, 0, title, {
        fontFamily: 'Caveat, cursive',
        fontSize: '26px',
        color: '#2e2a33',
      })
      .setOrigin(0.5)
      .setDepth(901);
    // The camera never scrolls here: pin the chip to the visible bottom-left.
    const chipZoom = this.cameras.main.zoom;
    const viewW = 1280 / chipZoom;
    const viewH = 720 / chipZoom;
    const left = WORLD_W / 2 - viewW / 2;
    const bottom = WORLD_H / 2 + viewH / 2;
    chipBg.setPosition(left + 18 + chipBg.width / 2, bottom - 14 - chipBg.height / 2);
    chipText.setPosition(left + 18 + chipBg.width / 2, bottom - 14 - chipBg.height / 2);

    this.addAmbience();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      this.rainRects = [];
      if (this.textures.exists(this.artKey())) this.textures.remove(this.artKey());
    });
  }

  /** Hotspot tap behaviour is data-driven; the base covers every world kind. */
  protected activateHotspot(h: StationHotspot): void {
    const vm = this.ctx.vm;
    switch (h.kind) {
      case 'door':
        this.ctx.hooks.wipe(() => vm.setStationLevel(h.to === 'interior' ? 'interior' : 'exterior'));
        break;
      case 'files':
        this.ctx.hooks.openCaseFiles();
        break;
      case 'dialogue':
        if (h.dialogue) this.ctx.hooks.openDialogue(h.dialogue);
        break;
      case 'flavor':
      case 'locked':
        this.ctx.hooks.toast(h.line ?? h.label, 'info');
        break;
    }
  }

  private buildHotspots(): void {
    const highlights = this.ctx.vm.state.settings.highlights;
    for (const h of this.sceneData().hotspots) {
      const [x, y, w, hh] = h.spot;
      const cx = x + w / 2;
      const cy = y + hh / 2;
      const interactive = h.kind === 'door' || h.kind === 'files' || h.kind === 'dialogue';

      const zone = this.add.zone(cx, cy, w, hh).setInteractive({ useHandCursor: interactive });

      const ring = this.add
        .rectangle(cx, cy, w - 10, hh - 10)
        .setStrokeStyle(3, 0xb4552d, 0.9)
        .setVisible(false);

      // Label chip (hover on desktop; always faintly present when highlights on)
      const labelWidth = h.label.length * 12 + 30;
      const chip = this.add.container(cx, Math.max(y - 26, 40), [
        this.add.rectangle(0, 0, labelWidth, 38, 0xf4ecdb, 0.95).setStrokeStyle(2, 0x2e2a33, 0.85),
        this.add.text(0, 0, h.label, {
          fontFamily: 'Caveat, cursive',
          fontSize: '22px',
          color: '#2e2a33',
        }),
      ]);
      chip.setDepth(800).setVisible(false).setAlpha(0);

      // Soft pulsing dot marks interactive spots when highlights are enabled.
      let pulse: Phaser.GameObjects.Arc | null = null;
      if (highlights && interactive) {
        pulse = this.add.circle(cx, y + hh - 16, 7, 0xe8b24a, 0.95).setDepth(799);
        this.tweens.add({
          targets: pulse,
          alpha: { from: 0.95, to: 0.25 },
          scale: { from: 1, to: 0.8 },
          duration: 1100,
          yoyo: true,
          repeat: -1,
        });
      }

      zone.on('pointerover', () => {
        ring.setVisible(true);
        chip.setVisible(true);
        this.tweens.add({ targets: chip, alpha: 1, duration: 120 });
      });
      zone.on('pointerout', () => {
        ring.setVisible(false);
        this.tweens.add({ targets: chip, alpha: 0, duration: 120, onComplete: () => chip.setVisible(false) });
      });
      zone.on('pointerup', () => this.activateHotspot(h));

      this.unsubs.push(() => {
        ring.destroy();
        chip.destroy();
        pulse?.destroy();
      });
    }
  }

  /** Ambient caption + light rain on the street scene. */
  private addAmbience(): void {
    const vm = this.ctx.vm;
    if (this.hasRain()) this.buildRain();

    this.time.addEvent({
      delay: 21000,
      loop: true,
      callback: () => {
        if (vm.state.settings.subtitles) {
          this.ctx.vm.bus.emit('caption', { text: this.sceneData().ambientCaption });
        }
      },
    });
    // fire once shortly after entry too
    this.time.delayedCall(1400, () => {
      if (vm.state.settings.subtitles) {
        this.ctx.vm.bus.emit('caption', { text: this.sceneData().ambientCaption });
      }
    });
  }

  private buildRain(): void {
    for (let i = 0; i < 46; i++) {
      const x = Phaser.Math.Between(60, WORLD_W - 60);
      const len = Phaser.Math.Between(22, 54);
      const drop = this.add
        .rectangle(x, Phaser.Math.Between(-80, WORLD_H), 2.2, len, 0x8fa3b0, 0.28)
        .setAngle(12)
        .setDepth(850);
      this.tweens.add({
        targets: drop,
        y: WORLD_H + 120,
        duration: Phaser.Math.Between(700, 1250),
        delay: Phaser.Math.Between(0, 1200),
        repeat: -1,
        onRepeat: () => {
          drop.x = Phaser.Math.Between(60, WORLD_W - 60);
          drop.y = -80;
        },
      });
      this.rainRects.push(drop);
    }
    this.unsubs.push(() => this.rainRects.forEach((r) => r.destroy()));
  }

  protected abstract sceneData(): StationSceneData;
  protected abstract artKey(): string;
  protected abstract hasRain(): boolean;
}
