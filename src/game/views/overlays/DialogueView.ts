/**
 * DialogueView -- bottom-sheet conversation: portrait + name + bearing chip,
 * typewriter beats (npc / detective / narrator), branching choices, and the
 * evidence picker used for "Present evidence" reactions.
 */

import { el, bindVisible, bindText } from '../../core/dom';
import type { DialogueVM } from '../../viewmodels/DialogueVM';
import type { NotebookVM, NotebookClueCard } from '../../viewmodels/NotebookVM';
import type { GameVM } from '../../viewmodels/GameVM';
import { resolveText } from '../../dialogue/loc';

export class DialogueView {
  readonly node: HTMLElement;
  private choicesEl: HTMLElement;
  private presentEl: HTMLElement;
  private presentGrid: HTMLElement;
  private portraitEl: HTMLElement;
  private hintEl: HTMLElement;
  private portraitUrl: string | null = null;

  constructor(
    private dvm: DialogueVM,
    private nb: NotebookVM,
    private vm: GameVM
  ) {
    this.node = el('div', { class: 'overlay dialogue-overlay hidden' });
    const sheet = el('div', { class: 'dialogue-sheet' });
    this.portraitEl = el('div', { class: 'dialogue-portrait' }, [el('span', { text: '?' })]);
    const body = el('div', { class: 'dialogue-body' });
    const nameRow = el('div', { class: 'dialogue-name-row' });
    const name = el('div', { class: 'dialogue-name' });
    bindText(name, dvm.speakerName$);
    const bearing = el('div', { class: 'dialogue-bearing' });
    bindText(bearing, dvm.bearing$);
    bindVisible(bearing, dvm.bearing$.map((b) => b.length > 0));
    nameRow.append(name, bearing);
    const line = el('div', { class: 'dialogue-line' });
    this.hintEl = el('div', { class: 'dialogue-hint', text: resolveText('@dlg.ui.tap') });
    this.choicesEl = el('div', { class: 'dialogue-choices' });
    body.append(nameRow, line, this.hintEl, this.choicesEl);
    sheet.append(this.portraitEl, body);

    // Evidence picker panel
    this.presentEl = el('div', { class: 'dialogue-present hidden' });
    this.presentGrid = el('div', { class: 'dialogue-present-grid' });
    this.presentEl.append(
      el('div', { class: 'dialogue-present-title', text: resolveText('@dlg.ui.present.title') }),
      this.presentGrid,
      el('button', {
        class: 'btn dialogue-present-cancel',
        text: resolveText('@dlg.ui.present.cancel'),
        onclick: () => this.dvm.cancelPresent(),
      })
    );

    this.node.append(sheet, this.presentEl);

    this.node.addEventListener('click', (e) => {
      const target = e.target as HTMLElement;
      if (target.closest('.dialogue-choice') || target.closest('.dialogue-present')) return;
      if (this.dvm.presenting$.value) return;
      if (this.dvm.active$.value) this.dvm.advance();
    });

    /* ---- bindings ---- */
    dvm.active$.subscribe((on) => {
      this.node.classList.toggle('hidden', !on);
      if (!on) this.presentEl.classList.add('hidden');
    });
    dvm.beat$.subscribe((beat) => {
      line.className = beat ? `dialogue-line beat-${beat.sp}` : 'dialogue-line';
      line.textContent = beat?.text ?? '';
      this.hintEl.classList.toggle('hidden', !beat);
    });
    dvm.typingDone$.subscribe((done) => {
      this.hintEl.textContent = done ? resolveText('@dlg.ui.tap') : '';
      this.hintEl.classList.toggle('hidden', !done);
    });
    dvm.choices$.subscribe((choices) => {
      this.choicesEl.innerHTML = '';
      if (choices.length === 0) return;
      for (const c of choices) {
        this.choicesEl.append(
          el('button', {
            class: `dialogue-choice${c.present ? ' present' : ''}`,
            text: c.text,
            onclick: (ev) => {
              ev.stopPropagation();
              this.dvm.choose(c.index);
            },
          })
        );
      }
      this.hintEl.classList.add('hidden');
    });
    dvm.suspectId$.subscribe((id) => void this.updatePortrait(id));
    dvm.presenting$.subscribe((on) => {
      this.presentEl.classList.toggle('hidden', !on);
      if (on) this.renderPresentGrid();
    });
  }

  private async updatePortrait(suspectId: string | null): Promise<void> {
    // Case suspects come from the active bundle; station staff from the world.
    const suspect = suspectId ? this.vm.repo.suspect(suspectId) : undefined;
    const person = suspectId ? this.vm.world.person(suspectId) : undefined;
    const url = suspect?.portrait ?? person?.portrait ?? null;
    const initial = suspect?.initial ?? person?.initial ?? '?';
    const tint = suspect?.tint ?? person?.tint ?? null;
    this.portraitUrl = url;
    if (!url) {
      this.portraitEl.className = 'dialogue-portrait';
      this.portraitEl.innerHTML = '';
      this.portraitEl.append(el('span', { text: initial }));
      this.portraitEl.style.borderColor = tint ?? 'var(--ink)';
      return;
    }
    try {
      const svg = await this.fetchSvg(url);
      if (this.portraitUrl !== url) return; // stale response
      this.portraitEl.className = 'dialogue-portrait has-svg';
      this.portraitEl.style.borderColor = tint ?? 'var(--ink)';
      this.portraitEl.innerHTML = svg;
    } catch {
      this.portraitEl.className = 'dialogue-portrait';
      this.portraitEl.innerHTML = '';
      this.portraitEl.append(el('span', { text: initial }));
    }
  }

  /** Case close-ups and world portraits both resolve through whichever repo owns them. */
  private fetchSvg(url: string): Promise<string> {
    return this.vm.repo.closeupSvg(url).catch(() => this.vm.world.closeupSvg(url));
  }

  private renderPresentGrid(): void {
    this.presentGrid.innerHTML = '';
    const cards: NotebookClueCard[] = this.nb.clueCards$.value;
    if (cards.length === 0) {
      this.presentGrid.append(
        el('p', { class: 'dialogue-present-empty', text: resolveText('@dlg.ui.present.none') })
      );
      return;
    }
    for (const card of cards) {
      const item = el('div', { class: 'dialogue-present-item' });
      const thumb = el('div', { class: 'dialogue-present-thumb' });
      if (card.clue.closeup.svg) {
        const holder = el('div', { class: 'dialogue-present-svg' });
        void this.vm.repo
          .closeupSvg(card.clue.closeup.svg)
          .then((svg) => {
            holder.innerHTML = svg;
          })
          .catch(() => undefined);
        thumb.append(holder);
      } else {
        thumb.append(el('span', { class: 'clue-thumb-fallback', text: '\u2710' }));
      }
      item.append(thumb, el('div', { class: 'dialogue-present-name', text: card.clue.name }));
      item.addEventListener('click', (ev) => {
        ev.stopPropagation();
        this.dvm.pickClue(card.clue.id);
      });
      this.presentGrid.append(item);
    }
  }

  destroy(): void {
    this.node.remove();
  }
}
