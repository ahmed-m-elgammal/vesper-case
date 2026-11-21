/**
 * CareerView -- the service record, opened from the brass name-plate on desk
 * 14. Pure presentation over data: the rank ladder comes from world.json
 * career.ranks, the case history from cases.json + the save, and the detective
 * story from world.json detective.backstory.
 */

import { el } from '../../core/dom';
import type { CaseFileMeta, CareerRank } from '../../data/types';
import type { DeskStatus, GameVM } from '../../viewmodels/GameVM';

const STATUS_LABEL: Record<DeskStatus, string> = {
  unsolved: 'Unopened',
  'in-progress': 'Open -- on your desk',
  solved: 'Closed',
  offline: 'Sealed',
};

export class CareerView {
  readonly node: HTMLElement;
  private vm: GameVM;

  constructor(vm: GameVM) {
    this.vm = vm;
    this.node = el('div', { class: 'overlay career-overlay hidden' });
  }

  open(): void {
    this.render();
    this.node.classList.remove('hidden');
  }

  close(): void {
    this.node.classList.add('hidden');
  }

  get isOpen(): boolean {
    return !this.node.classList.contains('hidden');
  }

  private render(): void {
    const vm = this.vm;
    const det = vm.world.world.detective;
    const career = vm.world.world.career;
    const ranks = vm.careerRanks;
    const solved = vm.solvedCount();
    const current = vm.currentRank();
    const next = vm.nextRank();

    this.node.innerHTML = '';
    const card = el('div', { class: 'career-card' });

    /* head */
    const head = el('div', { class: 'career-head' });
    head.append(
      el('div', { class: 'casefiles-title-block' }, [
        el('div', { class: 'casefiles-kicker', text: `${det.station.toUpperCase()} -- SERVICE RECORD` }),
        el('div', { class: 'casefiles-title', text: det.name }),
        el('div', { class: 'casefiles-detective', text: `Badge ${det.badge} -- Desk ${det.desk} -- ${det.station}` }),
      ]),
      el('button', { class: 'btn btn-quiet', text: 'Back to the floor', onclick: () => this.close() })
    );
    card.append(head);

    const body = el('div', { class: 'career-body' });

    /* rank plaque + progress */
    const rankPane = el('div', { class: 'career-rankpane' });
    rankPane.style.setProperty('--folder-accent', '#b4552d');
    rankPane.append(
      el('div', { class: 'career-rank-kicker', text: 'CURRENT RANK' }),
      el('div', { class: 'career-rank-title', text: current?.title ?? det.rank }),
      el('div', { class: 'career-rank-note', text: current?.note ?? '' }),
      el('div', { class: 'career-count', text: `${solved} case${solved === 1 ? '' : 's'} closed` })
    );
    if (next) {
      const pct = Math.min(100, Math.round((solved / next.after) * 100));
      rankPane.append(
        el('div', { class: 'career-nextline', text: `Next promotion at ${next.after} -- ${next.title}` }),
        el('div', { class: 'career-bar' }, [el('div', { class: 'career-bar-fill', style: `width:${pct}%` })]),
        el('div', { class: 'career-bar-note', text: `${solved} / ${next.after}` })
      );
    } else {
      rankPane.append(el('div', { class: 'career-nextline', text: 'Top of the ladder. The squint survived.' }));
    }
    rankPane.append(el('div', { class: 'career-rule-quote', text: career.explanation }));

    /* the ladder */
    const ladder = el('div', { class: 'career-ladder' });
    ladder.append(el('div', { class: 'career-ladder-head', text: 'THE LADDER -- pinned behind the duty board' }));
    for (const r of ranks) {
      const achieved = solved >= r.after;
      const isCurrent = current?.id === r.id;
      const row = el('div', { class: `career-rung${achieved ? ' on' : ''}${isCurrent ? ' now' : ''}` });
      row.append(
        el('div', { class: 'career-rung-title', text: r.title }),
        el('div', { class: 'career-rung-after', text: isCurrent ? 'you are here' : `${r.after} closed` }),
        el('div', { class: 'career-rung-note', text: r.note ?? '' })
      );
      ladder.append(row);
    }

    /* case history */
    const history = el('div', { class: 'career-history' });
    history.append(el('div', { class: 'career-ladder-head', text: 'FOLDER HISTORY' }));
    const folders = [...vm.world.caseList].sort((a, b) => a.slot - b.slot);
    if (folders.length === 0) history.append(el('div', { class: 'career-empty', text: 'No folders on record yet.' }));
    for (const c of folders) {
      history.append(this.folderRow(c));
    }

    /* the detective's story */
    const story = el('div', { class: 'career-story' });
    story.append(el('div', { class: 'career-ladder-head', text: 'PERSONNEL NOTES -- from the records room' }));
    for (const p of det.backstory) story.append(el('p', { class: 'career-story-line', text: p }));

    body.append(rankPane, ladder, history, story);
    card.append(body);
    this.node.append(card);
  }

  private folderRow(c: CaseFileMeta): HTMLElement {
    const status = this.vm.caseStatusFor(c.id);
    const cp = this.vm.state.cases[c.id];
    const row = el('div', { class: `career-folder status-${status}` });
    row.style.setProperty('--folder-accent', c.accent);
    const detail =
      status === 'solved'
        ? 'Closed -- the count remembers.'
        : status === 'in-progress'
          ? 'Open -- the house is still talking.'
          : status === 'offline'
            ? c.rankRequired
              ? `Sealed until ${c.rankRequired}.`
              : 'Sealed -- not yours yet.'
            : 'Unopened -- waiting on the desk.';
    row.append(
      el('div', { class: 'career-folder-code', text: c.code }),
      el('div', { class: 'career-folder-main' }, [
        el('div', { class: 'career-folder-title', text: c.title }),
        el('div', { class: 'career-folder-detail', text: detail }),
      ]),
      el('div', { class: `career-folder-status stamp-${status}`, text: STATUS_LABEL[status] })
    );
    void cp;
    return row;
  }
}
