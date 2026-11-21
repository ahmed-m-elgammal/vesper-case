/**
 * NarrationCard -- a once-only narration overlay for station levels (data
 * comes from world.json scenes' firstEntry). Same look as the intro card.
 */

import { el } from '../../core/dom';

export class NarrationCard {
  readonly node: HTMLElement;
  private linesHost: HTMLElement;
  private foot: HTMLElement;
  private lines: string[];
  private idx = 0;

  constructor(kicker: string, lines: string[], private onDone: () => void) {
    this.lines = lines;
    this.node = el('div', { class: 'overlay intro-overlay narration-overlay' });
    const card = el('div', { class: 'intro-card' });
    card.append(el('div', { class: 'intro-kicker', text: kicker.toUpperCase() }));
    this.linesHost = el('div', { class: 'intro-lines' });
    this.foot = el('div', { class: 'intro-foot' });
    card.append(this.linesHost, this.foot);
    this.node.append(card);
    this.node.addEventListener('click', () => this.advance());
    this.render();
  }

  private advance(): void {
    if (this.idx < this.lines.length - 1) {
      this.idx++;
      this.render();
    } else {
      this.finish();
    }
  }

  private finish(): void {
    this.node.remove();
    this.onDone();
  }

  private render(): void {
    this.linesHost.innerHTML = '';
    for (let i = 0; i <= this.idx; i++) {
      const p = el('p', { class: `intro-line${i === this.idx ? ' last' : ''}`, text: this.lines[i] });
      this.linesHost.append(p);
    }
    this.foot.innerHTML = '';
    this.foot.append(
      el('span', {
        class: 'intro-next',
        text: this.idx < this.lines.length - 1 ? 'tap to continue' : 'take a look around',
      })
    );
    const last = this.linesHost.querySelector('.intro-line.last') as HTMLElement | null;
    last?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}
