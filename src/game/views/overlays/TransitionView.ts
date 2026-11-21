/**
 * TransitionView -- the sketch-wipe between rooms: a paper circle expands
 * across the screen, the scene swaps at midpoint, then it retracts.
 */

import { el } from '../../core/dom';

export class TransitionView {
  readonly node: HTMLElement;
  private busy = false;

  constructor() {
    this.node = el('div', { class: 'wipe hidden' });
    this.node.append(
      el('div', { class: 'wipe-circle' }),
      el('div', { class: 'wipe-scribble', text: '\u270E' })
    );
  }

  /** Play the wipe; `mid` swaps scenes while the screen is covered. */
  play(mid: () => void): void {
    if (this.busy) return;
    this.busy = true;
    this.node.classList.remove('hidden');
    this.node.classList.remove('out');
    void this.node.offsetWidth;
    this.node.classList.add('run');
    window.setTimeout(() => {
      mid();
      this.node.classList.add('out');
    }, 340);
    window.setTimeout(() => {
      this.node.classList.add('hidden');
      this.node.classList.remove('run', 'out');
      this.busy = false;
    }, 700);
  }
}
