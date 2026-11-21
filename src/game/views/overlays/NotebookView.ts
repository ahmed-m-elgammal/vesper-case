/**
 * NotebookView -- the self-filling sketchbook: Clues / People / Timeline /
 * Threads tabs. Clue thumbnails reuse the close-up SVGs as little sketches.
 */

import { el, bindList } from '../../core/dom';
import { resolveText } from '../../dialogue/loc';
import type { GameVM } from '../../viewmodels/GameVM';
import type { NotebookVM, NotebookTab } from '../../viewmodels/NotebookVM';
import type { NotebookClueCard, ThreadRow, TimelineRow } from '../../viewmodels/NotebookVM';
import type { Suspect } from '../../data/types';

const TABS: Array<{ id: NotebookTab; label: string }> = [
  { id: 'clues', label: 'Clues' },
  { id: 'people', label: 'People' },
  { id: 'timeline', label: 'Timeline' },
  { id: 'threads', label: 'Threads' },
];

export class NotebookView {
  readonly node: HTMLElement;
  private vm: GameVM;
  private nb: NotebookVM;
  private content: HTMLElement;
  private clueThumbCache = new Map<string, string>();

  constructor(vm: GameVM, nb: NotebookVM, private openClue: (id: string) => void) {
    this.vm = vm;
    this.nb = nb;
    this.node = el('div', { class: 'overlay notebook-overlay hidden' });

    const book = el('div', { class: 'notebook-book' });
    const head = el('div', { class: 'notebook-head' });
    head.append(el('h2', { class: 'notebook-title', text: 'The Sketchbook' }));
    const tabs = el('div', { class: 'notebook-tabs' });
    for (const t of TABS) {
      tabs.append(el('button', {
        class: 'notebook-tab',
        text: t.label,
        onclick: (ev) => {
          this.nb.setTab(t.id);
          const btns = tabs.querySelectorAll('.notebook-tab');
          btns.forEach((b) => b.classList.remove('on'));
          (ev.currentTarget as HTMLElement).classList.add('on');
        },
      }));
    }
    head.append(tabs);
    this.content = el('div', { class: 'notebook-content' });
    const foot = el('div', { class: 'notebook-foot' });
    foot.append(
      el('span', { class: 'notebook-count' }),
      el('button', { class: 'btn', text: 'Close the book', onclick: () => this.close() })
    );
    book.append(head, this.content, foot);
    this.node.append(book);

    bindList(this.content, this.nb.tab$, () => el('div'));

    // Re-render content whenever tab or clues change.
    this.nb.tab$.subscribe(() => void this.renderTab());
    this.nb.clueCards$.subscribe(() => {
      if (this.nb.tab$.value === 'clues') void this.renderTab();
    });
    this.nb.timelineRows$.subscribe(() => {
      if (this.nb.tab$.value === 'timeline') void this.renderTab();
    });
    this.nb.threads$.subscribe(() => {
      if (this.nb.tab$.value === 'threads') void this.renderTab();
    });
    this.nb.foundCount$.subscribe((n) => {
      (this.node.querySelector('.notebook-count') as HTMLElement).textContent =
        `${n} sketches in the book`;
    });
    (tabs.children[0] as HTMLElement).classList.add('on');
  }

  open(tab?: NotebookTab): void {
    if (tab) this.nb.setTab(tab);
    this.syncTabButtons();
    this.node.classList.remove('hidden');
    void this.renderTab();
  }

  /** Keep the tab highlight in sync when open() sets a tab programmatically. */
  private syncTabButtons(): void {
    const current = this.nb.tab$.value;
    this.node.querySelectorAll('.notebook-tab').forEach((b, i) => {
      b.classList.toggle('on', TABS[i]?.id === current);
    });
  }

  close(): void {
    this.node.classList.add('hidden');
  }

  private async renderTab(): Promise<void> {
    const tab = this.nb.tab$.value;
    this.content.innerHTML = '';
    if (tab === 'clues') await this.renderClues();
    else if (tab === 'people') this.renderPeople();
    else if (tab === 'timeline') this.renderTimeline();
    else this.renderThreads();
  }

  private async renderClues(): Promise<void> {
    const cards = this.nb.clueCards$.value;
    if (cards.length === 0) {
      this.content.append(el('p', { class: 'notebook-empty', text: 'Nothing noted yet. Tap the world and look closely.' }));
      return;
    }
    const grid = el('div', { class: 'clue-grid' });
    for (const card of cards) {
      grid.append(await this.clueCard(card));
    }
    this.content.append(grid);
  }

  private async clueCard(card: NotebookClueCard): Promise<HTMLElement> {
    const item = el('div', { class: 'clue-card' });
    const thumb = el('div', { class: 'clue-thumb' });
    const url = card.clue.closeup.svg;
    if (url) {
      let svg = this.clueThumbCache.get(url);
      if (!svg) {
        try {
          svg = await this.vm.repo.closeupSvg(url);
          this.clueThumbCache.set(url, svg);
        } catch {
          svg = '';
        }
      }
      const holder = el('div', { class: 'clue-thumb-svg' });
      holder.innerHTML = svg;
      thumb.append(holder);
    } else {
      thumb.append(el('span', { class: 'clue-thumb-fallback', text: '\u2710' }));
    }
    item.append(thumb, el('div', { class: 'clue-name', text: card.clue.name }));
    item.addEventListener('click', () => this.openClue(card.clue.id));
    return item;
  }

  private renderPeople(): void {
    const grid = el('div', { class: 'people-grid' });
    for (const s of this.nb.people$.value) {
      grid.append(this.personCard(s));
    }
    this.content.append(grid);
  }

  private personCard(s: Suspect): HTMLElement {
    const talked = this.vm.hasTalkedTo(s.id);
    const bearing = resolveText(this.vm.bearingKey(s.id));
    const initialWrap = el('div', {
      class: 'person-initial',
      style: `background:${s.tint}33;border-color:${s.tint}`,
    });
    if (s.portrait && this.clueThumbCache.has(s.portrait)) {
      initialWrap.classList.add('has-svg');
      initialWrap.innerHTML = this.clueThumbCache.get(s.portrait) ?? '';
    } else if (s.portrait) {
      initialWrap.textContent = s.initial;
      void this.vm.repo
        .closeupSvg(s.portrait)
        .then((svg) => {
          this.clueThumbCache.set(s.portrait as string, svg);
          if (initialWrap.isConnected) {
            initialWrap.classList.add('has-svg');
            initialWrap.innerHTML = svg;
          }
        })
        .catch(() => undefined);
    } else {
      initialWrap.textContent = s.initial;
    }
    return el('div', { class: 'person-card' }, [
      initialWrap,
      el('div', { class: 'person-body' }, [
        el('div', { class: 'person-name-row' }, [
          el('div', { class: 'person-name', text: s.name }),
          el('div', {
            class: `person-spoken${talked ? ' yes' : ''}`,
            text: talked
              ? `${resolveText('@nb.ui.bearing')}: ${bearing}`
              : resolveText('@nb.ui.notspoken'),
          }),
        ]),
        el('div', { class: 'person-role', text: `${s.age} -- ${s.role}` }),
        s.where ? el('div', { class: 'person-where', text: s.where }) : null,
        el('div', { class: 'person-statement', text: `\u201C${s.statement}\u201D` }),
      ]),
    ]);
  }

  private renderTimeline(): void {
    const list = el('div', { class: 'timeline-list' });
    const rows: TimelineRow[] = this.nb.timelineRows$.value;
    for (const row of rows) {
      const line = el('div', { class: `timeline-row${row.revealed ? ' revealed' : ''}${row.locked ? ' locked' : ''}` }, [
        el('span', { class: 'timeline-time', text: row.revealed ? row.entry.time : '??' }),
        el('span', { class: 'timeline-text', text: row.revealed ? row.entry.text : row.locked ? '-- not yet known --' : '-- find the evidence --' }),
      ]);
      list.append(line);
    }
    this.content.append(list);
  }

  private renderThreads(): void {
    const list = el('div', { class: 'thread-list' });
    for (const row of this.nb.threads$.value as ThreadRow[]) {
      const names = row.chain.clueIds
        .map((id) => (row.foundIds.includes(id) ? this.vm.repo.clue(id)?.name ?? '?' : '???'))
        .join(' \u00B7 ');
      list.append(
        el('div', { class: 'thread-row' }, [
          el('div', { class: 'thread-name', text: row.chain.name }),
          el('div', { class: 'thread-blurb', text: row.chain.blurb }),
          el('div', { class: 'thread-progress' }, [
            el('div', {
              class: 'thread-bar',
              style: `width:${(row.foundIds.length / row.total) * 100}%`,
            }),
          ]),
          el('div', { class: 'thread-clues', text: `${row.foundIds.length}/${row.total} -- ${names}` }),
        ])
      );
    }
    this.content.append(list);
  }
}
