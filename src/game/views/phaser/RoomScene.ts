/**
 * RoomScene -- the generic, data-driven side-view room.
 *
 * Everything comes from JSON: layer stack (parallax via scrollFactor),
 * hotspot rectangles (clues + doors), door labels. The scene only renders
 * and captures intents; decisions live in RoomVM, progression in GameVM.
 */

import * as Phaser from 'phaser';
import type { RoomSceneData, SceneCtx } from './SceneCtx';
import type { Hotspot } from '../../viewmodels/RoomVM';

const ACCENT = 0xb4552d;
const INK = 0x2e2a33;

interface ZoneVis {
  zone: Phaser.GameObjects.Zone;
  outline: Phaser.GameObjects.Graphics;
  shimmer?: Phaser.Tweens.Tween;
}

export class RoomScene extends Phaser.Scene {
  private ctx!: SceneCtx;
  private roomVM!: RoomSceneData['roomVM'];
  private roomId = '';
  private zoneVis = new Map<string, ZoneVis>();
  private unsubs: Array<() => void> = [];
  private dragDist = 0;
  private downAt = 0;

  constructor() {
    super('room');
  }

  init(data: RoomSceneData): void {
    this.roomId = data.roomId;
    this.roomVM = data.roomVM;
    this.ctx = data.ctx;
  }

  preload(): void {
    const room = this.roomVM.room;
    for (const layer of room.layers) {
      // Layer SVGs declare explicit width/height, so the plain image loader
      // rasterizes them at full size (Phaser's svg-blob path is unreliable).
      this.load.image(layer.key, layer.src);
    }
  }

  create(): void {
    const room = this.roomVM.room;
    const settings = this.ctx.vm.settings$.value;

    // Layer stack with parallax factors
    for (const layer of room.layers) {
      const img = this.add.image(0, 0, layer.key).setOrigin(0, 0);
      img.setScrollFactor(layer.scrollFactor, 1);
      img.setDepth(layer.depth);
    }

    // Camera: fit the 900-high world into the 720-high viewport, pan horizontally.
    const cam = this.cameras.main;
    cam.setBounds(0, 0, room.width, room.height);
    const zoom = 720 / room.height;
    cam.setZoom(zoom);
    cam.centerOn(room.width / 2, room.height / 2);

    this.buildHotspots();

    // Drag-pan + tap disambiguation
    this.dragDist = 0;
    this.input.on('pointerdown', () => {
      this.dragDist = 0;
      this.downAt = this.time.now;
    });
    this.input.on('pointermove', (p: Phaser.Input.Pointer) => {
      if (p.isDown) {
        this.dragDist += Math.abs(p.velocity.x) * 0.02 + Math.abs((p.position.x - p.prevPosition.x)) * 0.01;
        cam.scrollX -= (p.position.x - p.prevPosition.x) / cam.zoom;
      }
    });
    this.input.on('wheel', (_p: unknown, _o: unknown, dx: number, dy: number) => {
      cam.scrollX += (dx + dy) * 0.6;
    });

    // Re-sync zones when progression changes (found states, tool states)
    this.unsubs.push(
      this.roomVM.hotspots$.subscribe(() => {
        if (this.scene.isActive()) this.refreshHotspotStates();
      })
    );
    this.unsubs.push(
      this.ctx.vm.settings$.subscribe(() => this.refreshHotspotStates())
    );
    void settings;

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      this.zoneVis.clear();
      for (const layer of room.layers) {
        if (this.textures.exists(layer.key)) this.textures.remove(layer.key);
      }
    });

    // Ambient caption for subtitles users
    if (this.ctx.vm.state.settings.subtitles) {
      this.ctx.vm.bus.emit('caption', { text: `[${room.title.toLowerCase()} -- rain on the glass]` });
    }
  }

  /* -------------------------------------- hotspots */

  private buildHotspots(): void {
    this.roomVM.hotspots$.subscribe((spots) => {
      // create zones for new spots
      for (const spot of spots) {
        if (!this.zoneVis.has(spot.id)) this.addZone(spot);
      }
      // remove zones that vanished (none today, but data-driven safety)
      for (const id of Array.from(this.zoneVis.keys())) {
        if (!spots.find((s) => s.id === id)) this.removeZone(id);
      }
      this.refreshHotspotStates();
    }, true);
  }

  private addZone(spot: Hotspot): void {
    const [x, y, w, h] = spot.spot;
    const zone = this.add.zone(x + w / 2, y + h / 2, w, h).setInteractive({ useHandCursor: true });
    zone.setName(spot.id);
    const outline = this.add.graphics();

    if (spot.kind === 'person') this.drawPersonFigure(spot);

    zone.on('pointerover', () => {
      if (this.roomVM.hotspots$.value.find((s) => s.id === spot.id)?.kind !== 'door') {
        this.drawOutline(outline, spot, 0.95);
      }
    });
    zone.on('pointerout', () => {
      outline.clear();
    });
    zone.on('pointerup', () => {
      const held = this.downAt ? this.time.now - this.downAt : 0;
      if (this.dragDist > 14 || held > 800) return;
      this.handleTap(spot);
    });

    this.zoneVis.set(spot.id, { zone, outline });
  }

  /**
   * A pencil-sketch figure for a talkable person -- data-driven position,
   * tinted with the suspect's palette colour so each reads differently.
   */
  private drawPersonFigure(spot: Hotspot): void {
    const suspect = this.ctx.vm.repo.suspect(spot.personId ?? '');
    const tint = suspect?.tint ?? '#9aa88f';
    const [x, y, w, h] = spot.spot;
    const g = this.add.graphics();
    const cx = x + w / 2;
    const headR = Math.max(16, Math.min(26, w * 0.22));
    const headY = y + headR + 6;
    const bodyCy = y + h * 0.62;
    const bodyRx = w * 0.42;
    const bodyRy = h * 0.36;
    const fill = Phaser.Display.Color.HexStringToColor(tint).color;
    g.fillStyle(fill, 0.32);
    g.fillCircle(cx, headY, headR);
    g.fillEllipse(cx, bodyCy, bodyRx * 2, bodyRy * 2);
    g.lineStyle(3, INK, 0.85);
    g.strokeCircle(cx, headY, headR);
    g.strokeEllipse(cx, bodyCy, bodyRx * 2, bodyRy * 2);
    // sketchy shoulder strokes
    g.lineBetween(cx - bodyRx * 0.7, bodyCy - bodyRy * 0.4, cx - bodyRx * 0.5, bodyCy + bodyRy * 0.6);
    g.lineBetween(cx + bodyRx * 0.7, bodyCy - bodyRy * 0.4, cx + bodyRx * 0.5, bodyCy + bodyRy * 0.6);
  }

  private removeZone(id: string): void {
    const vis = this.zoneVis.get(id);
    if (!vis) return;
    vis.zone.destroy();
    vis.outline.destroy();
    this.zoneVis.delete(id);
  }

  private drawOutline(g: Phaser.GameObjects.Graphics, spot: Hotspot, alpha: number): void {
    const [x, y, w, h] = spot.spot;
    g.clear();
    g.lineStyle(3, ACCENT, alpha);
    g.strokeRoundedRect(x + 2, y + 2, w - 4, h - 4, 10);
    if (spot.needsTool && !spot.found) {
      // magnifier glyph at top-right corner
      const cx = x + w - 14;
      const cy = y + 14;
      g.lineStyle(2.5, ACCENT, alpha);
      g.strokeCircle(cx - 3, cy - 3, 7);
      g.lineBetween(cx + 3, cy + 3, cx + 11, cy + 11);
    }
    if (spot.found) {
      g.lineStyle(2, ACCENT, alpha * 0.5);
      g.strokeCircle(x + 14, y + 14, 7);
      g.lineBetween(x + 11, y + 14, x + 14, y + 17);
      g.lineBetween(x + 14, y + 17, x + 19, y + 10);
    }
  }

  private refreshHotspotStates(): void {
    const highlights = this.ctx.vm.settings$.value.highlights;
    for (const spot of this.roomVM.hotspots$.value) {
      const vis = this.zoneVis.get(spot.id);
      if (!vis) continue;
      vis.shimmer?.remove();
      vis.shimmer = undefined;
      if (highlights && !spot.found && (spot.kind === 'clue' || spot.kind === 'person')) {
        vis.shimmer = this.tweens.add({
          targets: vis.outline,
          alpha: { from: 0.28, to: 0.62 },
          duration: 1100,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
          onUpdate: () => this.drawOutline(vis.outline, spot, 0.5),
        });
      }
    }
  }

  private handleTap(spot: Hotspot): void {
    const vm = this.ctx.vm;
    if (spot.kind === 'clue') {
      const res = this.roomVM.tapClue(spot);
      if (!res.ok) {
        this.ctx.hooks.toast(res.reason, 'warn');
        return;
      }
      this.ctx.hooks.openClue(res.clue.id);
    } else if (spot.kind === 'person') {
      const res = this.roomVM.tapPerson(spot);
      if (!res.ok) {
        this.ctx.hooks.toast(res.reason, 'warn');
        return;
      }
      this.ctx.hooks.openDialogue(res.suspectId);
    } else {
      const res = this.roomVM.tapDoor(spot);
      if (res.action === 'enter') {
        const to = spot.door!.to;
        this.ctx.hooks.wipe(() => vm.enterRoom(to));
      } else if (res.action === 'gate') {
        this.ctx.hooks.openGate(res.gateId);
      } else {
        vm.bus.emit('room:doorLocked', { to: spot.door!.to, line: res.line });
        this.ctx.hooks.toast(res.line, 'warn');
      }
    }
  }
}
