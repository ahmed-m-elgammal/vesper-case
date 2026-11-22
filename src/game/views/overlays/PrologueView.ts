/**
 * PrologueView -- the storybook case file: turnable pages rendered from
 * prologue.json templates (cover, summons letter, victim, floor plan,
 * official story, suspects, kit, begin).
 */

import { el } from '../../core/dom';
import { withBase } from '../../core/assetUrl';
import type { GameVM } from '../../viewmodels/GameVM';
import type { ProloguePage, Suspect } from '../../data/types';

export class PrologueView {
  readonly node: HTMLElement;
  private pageHost: HTMLElement;
  private vm: GameVM;
  private pages: ProloguePage[];
  private idx = 0;

  constructor(vm: GameVM, private onTakeCase: () => void) {
    this.vm = vm;
    this.pages = vm.repo.bundle.prologue;
    this.idx = Math.min(vm.cp.prologuePage, this.pages.length - 1);

    this.node = el('div', { class: 'overlay prologue-overlay' });
    const book = el('div', { class: 'prologue-book' });
    const head = el('div', { class: 'prologue-head' });
    head.append(
      el('span', { class: 'prologue-brand', text: 'CONFIDENTIAL -- the Vesper case' }),
      el('span', { class: 'prologue-count' })
    );
    this.pageHost = el('div', { class: 'prologue-page-host' });
    const foot = el('div', { class: 'prologue-foot' });
    const back = el('button', {
      class: 'btn btn-quiet prologue-nav',
      text: '\u2190 Back',
      onclick: () => this.turn(-1),
    });
    const next = el('button', {
      class: 'btn prologue-nav',
      text: 'Next \u2192',
      onclick: () => this.turn(1),
    });
    foot.append(back, el('div', { class: 'prologue-dots' }), next);

    book.append(head, this.pageHost, foot);
    this.node.append(book);
    this.render();
  }

  private turn(dir: -1 | 1): void {
    const next = this.idx + dir;
    if (next < 0 || next >= this.pages.length) return;
    this.idx = next;
    this.vm.setProloguePage(this.idx);
    const host = this.pageHost;
    host.classList.remove('turn-in');
    void host.offsetWidth;
    host.classList.add('turn-in');
    this.render();
  }

  private render(): void {
    const page = this.pages[this.idx];
    const vm = this.vm;
    const meta = vm.repo.bundle.case;
    this.pageHost.innerHTML = '';

    const frag = el('div', { class: `prologue-page page-${page.template}` });

    switch (page.template) {
      case 'cover': {
        frag.append(
          el('div', { class: 'cover-rule' }),
          el('h1', { class: 'cover-title', text: 'Ink & Ashes' }),
          el('div', { class: 'cover-sub', text: meta.subtitle }),
          el('p', { class: 'cover-epigraph', text: meta.epigraph }),
          el('div', { class: 'cover-meta', text: `${meta.location} -- ${meta.dateLabel}` }),
          el('div', { class: 'cover-stamp', text: 'CASE FILE No. 7-HL' }),
          el('div', { class: 'cover-rule' })
        );
        break;
      }
      case 'letter': {
        const letter = page.letter!;
        const card = el('div', { class: 'letter-paper' });
        card.append(el('div', { class: 'letter-to', text: letter.to }));
        for (const line of letter.lines) card.append(el('p', { class: 'letter-line', text: line }));
        card.append(el('div', { class: 'letter-sign', text: letter.sign }));
        frag.append(el('h2', { class: 'page-title', text: page.title ?? 'The Summons' }), card);
        break;
      }
      case 'victim': {
        const card = el('div', { class: 'victim-card' });
        card.append(el('div', { class: 'victim-portrait', text: 'EV' }));
        const facts = el('div', { class: 'victim-facts' });
        const row = (k: string, v: string) => {
          facts.append(el('div', { class: 'fact-row' }, [el('span', { class: 'fact-k', text: k }), el('span', { class: 'fact-v', text: v })]));
        };
        row('Name', `${meta.victim.name}, ${meta.victim.age}`);
        row('Found', meta.victim.found);
        row('Time of death', meta.tod);
        row('Cause (certified)', meta.victim.cause);
        card.append(facts);
        frag.append(el('h2', { class: 'page-title', text: page.title ?? 'The Victim' }), card);
        for (const p of meta.victim.about) frag.append(el('p', { class: 'page-body', text: p }));
        break;
      }
      case 'plan': {
        const holder = el('div', { class: 'plan-holder' });
        fetch(withBase('/art/plan.svg'))
          .then((r) => r.text())
          .then((t) => {
            holder.innerHTML = t;
          })
          .catch(() => {
            holder.textContent = '(floor plan unavailable)';
          });
        frag.append(el('h2', { class: 'page-title', text: page.title ?? 'The House' }), holder);
        for (const p of page.body ?? []) frag.append(el('p', { class: 'page-body', text: p }));
        break;
      }
      case 'story': {
        frag.append(el('h2', { class: 'page-title', text: page.title ?? 'What the Household Says' }));
        for (const p of meta.officialStory) frag.append(el('p', { class: 'page-body', text: p }));
        break;
      }
      case 'suspects': {
        frag.append(el('h2', { class: 'page-title', text: page.title ?? 'Five Sleepless Guests' }));
        const grid = el('div', { class: 'suspect-grid' });
        for (const s of vm.repo.bundle.suspects) {
          grid.append(this.suspectCard(s));
        }
        frag.append(grid);
        break;
      }
      case 'kit': {
        frag.append(el('h2', { class: 'page-title', text: page.title ?? 'Your Instruments' }));
        const list = el('ul', { class: 'kit-list' });
        for (const p of page.body ?? []) list.append(el('li', { text: p }));
        frag.append(list);
        frag.append(el('p', { class: 'page-note', text: page.footnote ?? '' }));
        break;
      }
      case 'begin': {
        frag.append(
          el('h2', { class: 'page-title', text: page.title ?? 'Take Up the Case' })
        );
        for (const p of page.body ?? []) frag.append(el('p', { class: 'page-body', text: p }));
        frag.append(
          el('button', {
            class: 'btn btn-primary begin-btn',
            text: 'Walk up to the door of 7 Hollow Lane',
            onclick: () => this.onTakeCase(),
          })
        );
        break;
      }
    }

    if (page.footnote && page.template !== 'kit') {
      frag.append(el('p', { class: 'page-note', text: page.footnote }));
    }
    this.pageHost.append(frag);

    const count = this.node.querySelector('.prologue-count') as HTMLElement;
    count.textContent = `Page ${this.idx + 1} of ${this.pages.length}`;
    const dots = this.node.querySelector('.prologue-dots') as HTMLElement;
    dots.innerHTML = '';
    this.pages.forEach((_, i) => {
      dots.append(el('span', { class: `dot${i === this.idx ? ' on' : ''}` }));
    });
    const navs = this.node.querySelectorAll('.prologue-nav') as NodeListOf<HTMLButtonElement>;
    (navs[0] as HTMLButtonElement).disabled = this.idx === 0;
    const isLast = this.idx === this.pages.length - 1;
    (navs[1] as HTMLButtonElement).disabled = isLast;
    (navs[1] as HTMLButtonElement).textContent = isLast ? 'The last page' : 'Next \u2192';
  }

  private suspectCard(s: Suspect): HTMLElement {
    return el('div', { class: 'suspect-card' }, [
      el('div', { class: 'suspect-initial', style: `background:${s.tint}33;border-color:${s.tint}`, text: s.initial }),
      el('div', { class: 'suspect-body' }, [
        el('div', { class: 'suspect-name', text: s.name }),
        el('div', { class: 'suspect-role', text: `${s.age} -- ${s.role}` }),
        el('div', { class: 'suspect-statement', text: `\u201C${s.statement}\u201D` }),
      ]),
    ]);
  }

  destroy(): void {
    this.node.remove();
  }
}
