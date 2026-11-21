/**
 * ToastView -- parchment notification chips (clue found, warnings, info).
 */

import { el, bindList } from '../../core/dom';
import type { GameVM } from '../../viewmodels/GameVM';

export class ToastView {
  readonly node: HTMLElement;

  constructor(vm: GameVM) {
    this.node = el('div', { class: 'toast-host' });
    bindList(this.node, vm.toasts$, (toasts) =>
      toasts.map((t) => el('div', { class: `toast toast-${t.kind}`, text: t.text }))
    );
  }
}
