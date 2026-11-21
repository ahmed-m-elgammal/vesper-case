/**
 * GameVM -- the root View Model. Owns the persistent GameState, exposes
 * observable slices for the views, and routes every intent (collect clue,
 * solve gate, change settings...) through methods that mutate state and
 * queue an autosave. Views never touch GameState directly.
 */

import { Computed, Observable } from '../core/Observable';
import { EventBus } from '../core/EventBus';
import type { ContentRepository } from '../data/ContentRepository';
import type { Clue, GameState, Room, Settings } from '../data/types';
import { freshState, migrateState } from '../data/types';
import type { DialogueContext, DialogueEffects } from '../dialogue/types';
import { SaveSystem } from '../save/SaveSystem';

export interface Toast {
  id: number;
  text: string;
  kind: 'clue' | 'info' | 'warn';
}

export class GameVM implements DialogueContext {
  readonly bus = new EventBus();
  readonly save: SaveSystem;

  readonly phase$: Observable<GameState['phase'] | 'boot'>;
  readonly roomId$: Observable<string | null>;
  readonly clues$: Observable<Record<string, { at: number }>>;
  readonly flags$: Observable<Record<string, boolean>>;
  readonly vars$: Observable<Record<string, number>>;
  readonly gates$: Observable<Record<string, boolean>>;
  readonly settings$: Observable<Settings>;
  readonly toasts$: Observable<Toast[]>;
  readonly saveFlash$: Observable<number>;
  readonly clueCount$: Observable<string>;
  readonly unlockedRooms$: Observable<string[]>;

  state: GameState = freshState();
  private toastId = 0;
  private sessionDismissed = new Set<string>();
  private gateNotified = new Set<string>();

  constructor(readonly repo: ContentRepository) {
    this.save = new SaveSystem(() => {
      this.saveFlash$.value = Date.now();
    });
    this.phase$ = new Observable<GameState['phase'] | 'boot'>('boot');
    this.roomId$ = new Observable<string | null>(null);
    this.clues$ = new Observable<Record<string, { at: number }>>({});
    this.flags$ = new Observable<Record<string, boolean>>({});
    this.vars$ = new Observable<Record<string, number>>({});
    this.gates$ = new Observable<Record<string, boolean>>({});
    this.settings$ = new Observable<Settings>(this.state.settings);
    this.toasts$ = new Observable<Toast[]>([]);
    this.saveFlash$ = new Observable<number>(0);
    this.clueCount$ = new Computed<string>(
      () => {
        const total = repo.bundle.clues.filter((c) => !this.isNestedOnly(c)).length;
        const found = Object.keys(this.clues$.value).filter((id) => {
          const c = repo.clue(id);
          return c && !this.isNestedOnly(c);
        }).length;
        return `${found} / ${total}`;
      },
      [this.clues$]
    );
    this.unlockedRooms$ = new Computed<string[]>(
      () => {
        // A room is unlocked when its act has shipped AND no unsolved gate
        // lists it as a reward (data-driven lock, no hard-coded ids).
        const gated = new Set<string>();
        for (const g of repo.gates()) {
          for (const rid of g.onSolve.unlockRooms ?? []) {
            if (!this.state.gates[g.id]) gated.add(rid);
          }
        }
        return repo.roomList.filter((r) => r.act <= 1 && !gated.has(r.id)).map((r) => r.id);
      },
      [this.gates$]
    );
  }

  /** Nested clues (found via close-up reveals) don't count in the HUD total. */
  private isNestedOnly(clue: Clue): boolean {
    return clue.spot === null;
  }

  /* ------------------------------------------------ state lifecycle */

  async boot(): Promise<'fresh' | 'resumed'> {
    await this.save.init();
    const loaded = await this.save.load();
    if (loaded) {
      this.state = migrateState(loaded);
      return 'resumed';
    }
    return 'fresh';
  }

  /** Push observable snapshots from the (possibly imported) state. */
  publishAll(): void {
    this.phase$.value = this.state.phase;
    this.roomId$.value = this.state.roomId;
    this.clues$.value = { ...this.state.clues };
    this.flags$.value = { ...this.state.flags };
    this.vars$.value = { ...this.state.vars };
    this.gates$.value = { ...this.state.gates };
    this.settings$.value = { ...this.state.settings };
    this.applySettings();
  }

  private commit(): void {
    this.save.queueSave(this.state);
  }

  /* ------------------------------------------------ progress intents */

  startPrologue(): void {
    this.state.phase = 'prologue';
    this.state.prologuePage = 0;
    this.phase$.value = 'prologue';
    this.commit();
  }

  setProloguePage(i: number): void {
    this.state.prologuePage = Math.max(0, i);
    this.commit();
  }

  finishPrologue(): void {
    this.state.prologueDone = true;
    this.state.phase = 'hub';
    this.phase$.value = 'hub';
    this.bus.emit('dialogue:play', { dialogueId: 'hollis_intro' });
    this.commit();
  }

  enterRoom(roomId: string): void {
    const room = this.repo.room(roomId);
    if (!room) return;
    this.state.phase = 'room';
    this.state.roomId = roomId;
    this.roomId$.value = roomId;
    this.phase$.value = 'room';
    this.bus.emit('room:enter', { roomId });
    this.commit();
  }

  gotoHub(): void {
    this.state.phase = 'hub';
    this.state.roomId = null;
    this.roomId$.value = null;
    this.phase$.value = 'hub';
    this.commit();
  }

  collectClue(id: string): boolean {
    if (this.state.clues[id]) return false;
    const clue = this.repo.clue(id);
    if (!clue) return false;
    this.state.clues[id] = { at: Date.now() };
    this.clues$.value = { ...this.state.clues };
    this.bus.emit('clue:collected', { id, name: clue.name, room: clue.room });
    this.toast(`New clue: ${clue.name}`, 'clue');
    this.maybeOfferGates();
    this.commit();
    return true;
  }

  hasClue(id: string): boolean {
    return Boolean(this.state.clues[id]);
  }

  setFlag(flag: string, value = true): void {
    if (this.state.flags[flag] === value) return;
    this.state.flags[flag] = value;
    this.flags$.value = { ...this.state.flags };
    this.commit();
  }

  flag(flag: string): boolean {
    return Boolean(this.state.flags[flag]);
  }

  /* ------------------------------------------ dialogue context (DialogueContext) */

  hasFlag(id: string): boolean {
    return this.flag(id);
  }

  getVar(id: string): number {
    return this.state.vars[id] ?? 0;
  }

  /** Additive variable update (trust shifts etc.). */
  addVar(id: string, delta: number): void {
    const next = this.getVar(id) + delta;
    if (next === this.getVar(id)) return;
    this.state.vars[id] = next;
    this.vars$.value = { ...this.state.vars };
    this.commit();
  }

  foundClueIds(): string[] {
    return Object.keys(this.state.clues);
  }

  /** Apply a dialogue effect block through the real progression intents. */
  applyEffects(effects: DialogueEffects): void {
    for (const f of effects.setFlags ?? []) this.setFlag(f);
    for (const [id, delta] of Object.entries(effects.setVars ?? {})) this.addVar(id, delta);
    for (const id of effects.addClues ?? []) this.collectClue(id);
  }

  /** Bearing label key for a suspect's trust variable (0 default). */
  bearingKey(suspectId: string): string {
    const v = this.getVar(`trust:${suspectId}`);
    if (v <= -1) return '@dlg.bearing.icy';
    if (v >= 2) return '@dlg.bearing.open';
    if (v >= 1) return '@dlg.bearing.warming';
    return '@dlg.bearing.guarded';
  }

  /** True when any conversation with this suspect has happened (talked:* flags). */
  hasTalkedTo(suspectId: string): boolean {
    const prefix = `talked:${suspectId}:`;
    return Object.keys(this.state.flags).some((f) => f.startsWith(prefix));
  }

  solveGate(gateId: string): void {
    const gate = this.repo.gate(gateId);
    if (!gate || this.state.gates[gateId]) return;
    this.state.gates[gateId] = true;
    this.gates$.value = { ...this.state.gates };
    for (const f of gate.onSolve.flags ?? []) this.state.flags[f] = true;
    this.flags$.value = { ...this.state.flags };
    this.bus.emit('gate:solved', { gateId });
    this.toast('Deduction accepted. The case moves.', 'info');
    if (gate.onSolve.dialogue) {
      this.bus.emit('dialogue:play', { dialogueId: gate.onSolve.dialogue });
    }
    if (gate.onSolve.endCard) {
      this.bus.emit('endcard:show', { cardId: gate.onSolve.endCard });
    }
    this.commit();
  }

  markGateOffered(gateId: string): void {
    this.sessionDismissed.add(gateId);
  }

  gateOffered(gateId: string): boolean {
    return this.sessionDismissed.has(gateId);
  }

  /** Gates whose evidence is complete and that no door will offer: nudge (once each). */
  private maybeOfferGates(): void {
    for (const gate of this.repo.gates()) {
      if (this.state.gates[gate.id] || this.gateNotified.has(gate.id)) continue;
      const ready = gate.requiresClues.every((id) => this.state.clues[id]);
      if (!ready || this.gateOffered(gate.id)) continue;
      this.gateNotified.add(gate.id);
      this.toast('You have enough to make a deduction. Try the door.', 'info');
    }
  }

  gateReady(gateId: string): boolean {
    const gate = this.repo.gate(gateId);
    if (!gate) return false;
    return gate.requiresClues.every((id) => this.state.clues[id]) && !this.state.gates[gateId];
  }

  addHintUse(context: string): void {
    this.state.hintsUsed[context] = (this.state.hintsUsed[context] ?? 0) + 1;
    this.commit();
  }

  /* ------------------------------------------------ toasts */

  toast(text: string, kind: Toast['kind'] = 'info'): void {
    const list = this.toasts$.value.slice();
    // de-duplicate: never stack identical messages
    if (list.some((t) => t.text === text)) return;
    const item: Toast = { id: ++this.toastId, text, kind };
    list.push(item);
    while (list.length > 2) list.shift(); // keep at most two visible
    this.toasts$.value = list;
    setTimeout(() => {
      this.toasts$.value = this.toasts$.value.filter((t) => t.id !== item.id);
    }, 3000);
  }

  /* ------------------------------------------------ settings */

  updateSettings(patch: Partial<Settings>): void {
    this.state.settings = { ...this.state.settings, ...patch };
    this.settings$.value = { ...this.state.settings };
    this.applySettings();
    this.bus.emit('settings:changed', { key: Object.keys(patch).join(',') });
    this.commit();
  }

  applySettings(): void {
    const s = this.state.settings;
    const root = document.documentElement;
    const sizes = ['15px', '17px', '19px'];
    root.style.setProperty('--fs', sizes[s.textSize]);
    root.dataset.accent = s.accent;
  }
}
