/**
 * NotebookVM -- fills the sketchbook. Derives clue cards, people pages,
 * timeline rows and thread (chain) progress from GameVM progression state.
 */

import { Computed, Observable } from '../core/Observable';
import type { Chain, Clue, Suspect, TimelineEntry } from '../data/types';
import type { GameVM } from './GameVM';

export interface NotebookClueCard {
  clue: Clue;
  foundAt: number;
}

export interface TimelineRow {
  entry: TimelineEntry;
  revealed: boolean;
  locked: boolean;
}

export interface ThreadRow {
  chain: Chain;
  foundIds: string[];
  total: number;
}

export type NotebookTab = 'clues' | 'people' | 'timeline' | 'threads';

export class NotebookVM {
  readonly tab$: Observable<NotebookTab>;
  readonly clueCards$: Observable<NotebookClueCard[]>;
  readonly people$: Observable<Suspect[]>;
  readonly timelineRows$: Observable<TimelineRow[]>;
  readonly threads$: Observable<ThreadRow[]>;
  readonly foundCount$: Observable<number>;

  constructor(private game: GameVM) {
    this.tab$ = new Observable<NotebookTab>('clues');

    this.clueCards$ = new Computed<NotebookClueCard[]>(
      () => {
        const found = game.clues$.value;
        return Object.entries(found)
          .map(([id, meta]) => {
            const clue = game.repo.clue(id);
            return clue ? { clue, foundAt: meta.at } : null;
          })
          .filter((x): x is NotebookClueCard => x !== null)
          .sort((a, b) => a.foundAt - b.foundAt);
      },
      [game.clues$]
    );

    this.foundCount$ = new Computed<number>(() => Object.keys(game.clues$.value).length, [game.clues$]);

    this.people$ = new Observable<Suspect[]>(game.repo.bundle.suspects);

    this.timelineRows$ = new Computed<TimelineRow[]>(
      () => {
        const found = game.clues$.value;
        const flags = game.flags$.value;
        return game.repo.bundle.timeline.map((entry) => {
          const rb = entry.revealedBy;
          if (rb === 'file') return { entry, revealed: true, locked: false };
          if (rb === 'locked') return { entry, revealed: false, locked: true };
          if (rb.startsWith('clue:')) {
            return { entry, revealed: Boolean(found[rb.slice(5)]), locked: false };
          }
          if (rb.startsWith('flag:')) {
            return { entry, revealed: Boolean(flags[rb.slice(5)]), locked: false };
          }
          return { entry, revealed: false, locked: true };
        });
      },
      [game.clues$, game.flags$]
    );

    this.threads$ = new Computed<ThreadRow[]>(
      () => {
        const found = game.clues$.value;
        return game.repo.bundle.chains.map((chain) => ({
          chain,
          foundIds: chain.clueIds.filter((id) => found[id]),
          total: chain.clueIds.length,
        }));
      },
      [game.clues$]
    );
  }

  setTab(tab: NotebookTab): void {
    this.tab$.value = tab;
  }
}
