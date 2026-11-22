/**
 * StationPlayer -- the walking detective for the precinct scenes.
 *
 * Owns everything about locomotion; the scene only feeds it input and reads
 * back position/depth:
 *  - free 360-degree movement (keyboard WASD/arrows, diagonal normalised)
 *  - click/tap-to-move with pathfinding over the walkable-rect union
 *  - circle-vs-rect collision: walkable rects minus collider footprints,
 *    resolved axis-by-axis so the body slides along obstacles
 *  - facing + 3-frame walk cycle drawn from the hand-drawn sprite set
 *  - depth = feet y, so Y-sorting against props is just setDepth()
 *
 * All geometry comes from world.json (StationNav) -- no per-scene hard-coding.
 */

import * as Phaser from 'phaser';
import type { Rect, StationNav } from '../../data/types';

const BODY_R = 20; // collision radius (world px)
const MAX_SPEED = 340; // world px/s
const ACCEL = 1600; // approach speed while walking
const DECEL = 1900; // stop speed
const WAYPOINT_R = 10; // arrival threshold for path waypoints
const STOP_R = 4; // arrival threshold for the final point

export type Facing = 'down' | 'up' | 'left' | 'right';

interface MoveTarget {
  pts: Phaser.Math.Vector2[];
  idx: number;
  /** Fired once when the final waypoint is reached. */
  onArrive?: () => void;
}

export class StationPlayer {
  readonly sprite: Phaser.GameObjects.Image;
  readonly shadow: Phaser.GameObjects.Ellipse;

  private nav: StationNav;
  private colliders: Rect[];
  private pos = new Phaser.Math.Vector2();
  private vel = new Phaser.Math.Vector2();
  private target: MoveTarget | null = null;
  private facing: Facing = 'down';
  private walkDist = 0;
  private frozen = false;
  /** Seconds in the latest frame (clamped) -- drives stride + integration. */
  private lastDt = 1 / 60;
  /** Consecutive seconds pinned against an obstacle with an order pending. */
  private stallTime = 0;
  /** Re-plans spent on the current order (capped so we never thrash). */
  private replans = 0;

  constructor(
    scene: Phaser.Scene,
    nav: StationNav,
    spawn: { x: number; y: number }
  ) {
    this.nav = nav;
    this.colliders = [...(nav.colliders ?? [])];
    for (const p of nav.props ?? []) if (p.solid) this.colliders.push(p.solid);

    this.shadow = scene.add
      .ellipse(spawn.x, spawn.y - 2, 56, 16, 0x2e2a33, 0.16)
      .setDepth(spawn.y - 0.5);
    this.sprite = scene.add
      .image(spawn.x, spawn.y, 'player-down-0')
      .setOrigin(0.5, 1)
      .setDepth(spawn.y);
    this.pos.set(spawn.x, spawn.y);
  }

  /* ------------------------------------------------ geometry queries */

  /** The point must sit in a walkable rect and clear every collider. */
  private validAt(x: number, y: number): boolean {
    const inWalk = this.nav.walk.some(([wx, wy, ww, wh]) => x >= wx && x <= wx + ww && y >= wy && y <= wy + wh);
    if (!inWalk) return false;
    return !this.colliders.some(([cx, cy, cw, ch]) => {
      // the collider is inflated by the body radius (it is a circle, corners
      // get a little slack -- only the middle matters for feel)
      const nearestX = Math.max(cx, Math.min(x, cx + cw));
      const nearestY = Math.max(cy, Math.min(y, cy + ch));
      const dx = x - nearestX;
      const dy = y - nearestY;
      return dx * dx + dy * dy < BODY_R * BODY_R;
    });
  }

  /** Straight-line walkability, sampled every 10px. */
  private lineWalkable(x0: number, y0: number, x1: number, y1: number): boolean {
    const d = Phaser.Math.Distance.Between(x0, y0, x1, y1);
    const steps = Math.max(1, Math.ceil(d / 10));
    for (let i = 1; i <= steps; i++) {
      const t = i / steps;
      const lx = x0 + (x1 - x0) * t;
      const ly = y0 + (y1 - y0) * t;
      if (!this.validAt(lx, ly)) return false;
    }
    return true;
  }

  /** Nearest valid point to (x, y): spiral search out to 140px. */
  private nearestValid(x: number, y: number): { x: number; y: number } | null {
    if (this.validAt(x, y)) return { x, y };
    for (let r = 12; r <= 140; r += 12) {
      for (let a = 0; a < 24; a++) {
        const ang = (a / 24) * Math.PI * 2;
        const px = x + Math.cos(ang) * r;
        const py = y + Math.sin(ang) * r;
        if (this.validAt(px, py)) return { x: px, y: py };
      }
    }
    return null;
  }

  /** Distance from the body to a rect (0 when inside it). */
  distToRect(r: Rect): number {
    const [x, y, w, h] = r;
    const nx = Math.max(x, Math.min(this.pos.x, x + w));
    const ny = Math.max(y, Math.min(this.pos.y, y + h));
    return Phaser.Math.Distance.Between(this.pos.x, this.pos.y, nx, ny);
  }

  get x(): number {
    return this.pos.x;
  }
  get y(): number {
    return this.pos.y;
  }
  get speed(): number {
    return this.vel.length();
  }

  /* ------------------------------------------------ pathfinding */

  /*
   * Grid A* over the walkable union. The level rasterizes into CELL-sized
   * squares (each open iff its centre passes validAt), A* runs with 8-way
   * moves (no corner cutting), and the cell chain is string-pulled with
   * line-of-sight checks so the detective walks clean diagonals instead of
   * a staircase. This handles any combination of furniture, doorways and
   * depth-sort props straight from the data -- no per-room tuning.
   */

  private static CELL = 16;
  private grid: Uint8Array | null = null;
  private gridW = 0;
  private gridH = 0;

  /** Rasterize walkable space once per level (called from the constructor). */
  private buildGrid(): void {
    this.gridW = Math.ceil(1920 / StationPlayer.CELL);
    this.gridH = Math.ceil(1080 / StationPlayer.CELL);
    const g = new Uint8Array(this.gridW * this.gridH);
    for (let cy = 0; cy < this.gridH; cy++) {
      for (let cx = 0; cx < this.gridW; cx++) {
        const x = cx * StationPlayer.CELL + StationPlayer.CELL / 2;
        const y = cy * StationPlayer.CELL + StationPlayer.CELL / 2;
        g[cy * this.gridW + cx] = this.validAt(x, y) ? 1 : 0;
      }
    }
    this.grid = g;
  }

  private cellAt(x: number, y: number): [number, number] {
    return [
      Phaser.Math.Clamp(Math.floor(x / StationPlayer.CELL), 0, this.gridW - 1),
      Phaser.Math.Clamp(Math.floor(y / StationPlayer.CELL), 0, this.gridH - 1),
    ];
  }

  private cellOpen(cx: number, cy: number): boolean {
    if (cx < 0 || cy < 0 || cx >= this.gridW || cy >= this.gridH) return false;
    return this.grid![cy * this.gridW + cx] === 1;
  }

  private cellCenter(cx: number, cy: number): Phaser.Math.Vector2 {
    return new Phaser.Math.Vector2(cx * StationPlayer.CELL + StationPlayer.CELL / 2, cy * StationPlayer.CELL + StationPlayer.CELL / 2);
  }

  /** A* over the walkable grid; returns cell centres from start to goal. */
  private astar(sx: number, sy: number, gx: number, gy: number): Array<[number, number]> | null {
    const W = this.gridW;
    const idx = (cx: number, cy: number) => cy * W + cx;
    const heur = (cx: number, cy: number) => Math.abs(cx - gx) + Math.abs(cy - gy);

    const start = idx(sx, sy);
    const goal = idx(gx, gy);
    if (!this.cellOpen(sx, sy) || !this.cellOpen(gx, gy)) return null;
    if (start === goal) return [[gx, gy]];

    const gScore = new Map<number, number>([[start, 0]]);
    const came = new Map<number, number>();
    // binary-heap-ish: the grid is small, a sorted-insert open list is plenty
    const open: Array<{ i: number; f: number }> = [{ i: start, f: heur(sx, sy) }];
    const closed = new Set<number>();

    const N8 = [
      [1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1],
      [1, 1, 1.42], [1, -1, 1.42], [-1, 1, 1.42], [-1, -1, 1.42],
    ];

    while (open.length) {
      // pop the lowest f (open list stays roughly sorted by insertion)
      let bi = 0;
      for (let k = 1; k < open.length; k++) if (open[k].f < open[bi].f) bi = k;
      const cur = open.splice(bi, 1)[0];
      if (closed.has(cur.i)) continue;
      closed.add(cur.i);
      if (cur.i === goal) break;
      const cx = cur.i % W;
      const cy = (cur.i - cx) / W;
      for (const [dx, dy, cost] of N8) {
        const nx = cx + dx;
        const ny = cy + dy;
        if (!this.cellOpen(nx, ny)) continue;
        // no corner cutting: diagonals need both orthogonal neighbours open
        if (dx !== 0 && dy !== 0 && (!this.cellOpen(cx + dx, cy) || !this.cellOpen(cx, cy + dy))) continue;
        const ni = idx(nx, ny);
        if (closed.has(ni)) continue;
        const tg = gScore.get(cur.i)! + cost;
        if (tg < (gScore.get(ni) ?? Infinity)) {
          gScore.set(ni, tg);
          came.set(ni, cur.i);
          open.push({ i: ni, f: tg + heur(nx, ny) });
        }
      }
    }
    if (!came.has(goal) && start !== goal) return null;

    const cells: Array<[number, number]> = [];
    let cur = goal;
    while (cur !== start) {
      const cx = cur % W;
      cells.unshift([cx, (cur - cx) / W]);
      const prev = came.get(cur);
      if (prev === undefined) return null;
      cur = prev;
    }
    return cells;
  }

  /**
   * String-pull the cell chain: walk straight to the farthest visible cell
   * centre, repeat. Produces clean diagonals instead of a staircase.
   */
  private smoothPath(cells: Array<[number, number]>): Phaser.Math.Vector2[] {
    const centers = cells.map(([cx, cy]) => this.cellCenter(cx, cy));
    const out: Phaser.Math.Vector2[] = [];
    let from = { x: this.pos.x, y: this.pos.y };
    let k = 0;
    while (k < centers.length) {
      let far = k;
      for (let m = centers.length - 1; m > k; m--) {
        if (this.lineWalkable(from.x, from.y, centers[m].x, centers[m].y)) {
          far = m;
          break;
        }
      }
      out.push(centers[far]);
      from = { x: centers[far].x, y: centers[far].y };
      k = far + 1;
    }
    return out;
  }

  /** Grid-based route to a validated goal (null when the grid disagrees). */
  private gridRoute(goal: Phaser.Math.Vector2): Phaser.Math.Vector2[] | null {
    if (!this.grid) this.buildGrid();
    const [scx, scy] = this.cellAt(this.pos.x, this.pos.y);
    const [gcx, gcy] = this.cellAt(goal.x, goal.y);
    let [sx, sy] = [scx, scy];
    if (!this.cellOpen(sx, sy)) {
      // body sits on a cell whose centre is blocked (boundary case): search
      // outward for the nearest open cell
      let found = false;
      for (let r = 1; r <= 6 && !found; r++) {
        for (let dy = -r; dy <= r && !found; dy++) {
          for (let dx = -r; dx <= r && !found; dx++) {
            if (this.cellOpen(scx + dx, scy + dy)) {
              [sx, sy] = [scx + dx, scy + dy];
              found = true;
            }
          }
        }
      }
      if (!found) return null;
    }
    const cells = this.astar(sx, sy, gcx, gcy);
    if (!cells) return null;
    const pts = this.smoothPath(cells);
    if (pts.length) pts[pts.length - 1] = goal.clone(); // land exactly on the goal
    return pts.length ? pts : null;
  }

  /* ------------------------------------------------ commands */

  /** Tap-to-move: pathfind to a world point (snapped to nearby walk space). */
  walkTo(x: number, y: number, onArrive?: () => void): void {
    const snap = this.nearestValid(x, y);
    if (!snap) return;
    const goal = new Phaser.Math.Vector2(snap.x, snap.y);

    let pts: Phaser.Math.Vector2[] | null = null;
    if (this.lineWalkable(this.pos.x, this.pos.y, goal.x, goal.y)) {
      pts = [goal.clone()];
    } else {
      pts = this.gridRoute(goal);
    }
    this.target = { pts: pts ?? [goal.clone()], idx: 0, onArrive };
    this.stallTime = 0;
    this.replans = 0;
  }

  /**
   * Re-plan the current order from wherever the body actually stopped. The
   * first plan is computed from the start point and can be invalidated by
   * obstacles met en route; a fresh plan from the pinned spot corners around
   * them (this is what makes concave pockets and long desks walkable).
   */
  private replan(): void {
    const t = this.target;
    if (!t || this.replans >= 8) return;
    const last = t.pts[t.pts.length - 1];
    const spent = this.replans + 1;
    this.walkTo(last.x, last.y, t.onArrive);
    this.replans = spent; // walkTo resets it -- keep the cap honest
  }

  /** Walk to a hotspot rect (stand point optional), then fire the action. */
  walkToRect(r: Rect, stand: { x: number; y: number } | null, onArrive: () => void): void {
    const goal = stand ?? this.nearestValid(r[0] + r[2] / 2, r[1] + r[3] - 8) ?? null;
    if (!goal) return;
    this.walkTo(goal.x, goal.y, onArrive);
  }

  /** Immediate stop (overlay opened, interaction fired, ...). */
  stop(): void {
    this.target = null;
    this.vel.set(0, 0);
    this.applyFrame();
  }

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
    if (frozen) this.stop();
  }

  teleport(x: number, y: number): void {
    this.pos.set(x, y);
    this.vel.set(0, 0);
    this.target = null;
    this.sprite.setPosition(x, y);
    this.shadow.setPosition(x, y - 2);
    this.sprite.setDepth(y);
    this.shadow.setDepth(y - 0.5);
    this.applyFrame();
  }

  /** Turn toward a world point without moving (used on level entry). */
  faceTowards(x: number, y: number): void {
    const dx = x - this.pos.x;
    const dy = y - this.pos.y;
    if (Math.abs(dx) > Math.abs(dy) * 1.12) this.facing = dx > 0 ? 'right' : 'left';
    else this.facing = dy > 0 ? 'down' : 'up';
    this.applyFrame();
  }

  /* ------------------------------------------------ per-frame update */

  /**
   * @param wish  normalised keyboard intent (0,0 when idle / click-moving)
   * @param dt    seconds
   */
  update(wish: Phaser.Math.Vector2, dt: number): void {
    this.lastDt = Math.min(dt, 1 / 30);

    if (this.frozen) {
      this.vel.scale(Math.max(0, 1 - (DECEL * dt) / MAX_SPEED));
      this.integrate();
      this.applyFrame();
      return;
    }

    if (wish.lengthSq() > 0.01) {
      this.target = null; // keyboard overrides any walk order
      this.accelToward(wish.clone().normalize().scale(MAX_SPEED), dt);
    } else if (this.target) {
      const wp = this.target.pts[this.target.idx];
      const d = Phaser.Math.Distance.Between(this.pos.x, this.pos.y, wp.x, wp.y);
      const last = this.target.idx === this.target.pts.length - 1;
      if (d < (last ? STOP_R : WAYPOINT_R)) {
        if (last) {
          const done = this.target.onArrive;
          this.target = null;
          this.vel.set(0, 0);
          this.integrate();
          this.applyFrame();
          done?.();
          return;
        }
        this.target.idx++;
        this.stallTime = 0;
      } else {
        this.accelToward(wp.clone().subtract(this.pos).normalize().scale(MAX_SPEED), dt);
      }
      // pinned against furniture with the order still pending: corner again
      if (this.vel.length() < 15 && d > 30) {
        this.stallTime += dt;
        if (this.stallTime > 0.3) {
          this.stallTime = 0;
          this.replan();
        }
      } else {
        this.stallTime = 0;
      }
    } else {
      this.vel.scale(Math.max(0, 1 - (DECEL * dt) / MAX_SPEED));
    }
    this.integrate();
    this.applyFrame();
  }

  /** Accelerate the velocity vector toward a desired velocity. */
  private accelToward(desired: Phaser.Math.Vector2, dt: number): void {
    const diff = desired.clone().subtract(this.vel);
    const step = ACCEL * dt;
    if (diff.length() <= step) this.vel.copy(desired);
    else this.vel.add(diff.normalize().scale(step));
  }

  /**
   * Axis-by-axis collision resolution: try the full step, then x only, then
   * y only. Sliding along desks/walls falls out of the axis fallback, and
   * diagonal movement never clips corners.
   */
  private integrate(): void {
    const dx = this.vel.x * this.lastDt;
    const dy = this.vel.y * this.lastDt;
    if (dx === 0 && dy === 0) {
      this.syncVisual();
      return;
    }
    const nx = this.pos.x + dx;
    const ny = this.pos.y + dy;
    if (this.validAt(nx, ny)) {
      this.pos.set(nx, ny);
    } else if (dx !== 0 && this.validAt(nx, this.pos.y)) {
      this.pos.x = nx;
      this.vel.y = 0;
    } else if (dy !== 0 && this.validAt(this.pos.x, ny)) {
      this.pos.y = ny;
      this.vel.x = 0;
    } else {
      this.vel.set(0, 0);
    }
    // hard clamp (paranoia for tunnelling at low frame rates)
    this.pos.x = Phaser.Math.Clamp(this.pos.x, 24, 1896);
    this.pos.y = Phaser.Math.Clamp(this.pos.y, 600, 1060);
    this.syncVisual();
  }

  /* ------------------------------------------------ presentation */

  private syncVisual(): void {
    this.sprite.setPosition(this.pos.x, this.pos.y);
    this.shadow.setPosition(this.pos.x, this.pos.y - 2);
    this.sprite.setDepth(this.pos.y);
    this.shadow.setDepth(this.pos.y - 0.5);
  }

  private applyFrame(): void {
    const sp = this.vel.length();
    // facing: dominant axis wins; a slight bias keeps diagonals reading well
    if (sp > 24) {
      if (Math.abs(this.vel.x) > Math.abs(this.vel.y) * 1.12) {
        this.facing = this.vel.x > 0 ? 'right' : 'left';
      } else {
        this.facing = this.vel.y > 0 ? 'down' : 'up';
      }
      this.walkDist += sp * this.lastDt;
    }
    const moving = sp > 24;
    const frame = moving ? (Math.floor(this.walkDist / 38) % 2) + 1 : 0;
    const dir = this.facing === 'left' || this.facing === 'right' ? 'side' : this.facing;
    this.sprite.setTexture(`player-${dir}-${frame}`);
    this.sprite.setFlipX(this.facing === 'left');
    this.syncVisual();
  }
}
