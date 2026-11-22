/**
 * EndCardView -- the storybook card shown after an act-closing or case-closing
 * deduction. Fully data-driven: cards live in the case bundle's endCards.json
 * (selected by gate.onSolve.endCard); only a `finale` card closes the folder.
 */

import { el } from '../../core/dom';
import type { GameVM } from '../../viewmodels/GameVM';

export class EndCardView {
  readonly node: HTMLElement;
  private vm: GameVM;
  private closeTo: 'hub' | 'station' = 'station';

  constructor(vm: GameVM, private onClose: (closeTo: 'hub' | 'station') => void) {
    this.vm = vm;
    this.node = el('div', { class: 'overlay endcard-overlay hidden' });
  }

  show(cardId?: string): void {
    this.node.innerHTML = '';
    const cp = this.vm.cp;
    const found = Object.keys(cp.clues).length;
    const hints = Object.values(cp.hintsUsed).reduce((a, b) => a + b, 0);
    const gates = Object.keys(cp.gates).length;

    // The authored card, with a last-resort fallback so a bad id never blanks the screen.
    const card = (cardId && this.vm.repo.endCard(cardId)) || {
      kicker: 'CASE CLOSED',
      title: 'The file is closed',
      body: ['You named the poison, the vessel and the door -- the parlour has told its story.'],
      button: 'Take it back to the precinct',
      closeTo: 'station' as const,
      finale: true,
    };
    this.closeTo = card.closeTo;

    const cardEl = el('div', { class: 'endcard' });
    cardEl.append(
      el('div', { class: 'endcard-rule' }),
      el('div', { class: 'endcard-kicker', text: card.kicker }),
      el('h2', { class: 'endcard-title', text: card.title })
    );
    for (const line of card.body) cardEl.append(el('p', { class: 'endcard-body', text: line }));

    cardEl.append(
      el('div', { class: 'endcard-stats' }, [
        el('div', { class: 'stat' }, [el('span', { class: 'stat-n', text: String(found) }), el('span', { class: 'stat-l', text: 'clues sketched' })]),
        el('div', { class: 'stat' }, [el('span', { class: 'stat-n', text: String(gates) }), el('span', { class: 'stat-l', text: 'deductions held' })]),
        el('div', { class: 'stat' }, [el('span', { class: 'stat-n', text: String(hints) }), el('span', { class: 'stat-l', text: 'thoughts spent' })]),
      ])
    );

    if (card.finale) {
      // A closed folder earns the precinct count and the captain's reading.
      const solvedCount = this.vm.solvedCount();
      const next = this.vm.nextRank();
      cardEl.append(
        el('p', {
          class: 'endcard-body endcard-count',
          text: `The count stands at ${solvedCount} closed${next ? ` -- ${next.title} waits at ${next.after}.` : '.'} Take it back to the precinct; the Captain will want it read aloud.`,
        })
      );
    }

    cardEl.append(
      el('div', { class: 'endcard-save', text: 'Progress is autosaved -- your notebook travels with you.' }),
      el('button', { class: 'btn btn-primary', text: card.button, onclick: () => { this.close(); this.onClose(this.closeTo); } }),
      el('div', { class: 'endcard-rule' })
    );
    this.node.append(cardEl);
    this.node.classList.remove('hidden');
  }

  close(): void {
    this.node.classList.add('hidden');
  }
}
