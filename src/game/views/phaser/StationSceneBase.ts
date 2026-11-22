/**
 * StationSceneBase -- shared renderer for the three precinct scenes. Every
 * hotspot (position, kind, label, payload) and the whole walking geometry
 * (walkable rects, colliders, depth-sorted props, stand points) come from
 * world.json; the scene draws, feeds input to the walker, and delegates
 * intents to the SceneCtx hooks. Extending the world means editing data,
 * never this file.
 *
 * Player flow in a nav-enabled level:
 *  - WASD/arrows move the detective freely (360 degrees, diagonals included)
 *  - tapping open floor walks him there (pathfinding around furniture)
 *  - tapping a hotspot walks him to its stand point, then fires the action
 *  - standing close and pressing E / Space / Enter fires the nearest hotspot
 *  - furniture is Y-sorted: the detective passes behind the cooler and Dewi
 */

import * as Phaser from 'phaser';
import { getSceneCtx, type SceneCtx } from './SceneCtx';
import { StationPlayer } from './StationPlayer';
import { withBase } from '../../core/assetUrl';
import type { StationHotspot, StationNav, StationSceneData } from '../../data/types';

const WORLD_W = 1920;
const WORLD_H = 1080;
const BG_DEPTH = -10;
const UI_DEPTH = 900;

/** Scene key -> precinct level (the guard below keys off this mapping). */
const LEVEL_BY_KEY: Record<string, 'exterior' | 'interior' | 'upper'> = {
  'station-ext': 'exterior',
  'station-int': 'interior',
  'station-up': 'upper',
};

const PLAYER_FRAMES = ['down-0', 'down-1', 'down-2', 'up-0', 'up-1', 'up-2', 'side-0', 'side-1', 'side-2'];

interface SpotVis {
  ring: Phaser.GameObjects.Rectangle;
  chip: Phaser.GameObjects.Container;
  pulse: Phaser.GameObjects.Arc | null;
  interactive: boolean;
}

export abstract class StationSceneBase extends Phaser.Scene {
  protected ctx!: SceneCtx;
  private unsubs: Array<() => void> = [];
  private rainRects: Phaser.GameObjects.Rectangle[] = [];

  private nav: StationNav | null = null;
  private player: StationPlayer | null = null;
  private spotVis = new Map<string, SpotVis>();
  private zoneTapped = false;
  private posSaveTimer = 0;
  private debugNav = false;
  private debugGfx: Phaser.GameObjects.Graphics | null = null;
  private nearestId: string | null = null;
  private wasdKeys: Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key> | null = null;
  private cursorKeys: ReturnType<Phaser.Input.Keyboard.KeyboardPlugin['createCursorKeys']> | null = null;
  private debugKeyListener: (() => void) | null = null;

  constructor(key: string) {
    super(key);
  }

  /* --------------------------------------------------------- data */

  protected level(): 'exterior' | 'interior' | 'upper' | undefined {
    return LEVEL_BY_KEY[this.scene.key];
  }

  preload(): void {
    // ctx is set before the game boots (PhaserHost constructor) and must be
    // read here too: the art path comes from world.json.
    this.ctx = getSceneCtx();
    this.load.image(this.artKey(), withBase(this.sceneData().art));
    const nav = this.sceneData().nav;
    if (nav) {
      for (const frame of PLAYER_FRAMES) this.load.image(`player-${frame}`, withBase(`/art/player/${frame}.svg`));
      for (const prop of nav.props ?? []) this.load.image(`prop-${prop.id}`, withBase(prop.img));
    }
  }

  create(): void {
    const vm = this.ctx.vm;

    // Boot race guard: the scene list auto-starts the first station scene, and
    // a stop() during another scene's loading phase does not stick. So every
    // station scene checks, at create time, whether it is still the level the
    // precinct wants -- if not, it stands down quietly.
    const mine = this.level();
    if (mine && mine !== vm.state.stationLevel) {
      this.scene.stop();
      return;
    }

    const img = this.add.image(WORLD_W / 2, WORLD_H / 2, this.artKey());
    img.setOrigin(0.5);
    img.setDepth(BG_DEPTH);
    const zoom = Math.min(1280 / WORLD_W, 720 / WORLD_H) * 0.98;
    this.cameras.main.setZoom(zoom);
    // Bounds keep the follow-cam honest: the precinct always fills the frame
    // (when the view is larger than the world, Phaser letterboxes it centred),
    // and larger future precincts get scrolling for free.
    this.cameras.main.setBounds(0, 0, WORLD_W, WORLD_H);
    this.cameras.main.centerOn(WORLD_W / 2, WORLD_H / 2);

    this.nav = this.sceneData().nav ?? null;
    this.buildProps();
    this.spawnPlayer();
    this.buildHotspots();
    this.buildInput();
    this.buildDebugNav();

    // First time into this level: play the once-only narration (data-driven).
    const fe = this.sceneData().firstEntry;
    if (fe && !vm.state.station.flags[fe.flag]) {
      this.ctx.hooks.narrate?.({ flag: fe.flag, lines: fe.lines });
    }

    // Location caption chip, bottom-left (HUD is hidden in the precinct).
    this.pinTitleChip();

    this.addAmbience();

    // Debug/verification hook (harmless in production): walkthrough scripts
    // reach the walker via window.__game.station.
    (window as unknown as { __game?: Record<string, unknown> }).__game = {
      ...((window as unknown as { __game?: Record<string, unknown> }).__game ?? {}),
      station: this,
    };

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      delete (window as unknown as { __game?: Record<string, unknown> }).__game?.station;
      this.savePosition();
      this.unsubs.forEach((u) => u());
      this.unsubs = [];
      this.rainRects = [];
      this.spotVis.clear();
      this.player = null;
      this.debugGfx = null;
      if (this.textures.exists(this.artKey())) this.textures.remove(this.artKey());
      for (const frame of PLAYER_FRAMES) if (this.textures.exists(`player-${frame}`)) this.textures.remove(`player-${frame}`);
      for (const prop of this.nav?.props ?? []) if (this.textures.exists(`prop-${prop.id}`)) this.textures.remove(`prop-${prop.id}`);
    });
  }

  /** The scene loop: walker input, camera follow, proximity labels. */
  override update(_time: number, delta: number): void {
    const dt = delta / 1000;
    if (!this.player || !this.nav) return;

    // Freeze while an overlay (dialogue, notebook, desk drawer...) is up.
    const blocked = this.ctx.isUIBlocked?.() ?? false;
    this.player.setFrozen(blocked);

    const wish = new Phaser.Math.Vector2(0, 0);
    if (!blocked && this.wasdKeys && this.cursorKeys) {
      const k = this.wasdKeys;
      const c = this.cursorKeys;
      if (k.A.isDown || c.left.isDown) wish.x -= 1;
      if (k.D.isDown || c.right.isDown) wish.x += 1;
      if (k.W.isDown || c.up.isDown) wish.y -= 1;
      if (k.S.isDown || c.down.isDown) wish.y += 1;
    }
    this.player.update(wish, dt);

    // Gentle camera follow (the precinct fits the viewport, so this only
    // breathes -- but bigger precincts inherit it for free).
    const cam = this.cameras.main;
    cam.centerOn(
      Phaser.Math.Linear(cam.scrollX + cam.width / 2, this.player.x, 0.06),
      Phaser.Math.Linear(cam.scrollY + cam.height / 2, this.player.y, 0.06)
    );

    this.updateProximity();

    // autosave the walking position a little after it settles
    this.posSaveTimer += dt;
    if (this.posSaveTimer > 1.2) {
      this.posSaveTimer = 0;
      this.savePosition();
    }
  }

  /* --------------------------------------------------------- props + player */

  /** Depth-sorted foreground sprites: overlays of art groups + characters.
   *  Deliberately NOT interactive -- hotspot zones own every tap, and an
   *  interactive prop would swallow the taps aimed at the person behind it. */
  private buildProps(): void {
    const props = this.nav?.props ?? [];
    for (const prop of props) {
      this.add
        .image(prop.x, prop.y, `prop-${prop.id}`)
        .setOrigin(0, 0)
        .setDisplaySize(prop.w, prop.h)
        .setDepth(prop.base);
    }
  }

  /** Spawn from the saved per-level position, else the level's door logic. */
  private spawnPlayer(): void {
    if (!this.nav) return;
    const vm = this.ctx.vm;
    const level = this.level();
    const saved = level ? vm.state.station.pos?.[level] : undefined;
    const from = vm.lastStationFrom;
    const near = (from && this.nav.spawnNear?.[from]) || undefined;
    const spawn = saved ?? near ?? this.nav.spawn;
    this.player = new StationPlayer(this, this.nav, { x: spawn[0], y: spawn[1] });
    // Face the room centre on entry, so the first frame reads right.
    if (!saved) {
      this.player.faceTowards(WORLD_W / 2, WORLD_H / 2);
    }
  }

  private savePosition(): void {
    if (!this.player || !this.nav) return;
    const level = this.level();
    if (!level) return;
    const vm = this.ctx.vm;
    const [x, y] = [Math.round(this.player.x), Math.round(this.player.y)];
    const prev = vm.state.station.pos?.[level];
    if (prev && prev[0] === x && prev[1] === y) return;
    vm.setStationPos(level, [x, y]);
  }

  /* --------------------------------------------------------- hotspots */

  /** Hotspot tap behaviour is data-driven; the base covers every world kind. */
  protected activateHotspot(h: StationHotspot): void {
    const vm = this.ctx.vm;
    switch (h.kind) {
      case 'door':
        this.ctx.hooks.wipe(() => {
          const from = this.level();
          vm.setStationLevel((h.to ?? 'interior') as 'exterior' | 'interior' | 'upper', from);
        });
        break;
      case 'files':
        this.ctx.hooks.openCaseFiles();
        break;
      case 'dialogue':
        if (h.dialogue) this.ctx.hooks.openDialogue(h.dialogue);
        break;
      case 'career':
        this.ctx.hooks.openCareer?.();
        break;
      case 'flavor':
      case 'locked':
        this.ctx.hooks.toast(h.line ?? h.label, 'info');
        break;
    }
  }

  /**
   * Walk-then-interact: inside reach the action fires at once; otherwise the
   * detective walks to the stand point first and the action fires on arrival.
   */
  private tryActivate(h: StationHotspot): void {
    if (!this.player || !this.nav) {
      this.activateHotspot(h);
      return;
    }
    const reach = this.nav.reach ?? 150;
    if (this.player.distToRect(h.spot) <= reach) {
      this.player.stop();
      this.activateHotspot(h);
      return;
    }
    const stand = this.nav.standPoints?.[h.id];
    this.player.walkToRect(h.spot, stand ? { x: stand[0], y: stand[1] } : null, () => this.activateHotspot(h));
  }

  private buildHotspots(): void {
    const highlights = this.ctx.vm.state.settings.highlights;
    for (const h of this.sceneData().hotspots) {
      const [x, y, w, hh] = h.spot;
      const cx = x + w / 2;
      const cy = y + hh / 2;
      const interactive = h.kind === 'door' || h.kind === 'files' || h.kind === 'dialogue' || h.kind === 'career';

      const zone = this.add.zone(cx, cy, w, hh).setInteractive({ useHandCursor: interactive });

      const ring = this.add
        .rectangle(cx, cy, w - 10, hh - 10)
        .setStrokeStyle(3, 0xb4552d, 0.9)
        .setVisible(false);

      // Label chip (hover on desktop; also shown when the detective is near)
      const labelWidth = h.label.length * 12 + 30;
      const chip = this.add.container(cx, Math.max(y - 26, 40), [
        this.add.rectangle(0, 0, labelWidth, 38, 0xf4ecdb, 0.95).setStrokeStyle(2, 0x2e2a33, 0.85),
        this.add.text(0, 0, h.label, {
          fontFamily: 'Caveat, cursive',
          fontSize: '22px',
          color: '#2e2a33',
        }),
      ]);
      chip.setDepth(UI_DEPTH).setVisible(false).setAlpha(0);

      // Soft pulsing dot marks interactive spots when highlights are enabled.
      let pulse: Phaser.GameObjects.Arc | null = null;
      if (highlights && interactive) {
        pulse = this.add.circle(cx, y + hh - 16, 7, 0xe8b24a, 0.95).setDepth(UI_DEPTH - 1);
        this.tweens.add({
          targets: pulse,
          alpha: { from: 0.95, to: 0.25 },
          scale: { from: 1, to: 0.8 },
          duration: 1100,
          yoyo: true,
          repeat: -1,
        });
      }

      zone.on('pointerdown', () => {
        this.zoneTapped = true;
      });
      zone.on('pointerover', () => {
        ring.setVisible(true);
        chip.setVisible(true);
        this.tweens.add({ targets: chip, alpha: 1, duration: 120 });
      });
      zone.on('pointerout', () => {
        ring.setVisible(false);
        if (h.id !== this.nearestId) {
          this.tweens.add({ targets: chip, alpha: 0, duration: 120, onComplete: () => chip.setVisible(false) });
        }
      });
      zone.on('pointerup', () => this.tryActivate(h));

      this.spotVis.set(h.id, { ring, chip, pulse, interactive });
      this.unsubs.push(() => {
        ring.destroy();
        chip.destroy();
        pulse?.destroy();
      });
    }
  }

  /* --------------------------------------------------------- input */

  private buildInput(): void {
    const kb = this.input.keyboard;
    this.zoneTapped = false;

    if (this.nav && kb) {
      this.wasdKeys = kb.addKeys('W,A,S,D') as Record<'W' | 'A' | 'S' | 'D', Phaser.Input.Keyboard.Key>;
      this.cursorKeys = kb.createCursorKeys();
      // Keep the browser page from scrolling while walking.
      kb.addCapture(['W', 'A', 'S', 'D', 'UP', 'DOWN', 'LEFT', 'RIGHT', 'SPACE', 'E', 'ENTER']);

      kb.on('keydown-E', this.fireNearest, this);
      kb.on('keydown-SPACE', this.fireNearest, this);
      kb.on('keydown-ENTER', this.fireNearest, this);
      this.unsubs.push(() => {
        kb.off('keydown-E', this.fireNearest, this);
        kb.off('keydown-SPACE', this.fireNearest, this);
        kb.off('keydown-ENTER', this.fireNearest, this);
      });

      // Tap open floor -> walk there (hotspots handle their own taps).
      this.input.on('pointerdown', () => {
        this.zoneTapped = false;
      });
      this.input.on('pointerup', (p: Phaser.Input.Pointer) => {
        if (this.zoneTapped || !this.player) return;
        const world = this.cameras.main.getWorldPoint(p.x, p.y);
        if (world.x < 0 || world.y < 0 || world.x > WORLD_W || world.y > WORLD_H) return;
        this.player.walkTo(world.x, world.y);
      });
    }

    // Debug overlay toggle (?nav=1 in the URL, or the N key).
    this.debugKeyListener = () => this.toggleDebugNav();
    kb?.on('keydown-N', this.debugKeyListener);
    this.unsubs.push(() => {
      if (this.debugKeyListener) kb?.off('keydown-N', this.debugKeyListener);
    });
  }

  /** E / Space / Enter: interact with the nearest hotspot in reach. */
  private fireNearest(): void {
    if (!this.player || !this.nav || this.nearestId === null) return;
    if (this.ctx.isUIBlocked?.()) return;
    const h = this.sceneData().hotspots.find((s) => s.id === this.nearestId);
    if (!h) return;
    const interactive = h.kind !== 'flavor' && h.kind !== 'locked';
    if (!interactive) return;
    this.player.stop();
    this.activateHotspot(h);
  }

  /** Show the nearest in-reach hotspot's chip while the detective is close. */
  private updateProximity(): void {
    if (!this.player || !this.nav) return;
    const reach = this.nav.reach ?? 150;
    let best: string | null = null;
    let bestD = Infinity;
    for (const h of this.sceneData().hotspots) {
      if (h.kind === 'flavor' || h.kind === 'locked') continue;
      const d = this.player.distToRect(h.spot);
      if (d <= reach && d < bestD) {
        bestD = d;
        best = h.id;
      }
    }
    if (best === this.nearestId) return;
    const prev = this.nearestId ? this.spotVis.get(this.nearestId) : null;
    if (prev) {
      prev.ring.setVisible(false);
      this.tweens.add({ targets: prev.chip, alpha: 0, duration: 120, onComplete: () => prev.chip.setVisible(false) });
    }
    this.nearestId = best;
    const cur = best ? this.spotVis.get(best) : null;
    if (cur) {
      cur.ring.setVisible(true);
      cur.chip.setVisible(true);
      this.tweens.add({ targets: cur.chip, alpha: 1, duration: 120 });
    }
  }

  /* --------------------------------------------------------- debug */

  private toggleDebugNav(): void {
    this.debugNav = !this.debugNav;
    this.drawDebugNav();
  }

  private buildDebugNav(): void {
    const params = new URLSearchParams(window.location.search);
    if (params.get('nav') === '1') {
      this.debugNav = true;
      this.drawDebugNav();
    }
  }

  /** Walkable (green) vs colliders (red) vs stand points (crosses). */
  private drawDebugNav(): void {
    if (!this.debugGfx) this.debugGfx = this.add.graphics().setDepth(UI_DEPTH + 10);
    const g = this.debugGfx;
    g.clear();
    if (!this.debugNav || !this.nav) return;
    for (const [x, y, w, h] of this.nav.walk) {
      g.fillStyle(0x2c7a4b, 0.28);
      g.fillRect(x, y, w, h);
      g.lineStyle(2, 0x2c7a4b, 0.9);
      g.strokeRect(x, y, w, h);
    }
    for (const [x, y, w, h] of this.nav.colliders ?? []) {
      g.fillStyle(0xb4552d, 0.3);
      g.fillRect(x, y, w, h);
      g.lineStyle(2, 0xb4552d, 0.9);
      g.strokeRect(x, y, w, h);
    }
    for (const p of this.nav.props ?? []) {
      if (!p.solid) continue;
      const [x, y, w, h] = p.solid;
      g.fillStyle(0x8a5343, 0.3);
      g.fillRect(x, y, w, h);
      g.lineStyle(2, 0x8a5343, 0.9);
      g.strokeRect(x, y, w, h);
    }
    g.lineStyle(2, 0xe8b24a, 0.95);
    for (const pt of Object.values(this.nav.standPoints ?? {})) {
      const [x, y] = pt;
      g.lineBetween(x - 10, y, x + 10, y);
      g.lineBetween(x, y - 10, x, y + 10);
    }
  }

  /* --------------------------------------------------------- ambience */

  private pinTitleChip(): void {
    const title = this.sceneData().title;
    const chipBg = this.add.rectangle(0, 0, title.length * 13 + 46, 44, 0xf4ecdb, 0.92)
      .setStrokeStyle(2, 0x2e2a33, 0.8)
      .setDepth(UI_DEPTH);
    const chipText = this.add
      .text(0, 0, title, {
        fontFamily: 'Caveat, cursive',
        fontSize: '26px',
        color: '#2e2a33',
      })
      .setOrigin(0.5)
      .setDepth(UI_DEPTH);
    // The camera never scrolls far here: pin the chip to the visible bottom-left.
    const chipZoom = this.cameras.main.zoom;
    const viewW = 1280 / chipZoom;
    const viewH = 720 / chipZoom;
    const left = WORLD_W / 2 - viewW / 2;
    const bottom = WORLD_H / 2 + viewH / 2;
    chipBg.setPosition(left + 18 + chipBg.width / 2, bottom - 14 - chipBg.height / 2);
    chipText.setPosition(left + 18 + chipBg.width / 2, bottom - 14 - chipBg.height / 2);
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
        .setDepth(UI_DEPTH - 40);
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
