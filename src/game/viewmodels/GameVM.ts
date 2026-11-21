/**
 * GameVM -- the root View Model. Owns the persistent GameState, exposes
 * observable slices for the views, and routes every intent (collect clue,
 * solve gate, change settings, take a case, walk the precinct...) through
 * methods that mutate state and queue an autosave. Views never touch
 * GameState directly.
 *
 * Progression is split by scope:
 *  - per-case progress lives in state.cases[activeCaseId] (the folder);
 *  - precinct/world progress (station NPC memory) lives in state.station.
 * The active case's ContentRepository can be swapped when the player picks
 * another folder -- that is what makes the world expandable, data-driven.
 */

import { Computed, Observable } from '../core/Observable';
import { EventBus } from '../core/EventBus';
import { ContentRepository, WorldRepository } from '../data/ContentRepository';
import type { CaseProgress, Clue, GameState, Room, Settings } from '../data/types';
import { freshCaseProgress, freshState, migrateState } from '../data/types';
import type { DialogueContext, DialogueEffects } from '../dialogue/types';
import { SaveSystem } from '../save/SaveSystem';

export interface Toast {
  id: number;
  text: string;
  kind: 'clue' | 'info' | 'warn';
}

export type DeskStatus = 'unsolved' | 'in-progress' | 'solved' | 'offline';

export class GameVM implements DialogueContext {
  readonly bus = new EventBus();
  readonly save: SaveSystem;
  readonly world: WorldRepository;

  /** Which progression scope dialogue effects currently write to. */
  dialogueScope: 'case' | 'world' = 'case';

  readonly phase$: Observable<GameState['phase'] | 'boot'>;
  readonly stationLevel$: Observable<GameState['stationLevel']>;
  readonly activeCase$: Observable<string | null>;
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
  private _repo: ContentRepository;
  private toastId = 0;
  private sessionDismissed = new Set<string>();
  private gateNotified = new Set<string>();

  constructor(repo: ContentRepository, world: WorldRepository) {
    this._repo = repo;
    this.world = world;
    this.save = new SaveSystem(() => {
      this.saveFlash$.value = Date.now();
    });
    this.phase$ = new Observable<GameState['phase'] | 'boot'>('boot');
    this.stationLevel$ = new Observable<GameState['stationLevel']>('exterior');
    this.activeCase$ = new Observable<string | null>(this.state.activeCaseId);
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
        const cp = this.cpOrNull();
        const total = repo.bundle.clues.filter((c) => !this.isNestedOnly(c)).length;
        const found = cp
          ? Object.keys(cp.clues).filter((id) => {
              const c = repo.clue(id);
              return c && !this.isNestedOnly(c);
            }).length
          : 0;
        return `${found} / ${total}`;
      },
      [this.clues$]
    );
    this.unlockedRooms$ = new Computed<string[]>(
      () => {
        // A room is unlocked when its act has shipped AND no unsolved gate
        // lists it as a reward (data-driven lock, no hard-coded ids).
        const cp = this.cpOrNull();
        const gated = new Set<string>();
        for (const g of repo.gates()) {
          for (const rid of g.onSolve.unlockRooms ?? []) {
            if (!cp?.gates[g.id]) gated.add(rid);
          }
        }
        return repo.roomList.filter((r) => r.act <= 1 && !gated.has(r.id)).map((r) => r.id);
      },
      [this.gates$]
    );
  }

  /** The active case repository (swapped when the player takes another folder). */
  get repo(): ContentRepository {
    return this._repo;
  }

  /* ------------------------------------------------ per-case progress */

  /** Nested clues (found via close-up reveals) don't count in the HUD total. */
  private isNestedOnly(clue: Clue): boolean {
    return clue.spot === null;
  }

  /** Progress record for the active case (created on demand). */
  get cp(): CaseProgress {
    const id = this.state.activeCaseId;
    if (!id) throw new Error('No active case -- station code must not read case progress');
    return this.ensureCase(id);
  }

  cpOrNull(): CaseProgress | null {
    const id = this.state.activeCaseId;
    return id ? this.ensureCase(id) : null;
  }

  ensureCase(id: string): CaseProgress {
    if (!this.state.cases[id]) this.state.cases[id] = freshCaseProgress();
    return this.state.cases[id];
  }

  /** Desk badge for a folder, derived from data + save (never hard-coded). */
  caseStatusFor(id: string): DeskStatus {
    const meta = this.world.case(id);
    const cp = this.state.cases[id];
    if (meta && meta.status !== 'available') return 'offline';
    if (!cp) return 'unsolved';
    if (cp.solved) return 'solved';
    const touched =
      Object.keys(cp.clues).length > 0 ||
      Object.keys(cp.gates).length > 0 ||
      Object.keys(cp.flags).length > 0 ||
      cp.prologueDone ||
      cp.prologuePage > 0;
    return touched ? 'in-progress' : 'unsolved';
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

  /** Swap in the repository for another case (the world-expansion seam). */
  attachRepo(repo: ContentRepository): void {
    this._repo = repo;
    this.bus.emit('case:loaded', { caseId: repo.caseId });
  }

  /** Push observable snapshots from the (possibly imported) state. */
  publishAll(): void {
    this.phase$.value = this.state.phase;
    this.stationLevel$.value = this.state.stationLevel;
    this.activeCase$.value = this.state.activeCaseId;
    this.roomId$.value = this.state.roomId ?? null;
    const cp = this.cpOrNull();
    this.clues$.value = { ...(cp?.clues ?? {}) };
    this.flags$.value = { ...(cp?.flags ?? {}) };
    this.vars$.value = { ...(cp?.vars ?? {}) };
    this.gates$.value = { ...(cp?.gates ?? {}) };
    this.settings$.value = { ...this.state.settings };
    this.applySettings();
  }

  private commit(): void {
    this.save.queueSave(this.state);
  }

  /* ------------------------------------------------ precinct intents */

  /** Fresh game: step out of the title card into the precinct street. */
  beginNightShift(): void {
    this.state.phase = 'station';
    this.state.stationLevel = 'exterior';
    this.stationLevel$.value = 'exterior';
    this.phase$.value = 'station';
    this.commit();
  }

  markIntroSeen(): void {
    if (this.state.introSeen) return;
    this.state.introSeen = true;
    this.commit();
  }

  setStationLevel(level: GameState['stationLevel']): void {
    if (this.state.stationLevel === level) return;
    this.state.stationLevel = level;
    this.stationLevel$.value = level;
    this.commit();
  }

  /** Leave the house mid-case and walk back to the precinct. */
  gotoStation(): void {
    const cp = this.cpOrNull();
    if (cp && this.state.phase !== 'station') {
      cp.phase = this.state.phase as CaseProgress['phase'];
      cp.roomId = this.state.roomId ?? null;
    }
    this.state.phase = 'station';
    this.state.stationLevel = 'interior';
    this.stationLevel$.value = 'interior';
    this.phase$.value = 'station';
    this.commit();
  }

  /* ------------------------------------------------ case intents */

  /**
   * Take (or resume) a folder from the desk: load its bundle if needed,
   * activate its progress record and enter it at the right place.
   */
  async selectCase(id: string): Promise<void> {
    const meta = this.world.case(id);
    if (!meta || meta.status !== 'available') return;
    if (this._repo.caseId !== id) {
      const repo = await ContentRepository.loadCase(id, this.world.locale);
      this.attachRepo(repo);
    }
    const cp = this.ensureCase(id);
    this.state.activeCaseId = id;
    this.activeCase$.value = id;
    // World-scope memory: the precinct knows the detective has a case now.
    this.state.station.flags['case:taken'] = true;

    const untouched =
      !cp.prologueDone && cp.prologuePage === 0 && Object.keys(cp.clues).length === 0 && Object.keys(cp.flags).length === 0;
    if (untouched) {
      cp.phase = 'prologue';
      cp.prologuePage = 0;
    }
    this.state.phase = cp.phase;
    this.state.roomId = cp.roomId;
    this.roomId$.value = cp.roomId;
    this.phase$.value = cp.phase;
    this.publishAll();
    this.commit();
  }

  /** The accusation end-card only appears for a gate flagged as the case finale. */
  markCaseSolved(): void {
    const cp = this.cpOrNull();
    if (!cp || cp.solved) return;
    cp.solved = true;
    this.commit();
  }

  /* ------------------------------------------------ case-side progress intents */

  startPrologue(): void {
    const cp = this.cp;
    cp.phase = 'prologue';
    cp.prologuePage = 0;
    this.state.phase = 'prologue';
    this.phase$.value = 'prologue';
    this.commit();
  }

  setProloguePage(i: number): void {
    this.cp.prologuePage = Math.max(0, i);
    this.commit();
  }

  finishPrologue(): void {
    const cp = this.cp;
    cp.prologueDone = true;
    cp.phase = 'hub';
    this.state.phase = 'hub';
    this.phase$.value = 'hub';
    this.bus.emit('dialogue:play', { dialogueId: 'hollis_intro' });
    this.commit();
  }

  enterRoom(roomId: string): void {
    const room = this.repo.room(roomId);
    if (!room) return;
    const cp = this.cp;
    cp.phase = 'room';
    cp.roomId = roomId;
    this.state.phase = 'room';
    this.state.roomId = roomId;
    this.roomId$.value = roomId;
    this.phase$.value = 'room';
    this.bus.emit('room:enter', { roomId });
    this.commit();
  }

  gotoHub(): void {
    const cp = this.cp;
    cp.phase = 'hub';
    cp.roomId = null;
    this.state.phase = 'hub';
    this.state.roomId = null;
    this.roomId$.value = null;
    this.phase$.value = 'hub';
    this.commit();
  }

  collectClue(id: string): boolean {
    if (this.cp.clues[id]) return false;
    const clue = this.repo.clue(id);
    if (!clue) return false;
    this.cp.clues[id] = { at: Date.now() };
    this.clues$.value = { ...this.cp.clues };
    this.bus.emit('clue:collected', { id, name: clue.name, room: clue.room });
    this.toast(`New clue: ${clue.name}`, 'clue');
    this.maybeOfferGates();
    this.commit();
    return true;
  }

  hasClue(id: string): boolean {
    return Boolean(this.cpOrNull()?.clues[id]);
  }

  /** Case-scope flag write (gates, dialogue inside a case). */
  setFlag(flag: string, value = true): void {
    const cp = this.cp;
    if (cp.flags[flag] === value) return;
    cp.flags[flag] = value;
    this.flags$.value = { ...cp.flags };
    this.commit();
  }

  /** World-scope flag write (precinct NPC memory, survives case switches). */
  setWorldFlag(flag: string, value = true): void {
    if (this.state.station.flags[flag] === value) return;
    this.state.station.flags[flag] = value;
    this.commit();
  }

  flag(flag: string): boolean {
    return this.hasFlag(flag);
  }

  /* ------------------------------------------ dialogue context (DialogueContext) */

  /** Scope-aware: world graphs read station memory, case graphs read the folder. */
  hasFlag(id: string): boolean {
    if (this.dialogueScope === 'world') return Boolean(this.state.station.flags[id]);
    return Boolean(this.cp.flags[id]);
  }

  getVar(id: string): number {
    if (this.dialogueScope === 'world') return this.state.station.vars[id] ?? 0;
    return this.cp.vars[id] ?? 0;
  }

  /** Additive variable update (trust shifts etc.). */
  addVar(id: string, delta: number): void {
    const next = this.getVar(id) + delta;
    if (next === this.getVar(id)) return;
    if (this.dialogueScope === 'world') {
      this.state.station.vars[id] = next;
    } else {
      this.cp.vars[id] = next;
      this.vars$.value = { ...this.cp.vars };
    }
    this.commit();
  }

  foundClueIds(): string[] {
    return Object.keys(this.cpOrNull()?.clues ?? {});
  }

  /** Apply a dialogue effect block through the real progression intents. */
  applyEffects(effects: DialogueEffects): void {
    const worldScope = this.dialogueScope === 'world';
    for (const f of effects.setFlags ?? []) {
      if (worldScope) this.setWorldFlag(f);
      else this.setFlag(f);
    }
    for (const [id, delta] of Object.entries(effects.setVars ?? {})) this.addVar(id, delta);
    if (!worldScope) for (const id of effects.addClues ?? []) this.collectClue(id);
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
    return (
      Object.keys(this.cpOrNull()?.flags ?? {}).some((f) => f.startsWith(prefix)) ||
      Object.keys(this.state.station.flags).some((f) => f.startsWith(prefix))
    );
  }

  solveGate(gateId: string): void {
    const gate = this.repo.gate(gateId);
    const cp = this.cp;
    if (!gate || cp.gates[gateId]) return;
    cp.gates[gateId] = true;
    this.gates$.value = { ...cp.gates };
    for (const f of gate.onSolve.flags ?? []) cp.flags[f] = true;
    this.flags$.value = { ...cp.flags };
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
    const cp = this.cp;
    for (const gate of this.repo.gates()) {
      if (cp.gates[gate.id] || this.gateNotified.has(gate.id)) continue;
      const ready = gate.requiresClues.every((id) => cp.clues[id]);
      if (!ready || this.gateOffered(gate.id)) continue;
      this.gateNotified.add(gate.id);
      this.toast('You have enough to make a deduction. Try the door.', 'info');
    }
  }

  gateReady(gateId: string): boolean {
    const gate = this.repo.gate(gateId);
    if (!gate) return false;
    return gate.requiresClues.every((id) => this.cp.clues[id]) && !this.cp.gates[gateId];
  }

  addHintUse(context: string): void {
    const cp = this.cp;
    cp.hintsUsed[context] = (cp.hintsUsed[context] ?? 0) + 1;
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

/* Re-exported so views importing types from GameVM keep compiling. */
export type { CaseProgress, Clue, Room };
