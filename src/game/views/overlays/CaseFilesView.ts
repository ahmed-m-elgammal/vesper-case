/**
 * CaseFilesView -- the desk drawer. Lists every folder from cases.json (the
 * registry), shows the captain's memo for the selected file, and hands the
 * case over to the engine. Playability is data-driven: 'available' folders
 * can be taken, everything else carries a status stamp and the memo alone.
 */

import { el } from '../../core/dom';
import type { CaseFileMeta } from '../../data/types';
import type { DeskStatus, GameVM } from '../../viewmodels/GameVM';

const STAMP_LABEL: Record<DeskStatus, string> = {
  unsolved: 'NEW',
  'in-progress': 'IN PROGRESS',
  solved: 'SOLVED',
  offline: 'SEALED',
};

const STAMP_NOTE: Record<DeskStatus, string> = {
  unsolved: 'Unread -- waiting on the desk.',
  'in-progress': 'Already in your hands. The house is still talking.',
  solved: 'Closed. The file smells faintly of victory and old paper.',
  offline: 'Not yours yet, Detective.',
};

export class CaseFilesView {
  readonly node: HTMLElement;
  private list: HTMLElement;
  private detail: HTMLElement;
  private vm: GameVM;
  private selected: CaseFileMeta | null = null;

  constructor(vm: GameVM, hooks: { onTakeCase: (id: string) => void }) {
    this.vm = vm;
    this.node = el('div', { class: 'overlay casefiles-overlay hidden' });

    const card = el('div', { class: 'casefiles-card' });
    const head = el('div', { class: 'casefiles-head' });
    const det = vm.world.world.detective;
    head.append(
      el('div', { class: 'casefiles-title-block' }, [
        el('div', { class: 'casefiles-kicker', text: `${det.station.toUpperCase()} -- DESK ${det.desk}` }),
        el('div', { class: 'casefiles-title', text: 'The case files' }),
        el('div', { class: 'casefiles-detective', text: `${det.name} -- ${det.rank}, badge ${det.badge}` }),
      ]),
      el('button', { class: 'btn btn-quiet', text: 'Back to the bullpen', onclick: () => this.close() })
    );

    this.list = el('div', { class: 'casefiles-list' });
    this.detail = el('div', { class: 'casefiles-detail' });
    const body = el('div', { class: 'casefiles-body' });
    body.append(this.list, this.detail);

    card.append(head, body);
    this.node.append(card);

    this.renderList(hooks);
    // Preselect the detective's first case (or the first available folder).
    const first =
      vm.world.caseList.find((c) => c.firstCase && this.vm.caseStatusFor(c.id) !== 'offline') ??
      vm.world.caseList.find((c) => c.status === 'available') ??
      vm.world.caseList[0];
    if (first) this.select(first, hooks);
  }

  open(): void {
    this.renderList();
    if (this.selected) this.renderDetail(this.selected, { onTakeCase: (id) => this.takeCase(id) });
    this.node.classList.remove('hidden');
  }

  close(): void {
    this.node.classList.add('hidden');
  }

  get isOpen(): boolean {
    return !this.node.classList.contains('hidden');
  }

  private takeCase(id: string): void {
    this.close();
    void this.vm.selectCase(id);
  }

  private renderList(hooks?: { onTakeCase: (id: string) => void }): void {
    this.list.innerHTML = '';
    const folders = [...this.vm.world.caseList].sort((a, b) => a.slot - b.slot);
    for (const c of folders) {
      const status = this.vm.caseStatusFor(c.id);
      const folder = el('div', { class: `case-folder status-${status}` });
      folder.style.setProperty('--folder-accent', c.accent);
      folder.append(
        el('div', { class: 'case-folder-tab', text: c.code }),
        el('div', { class: 'case-folder-title', text: c.title }),
        el('div', { class: 'case-folder-sub', text: c.subtitle }),
        el('div', { class: `case-stamp stamp-${status}`, text: STAMP_LABEL[status] })
      );
      folder.addEventListener('click', () => {
        this.selected = c;
        this.list.querySelectorAll('.case-folder').forEach((f) => f.classList.remove('on'));
        folder.classList.add('on');
        if (hooks) this.renderDetail(c, hooks);
        else this.renderDetail(c, { onTakeCase: (id) => this.takeCase(id) });
      });
      if (this.selected?.id === c.id) folder.classList.add('on');
      this.list.append(folder);
    }
  }

  private renderDetail(c: CaseFileMeta, hooks: { onTakeCase: (id: string) => void }): void {
    this.detail.innerHTML = '';
    const status = this.vm.caseStatusFor(c.id);
    const meta = el('div', { class: 'casefile-meta' });
    const row = (k: string, v: string) =>
      meta.append(el('div', { class: 'casefile-row' }, [el('span', { class: 'casefile-k', text: k }), el('span', { class: 'casefile-v', text: v })]));
    row('File', `${c.code} -- ${c.difficulty}`);
    row('Place', c.location);
    row('Victim', c.victim);

    const pane = el('div', { class: 'casefile-pane' });
    pane.style.setProperty('--folder-accent', c.accent);
    pane.append(
      el('h3', { class: 'casefile-title', text: c.title }),
      el('div', { class: 'casefile-sub', text: c.subtitle }),
      meta,
      el('p', { class: 'casefile-pitch', text: c.pitch }),
      el('div', { class: 'casefile-memo' }, [
        el('div', { class: 'casefile-memo-head', text: 'MEMO -- from the desk of Capt. R. Breche' }),
        ...c.memo.map((m) => el('p', { class: 'casefile-memo-line', text: m })),
      ]),
      el('div', { class: 'casefile-note', text: STAMP_NOTE[status] })
    );

    if (c.status === 'available') {
      const label =
        status === 'solved'
          ? 'Reopen the file'
          : status === 'in-progress'
            ? 'Resume the case'
            : c.firstCase
              ? 'Take the case -- your first'
              : 'Take the case';
      pane.append(
        el('button', { class: 'btn btn-primary casefile-cta', text: label, onclick: () => hooks.onTakeCase(c.id) })
      );
    } else {
      pane.append(
        el('button', {
          class: 'btn casefile-cta',
          text: 'Return to the desk',
          onclick: () => this.close(),
        })
      );
    }

    this.detail.append(pane);
  }

  private select(c: CaseFileMeta, hooks: { onTakeCase: (id: string) => void }): void {
    this.selected = c;
    this.renderDetail(c, hooks);
  }
}
