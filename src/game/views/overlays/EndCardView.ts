/**
 * EndCardView -- the end-of-build storybook card shown after the final Act 1
 * deduction. Summarises progress and confirms the autosave.
 */

import { el } from '../../core/dom';
import type { GameVM } from '../../viewmodels/GameVM';

export class EndCardView {
  readonly node: HTMLElement;
  private vm: GameVM;

  constructor(vm: GameVM, private onClose: () => void) {
    this.vm = vm;
    this.node = el('div', { class: 'overlay endcard-overlay hidden' });
  }

  show(): void {
    this.node.innerHTML = '';
    const cp = this.vm.cp;
    const found = Object.keys(cp.clues).length;
    const hints = Object.values(cp.hintsUsed).reduce((a, b) => a + b, 0);
    const gates = Object.keys(cp.gates).length;

    const card = el('div', { class: 'endcard' });
    const solvedCount = this.vm.solvedCount();
    const next = this.vm.nextRank();
    card.append(
      el('div', { class: 'endcard-rule' }),
      el('div', { class: 'endcard-kicker', text: 'CASE CLOSED' }),
      el('h2', { class: 'endcard-title', text: 'The file is closed' }),
      el('p', { class: 'endcard-body', text: 'You named the poison, the vessel and the door -- the parlour has told its story. Sergeant Hollis pins your deductions to the board and looks, for the first time, less like a man doubting and more like a man counting.' }),
      el('p', { class: 'endcard-body', text: 'Act 2 opens the kitchen, the ground hallway and the stairs: where the household moved, and where a door stood off its bolt for twenty-one minutes.' }),
      el('div', { class: 'endcard-stats' }, [
        el('div', { class: 'stat' }, [el('span', { class: 'stat-n', text: String(found) }), el('span', { class: 'stat-l', text: 'clues sketched' })]),
        el('div', { class: 'stat' }, [el('span', { class: 'stat-n', text: String(gates) }), el('span', { class: 'stat-l', text: 'deductions held' })]),
        el('div', { class: 'stat' }, [el('span', { class: 'stat-n', text: String(hints) }), el('span', { class: 'stat-l', text: 'thoughts spent' })]),
      ]),
      el('p', { class: 'endcard-body endcard-count', text: `The count stands at ${solvedCount} closed${next ? ` -- ${next.title} waits at ${next.after}.` : '.'} Take it back to the precinct; the Captain will want it read aloud.` }),
      el('div', { class: 'endcard-save', text: 'Progress is autosaved -- your notebook travels with you.' }),
      el('button', { class: 'btn btn-primary', text: 'Take it back to the precinct', onclick: () => { this.close(); this.onClose(); } }),
      el('div', { class: 'endcard-rule' })
    );
    this.node.append(card);
    this.node.classList.remove('hidden');
  }

  close(): void {
    this.node.classList.add('hidden');
  }
}
