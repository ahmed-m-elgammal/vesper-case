/**
 * StartView -- title screen. Doubles as the "tap to begin" gate (reserved
 * for the audio unlock when sound ships in Milestone 6).
 */

import { el } from '../../core/dom';
import type { GameVM } from '../../viewmodels/GameVM';
import { SaveSystem } from '../../save/SaveSystem';
import type { GameState } from '../../data/types';

export class StartView {
  readonly node: HTMLElement;
  private vm: GameVM;

  constructor(vm: GameVM, mode: 'fresh' | 'resumed', onBegin: () => void) {
    this.vm = vm;
    this.node = el('div', { class: 'overlay start-overlay' });

    const card = el('div', { class: 'start-card' });

    card.append(
      el('div', { class: 'start-kicker', text: 'A detective deduction game in one house, one night' }),
      el('h1', { class: 'start-title', text: 'Ink & Ashes' }),
      el('div', { class: 'start-sub', text: 'The Vesper Case' }),
      el('p', { class: 'start-epigraph', text: '\u201CSeven rooms, five sleepless guests, one storm -- and a confession that will not stay shut.\u201D' }),
      el('div', { class: 'start-tap', text: 'Tap to begin' })
    );

    const actions = el('div', { class: 'start-actions' });

    if (mode === 'resumed') {
      actions.append(
        el('button', {
          class: 'btn btn-primary',
          text: 'Continue the case',
          onclick: () => onBegin(),
        }),
        el('button', {
          class: 'btn',
          text: 'Start a new case',
          onclick: () => {
            void this.resetAndBegin(onBegin);
          },
        }),
        el('button', {
          class: 'btn btn-quiet',
          text: 'Import a save code',
          onclick: () => this.importCode(),
        })
      );
    } else {
      actions.append(
        el('button', { class: 'btn btn-primary', text: 'Open the case file', onclick: () => onBegin() }),
        el('button', { class: 'btn btn-quiet', text: 'Import a save code', onclick: () => this.importCode() })
      );
    }

    card.append(actions, el('div', { class: 'start-build', text: 'Build One -- Prologue & Act I' }));
    this.node.append(card);
  }

  private async resetAndBegin(onBegin: () => void): Promise<void> {
    await this.vm.save.clear();
    this.vm.state.phase = 'prologue';
    onBegin();
  }

  private importCode(): void {
    const raw = window.prompt('Paste your save code:');
    if (!raw) return;
    const state = SaveSystem.decode(raw) as GameState | null;
    if (!state) {
      this.vm.toast('That code did not parse. Check it and try again.', 'warn');
      return;
    }
    this.vm.state = state;
    this.vm.publishAll();
    void this.vm.save.saveNow(state);
    this.node.dispatchEvent(new CustomEvent('startview:imported', { bubbles: true }));
    this.vm.toast('Case restored from the save code.', 'info');
    this.close();
  }

  close(): void {
    this.node.remove();
  }
}
