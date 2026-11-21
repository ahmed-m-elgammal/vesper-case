/**
 * MenuView -- settings, save-code management and about notes.
 * Accessibility options live here: text size, hotspot shimmer, colour-blind
 * accent, subtitles; audio sliders are stubbed until Milestone 6 ships.
 */

import { el } from '../../core/dom';
import type { GameVM } from '../../viewmodels/GameVM';
import { SaveSystem } from '../../save/SaveSystem';

export class MenuView {
  readonly node: HTMLElement;
  private vm: GameVM;
  private body: HTMLElement;
  private tab = 'settings';

  constructor(vm: GameVM, private onClose: () => void) {
    this.vm = vm;
    this.node = el('div', { class: 'overlay menu-overlay hidden' });
    const card = el('div', { class: 'menu-card' });
    const head = el('div', { class: 'menu-head' });
    const tabs = el('div', { class: 'menu-tabs' });
    for (const t of ['Settings', 'Save', 'About']) {
      tabs.append(el('button', {
        class: 'menu-tab',
        text: t,
        onclick: (ev) => {
          this.tab = t.toLowerCase();
          tabs.querySelectorAll('.menu-tab').forEach((b) => b.classList.remove('on'));
          (ev.currentTarget as HTMLElement).classList.add('on');
          this.render();
        },
      }));
    }
    (tabs.children[0] as HTMLElement).classList.add('on');
    head.append(tabs, el('button', { class: 'btn btn-quiet', text: 'Close', onclick: () => this.onClose() }));
    this.body = el('div', { class: 'menu-body' });
    card.append(head, this.body);
    this.node.append(card);
  }

  open(): void {
    this.render();
    this.node.classList.remove('hidden');
  }

  close(): void {
    this.node.classList.add('hidden');
  }

  private render(): void {
    this.body.innerHTML = '';
    if (this.tab === 'settings') this.renderSettings();
    else if (this.tab === 'save') this.renderSave();
    else this.renderAbout();
  }

  private renderSettings(): void {
    const s = this.vm.state.settings;
    const wrap = el('div', { class: 'settings-list' });

    // text size
    const sizeRow = el('div', { class: 'setting-row' }, [
      el('span', { class: 'setting-label', text: 'Text size' }),
      el('div', { class: 'setting-ctl' }, [
        el('button', {
          class: 'btn btn-sm',
          text: 'A \u2212',
          onclick: () => this.vm.updateSettings({ textSize: Math.max(0, s.textSize - 1) as 0 | 1 | 2 }),
        }),
        el('button', {
          class: 'btn btn-sm',
          text: 'A +',
          onclick: () => this.vm.updateSettings({ textSize: Math.min(2, s.textSize + 1) as 0 | 1 | 2 }),
        }),
      ]),
    ]);

    // highlights
    const hlRow = el('div', { class: 'setting-row' }, [
      el('span', { class: 'setting-label', text: 'Hotspot shimmer (highlights)' }),
      el('button', {
        class: `btn btn-sm toggle${s.highlights ? ' on' : ''}`,
        text: s.highlights ? 'On' : 'Off',
        onclick: (ev) => {
          this.vm.updateSettings({ highlights: !s.highlights });
          (ev.currentTarget as HTMLElement).textContent = s.highlights ? 'On' : 'Off';
          (ev.currentTarget as HTMLElement).classList.toggle('on', s.highlights);
        },
      }),
    ]);

    // accent
    const accents: Array<{ id: 'rust' | 'cobalt' | 'forest'; color: string; label: string }> = [
      { id: 'rust', color: '#b4552d', label: 'Rust' },
      { id: 'cobalt', color: '#1f5fd0', label: 'Cobalt' },
      { id: 'forest', color: '#2c7a4b', label: 'Forest' },
    ];
    const accentRow = el('div', { class: 'setting-row' }, [
      el('span', { class: 'setting-label', text: 'Clue accent (colour-blind safe)' }),
      el('div', { class: 'setting-ctl swatches' }),
    ]);
    const swatches = accentRow.querySelector('.swatches') as HTMLElement;
    for (const a of accents) {
      swatches.append(el('button', {
        class: `swatch${s.accent === a.id ? ' on' : ''}`,
        style: `background:${a.color}`,
        title: a.label,
        onclick: (ev) => {
          this.vm.updateSettings({ accent: a.id });
          swatches.querySelectorAll('.swatch').forEach((b) => b.classList.remove('on'));
          (ev.currentTarget as HTMLElement).classList.add('on');
        },
      }));
    }

    // subtitles
    const subRow = el('div', { class: 'setting-row' }, [
      el('span', { class: 'setting-label', text: 'Subtitles for key sounds' }),
      el('button', {
        class: `btn btn-sm toggle${s.subtitles ? ' on' : ''}`,
        text: s.subtitles ? 'On' : 'Off',
        onclick: () => {
          this.vm.updateSettings({ subtitles: !s.subtitles });
          this.render();
        },
      }),
    ]);

    // volume stubs
    const volRow = el('div', { class: 'setting-row muted' }, [
      el('span', { class: 'setting-label', text: 'Music & ambience' }),
      el('span', { class: 'setting-note', text: 'arrives with Milestone 6 (audio)' }),
    ]);

    wrap.append(sizeRow, hlRow, accentRow, subRow, volRow);
    this.body.append(wrap);
  }

  private renderSave(): void {
    const code = SaveSystem.encode(this.vm.state);
    const wrap = el('div', { class: 'save-list' });

    const out = el('textarea', { class: 'save-code', rows: 3, readonly: true });
    out.value = code;
    wrap.append(
      el('div', { class: 'setting-label', text: 'Export -- copy this code to carry your case' }),
      out,
      el('button', {
        class: 'btn',
        text: 'Copy code',
        onclick: async () => {
          out.select();
          try {
            await navigator.clipboard.writeText(code);
            this.vm.toast('Save code copied.', 'info');
          } catch {
            document.execCommand?.('copy');
            this.vm.toast('Code selected -- copy it manually.', 'info');
          }
        },
      })
    );

    const inp = el('textarea', { class: 'save-code', rows: 3 });
    wrap.append(
      el('div', { class: 'setting-label', text: 'Import -- paste a code and apply' }),
      inp,
      el('button', {
        class: 'btn',
        text: 'Apply code',
        onclick: () => {
          const decoded = SaveSystem.decode(inp.value);
          if (!decoded) {
            this.vm.toast('That code did not parse.', 'warn');
            return;
          }
          this.vm.state = decoded;
          this.vm.publishAll();
          void this.vm.save.saveNow(this.vm.state);
          this.vm.toast('Save applied. Reloading the scene...', 'info');
          setTimeout(() => window.location.reload(), 800);
        },
      })
    );

    wrap.append(
      el('div', { class: 'setting-label warn-label', text: 'Danger' }),
      el('button', {
        class: 'btn btn-danger',
        text: 'Erase the case and start fresh',
        onclick: async () => {
          if (!window.confirm('Erase all progress?')) return;
          await this.vm.save.clear();
          window.location.reload();
        },
      })
    );
    this.body.append(wrap);
  }

  private renderAbout(): void {
    this.body.append(
      el('div', { class: 'about-list' }, [
        el('p', { class: 'page-body', text: 'Ink & Ashes -- Build Two (The Precinct, Prologue & Act I). A data-driven MVVM detective game: a hand-drawn police-station hub where cases are chosen from Desk 14, Phaser 3 rooms + plain DOM overlays, all world and case content in JSON, autosave to IndexedDB.' }),
        el('p', { class: 'page-body', text: 'The world expands by data: each folder on the desk points at /content/cases/<id>/, and station hotspots, staff and conversations live in world.json. New cases are authored, not coded.' }),
        el('p', { class: 'page-body', text: 'Autosave runs after every clue, deduction, conversation beat and setting change.' }),
      ])
    );
  }
}
