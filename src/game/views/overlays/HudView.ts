/**
 * HudView -- persistent in-game chrome: title chip, Think/Notebook/Map/Menu
 * buttons, tool dock, clue counter, save flash and subtitles caption line.
 */

import { el, bindText, bindVisible } from '../../core/dom';
import { Observable, Computed } from '../../core/Observable';
import type { GameVM } from '../../viewmodels/GameVM';
import type { HintVM } from '../../viewmodels/HintVM';
import type { RoomVM } from '../../viewmodels/RoomVM';

export class HudView {
  readonly node: HTMLElement;
  private caption: HTMLElement;
  private captionTimer: ReturnType<typeof setTimeout> | null = null;
  private thinkBtn: HTMLButtonElement;
  private magBtn: HTMLButtonElement;
  private uvBtn: HTMLButtonElement;
  private roomVM: RoomVM | null = null;
  private lastTool: 'magnifier' | 'uv' = 'magnifier';

  constructor(
    private vm: GameVM,
    hintVM: HintVM,
    hooks: { openNotebook(): void; openMenu(): void; gotoHub(): void; gotoStation(): void }
  ) {
    this.node = el('div', { class: 'hud hidden' });

    // top-left title chip
    const topLeft = el('div', { class: 'hud-topleft' });
    topLeft.append(el('div', { class: 'hud-title', text: 'Ink & Ashes' }), el('div', { class: 'hud-room' }));
    this.node.append(topLeft);

    // top-right actions
    const topRight = el('div', { class: 'hud-topright' });
    this.thinkBtn = el('button', {
      class: 'hud-btn think',
      text: 'Think',
      onclick: () => {
        const ctx = vm.state.roomId ?? (vm.state.phase === 'hub' ? 'hall' : null);
        if (ctx) hintVM.show(ctx);
        else vm.toast('Walk into a room first, then Think.', 'info');
      },
    }) as HTMLButtonElement;
    topRight.append(
      this.thinkBtn,
      el('button', { class: 'hud-btn', text: 'Notebook', onclick: () => hooks.openNotebook() }),
      el('button', { class: 'hud-btn', text: 'Map', onclick: () => hooks.gotoHub() }),
      el('button', { class: 'hud-btn', text: 'Precinct', onclick: () => hooks.gotoStation() }),
      el('button', { class: 'hud-btn', text: 'Menu', onclick: () => hooks.openMenu() })
    );
    this.node.append(topRight);
    // Leaving the house is only sensible from the dollhouse map.
    const precinctBtn = topRight.children[3] as HTMLElement;
    bindVisible(precinctBtn, new Computed<boolean>(() => vm.phase$.value === 'hub', [vm.phase$]));

    // bottom-left tool dock
    const dock = el('div', { class: 'hud-dock' });
    this.magBtn = el('button', { class: 'tool-btn active', title: 'Magnifier' }) as HTMLButtonElement;
    this.magBtn.innerHTML = '<span class="tool-glyph">\u25CE</span><span class="tool-name">Magnifier</span>';
    this.magBtn.addEventListener('click', () => this.selectTool('magnifier'));
    this.uvBtn = el('button', { class: 'tool-btn locked', title: 'UV torch -- found later in the case' }) as HTMLButtonElement;
    this.uvBtn.innerHTML = '<span class="tool-glyph">\u25CF</span><span class="tool-name">UV torch</span>';
    this.uvBtn.addEventListener('click', () => {
      // The Act 1 closer grants the torch (flag tool_uv_granted); until then it
      // stays packed away.
      if (HudView.uvGranted(this.vm)) {
        this.lastTool = 'uv';
        this.selectTool('uv');
      } else {
        this.vm.toast('The UV torch is packed away for a later act.', 'info');
      }
    });
    dock.append(this.magBtn, this.uvBtn);
    this.node.append(dock);

    // The torch's lock follows its flag live (safe with no case active).
    const syncUv = () => {
      const granted = HudView.uvGranted(this.vm);
      this.uvBtn.classList.toggle('locked', !granted);
      this.uvBtn.title = granted ? 'UV torch' : 'UV torch -- found later in the case';
    };
    syncUv();
    this.vm.flags$.subscribe(syncUv);

    // bottom-right counter + save flash
    const bottomRight = el('div', { class: 'hud-bottomright' });
    const counter = el('div', { class: 'hud-counter' });
    bindText(counter, vm.clueCount$);
    const save = el('div', { class: 'hud-save', text: 'saved' });
    bindVisible(save, new Observable<boolean>(false));
    bottomRight.append(counter, save);
    this.node.append(bottomRight);

    // subtitles caption
    this.caption = el('div', { class: 'hud-caption hidden' });
    this.node.append(this.caption);

    vm.bus.on('caption', ({ text }) => this.showCaption(text));
    vm.bus.on('save:wrote', () => this.flashSave(save));
    vm.bus.on('gate:solved', () => this.thinkBtn.classList.remove('pulse'));

    // room label sync
    vm.roomId$.subscribe((id) => {
      const roomEl = topLeft.querySelector('.hud-room') as HTMLElement;
      roomEl.textContent = id ? (vm.repo.room(id)?.title ?? '') : 'The house at 7 Hollow Lane';
    });
  }

  /** Root wires the active RoomVM so the tool dock can drive it. */
  attachRoom(roomVM: RoomVM | null): void {
    this.roomVM = roomVM;
    // Keep the player's chosen tool across rooms (the torch stays only if granted).
    const tool = this.lastTool === 'uv' && !HudView.uvGranted(this.vm) ? 'magnifier' : this.lastTool;
    if (roomVM) roomVM.tool$.value = tool;
    this.selectTool(tool);
  }

  /** The Act 1 closer's grant flag, read safely (null when no case is active). */
  private static uvGranted(vm: GameVM): boolean {
    return Boolean(vm.cpOrNull()?.flags['tool_uv_granted']);
  }

  private selectTool(tool: 'magnifier' | 'uv'): void {
    if (!this.roomVM) return;
    this.lastTool = tool;
    this.roomVM.tool$.value = tool;
    this.magBtn.classList.toggle('active', tool === 'magnifier');
    this.uvBtn.classList.toggle('active', tool === 'uv');
  }

  private showCaption(text: string): void {
    if (!this.vm.state.settings.subtitles) return;
    this.caption.textContent = text;
    this.caption.classList.remove('hidden');
    if (this.captionTimer) clearTimeout(this.captionTimer);
    this.captionTimer = setTimeout(() => this.caption.classList.add('hidden'), 3200);
  }

  private flashSave(save: HTMLElement): void {
    save.classList.add('on');
    setTimeout(() => save.classList.remove('on'), 900);
  }
}
