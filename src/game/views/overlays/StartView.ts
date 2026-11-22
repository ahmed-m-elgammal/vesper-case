/**
 * StartView -- title screen. Doubles as the "tap to begin" gate (reserved
 * for the audio unlock when sound ships in Milestone 6).
 */

import { el } from '../../core/dom';
import type { GameVM } from '../../viewmodels/GameVM';
import { SaveSystem } from '../../save/SaveSystem';
import { freshState } from '../../data/types';
import type { GameState } from '../../data/types';

export class StartView {
  readonly node: HTMLElement;
  private vm: GameVM;

  constructor(vm: GameVM, mode: 'fresh' | 'resumed', onBegin: () => void, onStation: () => void) {
    this.vm = vm;
    this.node = el('div', { class: 'overlay start-overlay' });

    const card = el('div', { class: 'start-card' });

    card.append(
      el('div', { class: 'start-kicker', text: 'A detective deduction game in the old town precinct' }),
      el('h1', { class: 'start-title', text: 'Ink & Ashes' }),
      el('div', { class: 'start-sub', text: 'The Precinct Files' }),
      el('p', { class: 'start-epigraph', text: '\u201CRain on the pavement, a desk with your name on it, and a folder that is about to become your first case.\u201D' }),
      el('div', { class: 'start-tap', text: 'Tap to begin' })
    );

    const actions = el('div', { class: 'start-actions' });

    if (mode === 'resumed') {
      actions.append(
        el('button', {
          class: 'btn btn-primary',
          text: 'Continue working',
          onclick: () => onBegin(),
        }),
        el('button', {
          class: 'btn',
          text: 'Back to the precinct',
          onclick: () => onStation(),
        }),
        el('button', {
          class: 'btn btn-quiet',
          text: 'Import a save code',
          onclick: () => this.importCode(),
        }),
        el('button', {
          class: 'btn btn-quiet',
          text: 'Start over as a new detective',
          onclick: () => {
            void this.resetAndBegin(onBegin);
          },
        })
      );
    } else {
      actions.append(
        el('button', { class: 'btn btn-primary', text: 'Begin the night shift', onclick: () => onBegin() }),
        el('button', { class: 'btn btn-quiet', text: 'Import a save code', onclick: () => this.importCode() })
      );
    }

    card.append(actions, el('div', { class: 'start-build', text: this.vm.repo.bundle.case.build }));
    this.node.append(card);
  }

  private async resetAndBegin(onBegin: () => void): Promise<void> {
    await this.vm.save.clear();
    this.vm.state = freshState();
    this.vm.publishAll();
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
    // Ask the root to route to the imported save's phase (it loads the case
    // bundle first when the save points at a different folder).
    window.dispatchEvent(new CustomEvent('game:route', { detail: { phase: state.phase } }));
  }

  close(): void {
    this.node.remove();
  }
}
