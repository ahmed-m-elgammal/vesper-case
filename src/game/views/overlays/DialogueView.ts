/**
 * DialogueView -- bottom-sheet dialogue with typewriter text and choices.
 * JSON-driven now; the Ink (inkjs) interrogation runtime plugs into this
 * same view in Milestone 4.
 */

import { el, bindText, bindVisible } from '../../core/dom';
import type { DialogueVM } from '../../viewmodels/DialogueVM';

export class DialogueView {
  readonly node: HTMLElement;
  private choicesEl: HTMLElement;

  constructor(private dvm: DialogueVM) {
    this.node = el('div', { class: 'overlay dialogue-overlay hidden' });
    const sheet = el('div', { class: 'dialogue-sheet' });
    const portrait = el('div', { class: 'dialogue-portrait' });
    const body = el('div', { class: 'dialogue-body' });
    const name = el('div', { class: 'dialogue-name' });
    const line = el('div', { class: 'dialogue-line' });
    bindText(line, dvm.line$);
    const hint = el('div', { class: 'dialogue-hint', text: 'tap to continue' });
    bindVisible(hint, dvm.typingDone$);
    this.choicesEl = el('div', { class: 'dialogue-choices' });
    body.append(name, line, hint, this.choicesEl);
    sheet.append(portrait, body);
    this.node.append(sheet);

    this.node.addEventListener('click', (e) => {
      if ((e.target as HTMLElement).closest('.dialogue-choice')) return;
      if (this.dvm.active$.value) this.dvm.advance();
    });
    // Portrait + name + choices react to node changes
    dvm.node$.subscribe((node) => {
      if (!node) {
        this.node.classList.add('hidden');
        this.choicesEl.innerHTML = '';
        return;
      }
      portrait.textContent = node.initial;
      portrait.style.borderColor = 'var(--ink)';
      name.textContent = node.speaker;
      this.choicesEl.innerHTML = '';
      if (node.choices) {
        node.choices.forEach((c, i) => {
          this.choicesEl.append(el('button', {
            class: 'dialogue-choice',
            text: c.text,
            onclick: () => this.dvm.choose(i),
          }));
        });
      }
      this.node.classList.remove('hidden');
    });
  }

  destroy(): void {
    this.node.remove();
  }
}
