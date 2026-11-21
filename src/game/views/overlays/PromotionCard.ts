/**
 * PromotionCard -- the commendation ceremony. Shown once per promotion, when
 * the player walks back into the precinct after closing the case that crossed
 * a rank threshold. Ceremony lines come from world.json career.ceremony; the
 * rank block from career.ranks.
 */

import { el } from '../../core/dom';
import type { CareerRank } from '../../data/types';
import type { GameVM } from '../../viewmodels/GameVM';

export class PromotionCard {
  readonly node: HTMLElement;

  constructor(vm: GameVM, rank: CareerRank, private onDone: () => void) {
    const career = vm.world.world.career;
    const det = vm.world.world.detective;
    const solved = vm.solvedCount();
    const next = vm.nextRank();

    this.node = el('div', { class: 'overlay promotion-overlay' });
    const card = el('div', { class: 'promotion-card' });

    card.append(el('div', { class: 'promotion-seal', text: 'OLD TOWN PRECINCT -- COMMENDATION' }));
    card.append(el('h2', { class: 'promotion-title', text: rank.title }));
    card.append(el('div', { class: 'promotion-sub', text: `The rank of ${rank.title} is conferred on Detective ${det.name}, badge ${det.badge}, for ${solved} case${solved === 1 ? '' : 's'} closed clean.` }));

    const lines = el('div', { class: 'promotion-lines' });
    for (const line of career.ceremony ?? []) lines.append(el('p', { class: 'promotion-line', text: line }));
    card.append(lines);

    const note = el('div', { class: 'promotion-note' });
    note.append(
      el('div', { class: 'promotion-note-head', text: `WHAT ${rank.title.toUpperCase()} CARRIES` }),
      el('p', { class: 'promotion-note-line', text: rank.note ?? 'The desk is the same. The name on it weighs more.' })
    );
    if (next) {
      note.append(
        el('div', { class: 'promotion-note-head', text: 'NEXT' }),
        el('p', { class: 'promotion-note-line', text: `${next.title} at ${next.after} closed -- ${solved} down, ${next.after - solved} to go.` })
      );
    } else {
      note.append(el('div', { class: 'promotion-note-head', text: 'NEXT' }), el('p', { class: 'promotion-note-line', text: 'Nothing. You are at the top of the ladder, and the ladder knows it.' }));
    }
    card.append(note);

    card.append(
      el('button', {
        class: 'btn btn-primary',
        text: 'Take the floor, Detective',
        onclick: () => {
          this.node.remove();
          this.onDone();
        },
      })
    );
    this.node.append(card);
  }
}
