/**
 * HintView -- the three-tier "Think" panel: nudge, stronger nudge, near-answer.
 */

import { el } from '../../core/dom';
import type { HintVM } from '../../viewmodels/HintVM';

export class HintView {
  readonly node: HTMLElement;
  private textEl: HTMLElement;
  private tierEl: HTMLElement;
  private strongerBtn: HTMLButtonElement;

  constructor(private vm: HintVM) {
    this.node = el('div', { class: 'overlay hint-overlay hidden' });
    const card = el('div', { class: 'hint-card' });
    this.tierEl = el('div', { class: 'hint-tier' });
    this.textEl = el('p', { class: 'hint-text' });
    this.strongerBtn = el('button', {
      class: 'btn',
      text: 'A stronger nudge',
      onclick: () => {
        this.vm.stronger();
        this.render();
      },
    }) as HTMLButtonElement;
    card.append(
      el('div', { class: 'gate-kicker', text: 'THINK' }),
      el('h2', { class: 'gate-title', text: 'Stand in the quiet and think' }),
      this.tierEl,
      this.textEl,
      el('div', { class: 'gate-foot' }, [
        el('button', { class: 'btn btn-quiet', text: 'Close', onclick: () => this.vm.close() }),
        el('span', { class: 'flex-space' }),
        this.strongerBtn,
      ])
    );
    this.node.append(card);

    this.vm.open$.subscribe((on) => {
      if (on) {
        this.render();
        this.node.classList.remove('hidden');
      } else {
        this.node.classList.add('hidden');
      }
    });
  }

  private render(): void {
    const set = this.vm.set$.value;
    if (!set) return;
    const tier = this.vm.tier$.value;
    const names: Record<number, string> = { 1: 'a nudge', 2: 'a stronger nudge', 3: 'nearly the answer' };
    this.tierEl.textContent = names[tier] ?? '';
    this.textEl.textContent =
      tier >= 3 ? set.tier3 : tier >= 2 ? set.tier2 : set.tier1;
    this.strongerBtn.disabled = tier >= 3;
    if (tier >= 3) this.strongerBtn.textContent = 'That is all the thinking it has';
    else this.strongerBtn.textContent = 'A stronger nudge';
  }

  destroy(): void {
    this.node.remove();
  }
}
