/**
 * GateVM -- the deduction engine for one fill-in-the-sentence gate.
 *
 * Rules live entirely in JSON (gates.json): each slot has an answer plus a
 * chip pool (correct chip + distractors). The VM tracks chip placement and
 * validates against the JSON answers; there is no penalty for wrong tries.
 */

import { Observable } from '../core/Observable';
import { shuffled } from '../core/dom';
import type { Gate } from '../data/types';
import type { GameVM } from './GameVM';

export interface Chip {
  key: number;
  text: string;
  usedIn: number | null; // slot index or null
}

export type SlotState = 'empty' | 'filled' | 'ok' | 'bad';

export class GateVM {
  readonly gate: Gate;
  readonly chips$: Observable<Chip[]>;
  readonly placed$: Observable<Array<string | null>>;
  readonly slotStates$: Observable<SlotState[]>;
  readonly solved$: Observable<boolean>;
  readonly checked$: Observable<boolean>;
  readonly missingClues$: Observable<string[]>;

  private nextChipKey = 1;

  constructor(private game: GameVM, gate: Gate) {
    this.gate = gate;
    const pool: Chip[] = shuffled(
      gate.slots.flatMap((s) => s.chips),
      gate.id.length * 7919 + 13
    ).map((text) => ({ key: this.nextChipKey++, text, usedIn: null }));
    this.chips$ = new Observable<Chip[]>(pool);
    this.placed$ = new Observable<Array<string | null>>(gate.slots.map(() => null));
    this.slotStates$ = new Observable<SlotState[]>(gate.slots.map(() => 'empty'));
    this.solved$ = new Observable<boolean>(game.gates$.value[gate.id] === true);
    this.checked$ = new Observable<boolean>(false);
    this.missingClues$ = new Observable<string[]>(
      gate.requiresClues
        .filter((id) => !game.hasClue(id))
        .map((id) => game.repo.clue(id)?.name ?? id)
    );
  }

  /** Place a chip into a slot (or into the first empty slot; if none, swap into the first filled slot). */
  placeChip(chipKey: number, slotIndex?: number): void {
    const chips = this.chips$.value.map((c) => ({ ...c }));
    const chip = chips.find((c) => c.key === chipKey);
    if (!chip) return;
    const placed = this.placed$.value.slice();
    let target = slotIndex ?? placed.findIndex((p) => p === null);
    if (target < 0) target = placed.findIndex((p) => p !== null); // no empty slot: replace first filled
    if (target < 0) return;
    // Vacate wherever this chip (and the displaced chip) used to sit.
    for (const c of chips) {
      if (c.key === chipKey || c.usedIn === target) c.usedIn = null;
    }
    const prev = placed.indexOf(chip.text);
    if (prev >= 0) placed[prev] = null;
    placed[target] = chip.text;
    chip.usedIn = target;
    this.chips$.value = chips;
    this.placed$.value = placed;
    this.checked$.value = false;
    this.slotStates$.value = this.gate.slots.map((_, i) => (placed[i] ? 'filled' : 'empty'));
  }

  /** Remove a chip from a slot back into the pool. */
  clearSlot(slotIndex: number): void {
    const placed = this.placed$.value.slice();
    placed[slotIndex] = null;
    this.placed$.value = placed;
    const chips = this.chips$.value.map((c) => ({ ...c }));
    const chip = chips.find((c) => c.usedIn === slotIndex);
    if (chip) chip.usedIn = null; // return it to the pool
    this.chips$.value = chips;
    this.checked$.value = false;
    this.slotStates$.value = this.gate.slots.map((_, i) => (placed[i] ? 'filled' : 'empty'));
  }

  /** Validate against the JSON answers; no penalty, shapes+colors are CB-safe. */
  check(): void {
    const placed = this.placed$.value;
    const states: SlotState[] = this.gate.slots.map((slot, i) => {
      if (!placed[i]) return 'empty';
      return placed[i] === slot.answer ? 'ok' : 'bad';
    });
    this.slotStates$.value = states;
    this.checked$.value = true;
    if (states.every((s) => s === 'ok')) {
      this.solved$.value = true;
      this.game.solveGate(this.gate.id);
    } else {
      this.game.toast('Some links are wrong. Rearrange, or Think.', 'warn');
    }
  }

  reset(): void {
    const pool: Chip[] = shuffled(
      this.gate.slots.flatMap((s) => s.chips),
      this.gate.id.length * 104729 + 7
    ).map((text) => ({ key: this.nextChipKey++, text, usedIn: null }));
    this.chips$.value = pool;
    this.placed$.value = this.gate.slots.map(() => null);
    this.slotStates$.value = this.gate.slots.map(() => 'empty');
    this.checked$.value = false;
  }
}
