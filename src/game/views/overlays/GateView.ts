/**
 * GateView -- a deduction gate: fill-in-the-sentence puzzle rendered on a
 * ledger page. Chips are tapped into slots (mobile-friendly); validation is
 * shape+color coded for colour-blind safety (filled-circle-ok / open-x-bad).
 */

import { el } from '../../core/dom';
import type { GameVM } from '../../viewmodels/GameVM';
import { GateVM } from '../../viewmodels/GateVM';
import type { HintVM } from '../../viewmodels/HintVM';

export class GateView {
  readonly node: HTMLElement;
  private vm: GameVM;
  private gateVM: GateVM | null = null;
  private hintVM: HintVM;
  private body: HTMLElement;
  private onDismissed: () => void = () => {};

  constructor(vm: GameVM, hintVM: HintVM) {
    this.vm = vm;
    this.hintVM = hintVM;
    this.node = el('div', { class: 'overlay gate-overlay hidden' });
    const card = el('div', { class: 'gate-card' });
    const head = el('div', { class: 'gate-head' });
    head.append(el('div', { class: 'gate-kicker', text: 'DEDUCTION' }), el('h2', { class: 'gate-title' }));
    const prompt = el('p', { class: 'gate-prompt' });
    this.body = el('div', { class: 'gate-body' });
    const foot = el('div', { class: 'gate-foot' });
    const check = el('button', {
      class: 'btn btn-primary',
      text: 'Check the deduction',
      onclick: () => {
        this.gateVM?.check();
        this.render();
      },
    });
    const think = el('button', { class: 'btn', text: 'Think', onclick: () => { if (this.gateVM) this.hintVM.show(this.gateVM.gate.id); } });
    const later = el('button', {
      class: 'btn btn-quiet',
      text: 'Return to it later',
      onclick: () => {
        if (this.gateVM) this.vm.markGateOffered(this.gateVM.gate.id);
        this.close();
        this.onDismissed();
      },
    });
    foot.append(later, think, check);
    card.append(head, prompt, this.body, foot);
    this.node.append(card);
  }

  /** Returns a promise resolved when the player dismisses without solving. */
  open(gateId: string): void {
    const gate = this.vm.repo.gate(gateId);
    if (!gate) return;
    this.gateVM = new GateVM(this.vm, gate);
    (this.node.querySelector('.gate-title') as HTMLElement).textContent = gate.title;
    (this.node.querySelector('.gate-prompt') as HTMLElement).textContent = gate.prompt;
    this.node.classList.remove('hidden');
    this.render();
  }

  onDismiss(cb: () => void): void {
    this.onDismissed = cb;
  }

  close(): void {
    this.node.classList.add('hidden');
    this.gateVM = null;
  }

  private render(): void {
    const gvm = this.gateVM;
    if (!gvm) return;
    this.body.innerHTML = '';

    const missing = gvm.missingClues$.value;
    if (missing.length > 0) {
      this.body.append(
        el('p', { class: 'gate-missing', text: `Before you write, find: ${missing.join(', ')}.` })
      );
    }

    // Slots
    const slotsEl = el('div', { class: 'gate-slots' });
    gvm.gate.slots.forEach((slot, i) => {
      slotsEl.append(this.slotRow(gvm, slot.before, slot.after ?? '', i));
    });
    this.body.append(slotsEl);

    // Chip pool
    const pool = el('div', { class: 'gate-pool' });
    for (const chip of gvm.chips$.value) {
      if (chip.usedIn !== null) continue;
      pool.append(el('button', {
        class: 'chip',
        text: chip.text,
        onclick: () => {
          gvm.placeChip(chip.key);
          this.render();
        },
      }));
    }
    this.body.append(el('div', { class: 'gate-pool-label', text: 'Tap a phrase to place it' }), pool);

    // Solution banner when solved
    if (gvm.solved$.value) {
      this.body.append(
        el('div', { class: 'gate-solved' }, [
          el('div', { class: 'gate-solved-seal', text: '\u2713' }),
          el('p', { class: 'gate-solved-text', text: 'The deduction holds. The case moves forward.' }),
          el('button', { class: 'btn btn-primary', text: 'Continue', onclick: () => this.close() }),
        ])
      );
    }
  }

  private slotRow(gvm: GateVM, before: string, after: string, index: number): HTMLElement {
    const placed = gvm.placed$.value[index];
    const state = gvm.slotStates$.value[index];
    const row = el('div', { class: `gate-slot-row state-${state}` });
    const line = el('div', { class: 'gate-slot-line' });
    line.append(el('span', { class: 'gate-slot-before', text: before + ' ' }));
    line.append(
      el('button', {
        class: `gate-slot${placed ? ' filled' : ''}`,
        text: placed ?? '\u2192',
        onclick: () => {
          if (placed) {
            gvm.clearSlot(index);
            this.render();
          }
        },
      })
    );
    if (after) line.append(el('span', { class: 'gate-slot-after', text: ' ' + after }));
    row.append(line);
    if (state === 'ok') row.append(el('span', { class: 'gate-mark ok', text: '\u25CF' }));
    if (state === 'bad') row.append(el('span', { class: 'gate-mark bad', text: '\u2715' }));
    return row;
  }
}
