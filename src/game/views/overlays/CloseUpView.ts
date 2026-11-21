/**
 * CloseUpView -- the detailed pencil inset shown when tapping an object.
 * Loads the close-up SVG inline (so handwritten annotations render), supports
 * pinch/wheel zoom + drag pan, and nested "reveals" (search-the-pocket style
 * sub-clues defined in clues.json).
 */

import { el } from '../../core/dom';
import type { GameVM } from '../../viewmodels/GameVM';
import type { Clue, Reveal } from '../../data/types';

export class CloseUpView {
  readonly node: HTMLElement;
  private vm: GameVM;
  private stage: HTMLElement;   // zoom/pan target
  private captionEl: HTMLElement;
  private stack: Clue[] = [];
  private scale = 1;
  private tx = 0;
  private ty = 0;
  private pointers = new Map<number, { x: number; y: number }>();
  private pinchStart = 0;
  private closed = false;

  constructor(vm: GameVM) {
    this.vm = vm;
    this.node = el('div', { class: 'overlay closeup-overlay hidden' });
    const frame = el('div', { class: 'closeup-frame' });
    const head = el('div', { class: 'closeup-head' });
    const title = el('div', { class: 'closeup-title' });
    head.append(title, el('div', { class: 'closeup-zoomhint', text: 'pinch or scroll to zoom' }));
    this.stage = el('div', { class: 'closeup-stage' });
    this.captionEl = el('div', { class: 'closeup-caption' });
    const foot = el('div', { class: 'closeup-foot' });
    const backBtn = el('button', {
      class: 'btn btn-quiet',
      text: '\u2190 Back',
      onclick: () => this.goBack(),
    });
    foot.append(backBtn, el('span', { class: 'flex-space' }), el('button', {
      class: 'btn',
      text: 'Close',
      onclick: () => this.close(),
    }));
    frame.append(head, this.stage, this.captionEl, foot);
    this.node.append(frame);

    this.attachGestures();
  }

  async open(clueId: string): Promise<void> {
    const clue = this.vm.repo.clue(clueId);
    if (!clue) return;
    this.closed = false;
    this.stack = [clue];
    this.node.classList.remove('hidden');
    this.vm.bus.emit('closeup:open', { clueId });
    await this.render(clue);
  }

  private async goBack(): Promise<void> {
    if (this.stack.length > 1) {
      this.stack.pop();
      await this.render(this.stack[this.stack.length - 1]);
    } else {
      this.close();
    }
  }

  close(): void {
    this.closed = true;
    this.node.classList.add('hidden');
    this.stack = [];
    this.resetTransform();
    this.stage.innerHTML = '';
  }

  private async render(clue: Clue): Promise<void> {
    this.resetTransform();
    this.stage.innerHTML = '';
    const title = this.node.querySelector('.closeup-title') as HTMLElement;
    title.textContent = clue.closeup.title;

    if (clue.closeup.svg) {
      const holder = el('div', { class: 'closeup-svg-holder' });
      try {
        const svgText = await this.vm.repo.closeupSvg(clue.closeup.svg);
        if (!this.closed) {
          holder.innerHTML = svgText;
          this.stage.append(holder);
          this.attachReveals(clue.reveals ?? []);
        }
      } catch {
        this.stage.append(el('p', { class: 'page-body', text: '(the sketch is missing from the file)' }));
      }
    } else {
      this.stage.append(el('div', { class: 'closeup-doc', text: clue.note }));
    }

    this.captionEl.innerHTML = '';
    this.captionEl.append(
      el('p', { class: 'closeup-note', text: clue.note }),
      ...(clue.closeup.caption ? [el('p', { class: 'closeup-cap', text: clue.closeup.caption })] : [])
    );
  }

  /** Reveal spots are positioned as % of the 800x600 close-up space. */
  private attachReveals(reveals: Reveal[]): void {
    const holder = this.stage.querySelector('.closeup-svg-holder') as HTMLElement | null;
    if (!holder) return;
    for (const reveal of reveals) {
      const [x, y, w, h] = reveal.spot;
      const nested = this.vm.repo.clue(reveal.clue);
      if (!nested) continue;
      const btn = el('button', {
        class: `closeup-reveal${this.vm.hasClue(reveal.clue) ? ' taken' : ''}`,
        title: reveal.label,
        style: `left:${(x / 800) * 100}%;top:${(y / 600) * 100}%;width:${(w / 800) * 100}%;height:${(h / 600) * 100}%;`,
        onclick: () => {
          this.vm.collectClue(reveal.clue);
          const c = this.vm.repo.clue(reveal.clue);
          if (c) {
            this.stack.push(c);
            void this.render(c);
          }
        },
      });
      btn.append(el('span', { class: 'closeup-reveal-label', text: reveal.label }));
      holder.append(btn);
    }
  }

  /* ------------------------------------- gestures */

  private resetTransform(): void {
    this.scale = 1;
    this.tx = 0;
    this.ty = 0;
    this.apply();
  }

  private apply(): void {
    this.stage.style.transform = `translate(${this.tx}px, ${this.ty}px) scale(${this.scale})`;
  }

  private attachGestures(): void {
    this.node.addEventListener('wheel', (e) => {
      e.preventDefault();
      const prev = this.scale;
      this.scale = Math.min(4, Math.max(1, this.scale * (e.deltaY < 0 ? 1.12 : 0.9)));
      this.clampPan(prev);
      this.apply();
    }, { passive: false });

    this.stage.addEventListener('pointerdown', (e) => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2) {
        const pts = Array.from(this.pointers.values());
        this.pinchStart = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
      }
    });
    this.stage.addEventListener('pointermove', (e) => {
      const prev = this.pointers.get(e.pointerId);
      if (!prev) return;
      if (this.pointers.size === 1 && this.scale > 1) {
        this.tx += e.clientX - prev.x;
        this.ty += e.clientY - prev.y;
        this.clampPan(this.scale);
        this.apply();
      }
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (this.pointers.size === 2 && this.pinchStart > 0) {
        const pts = Array.from(this.pointers.values());
        const dist = Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y);
        const prevScale = this.scale;
        this.scale = Math.min(4, Math.max(1, this.scale * (dist / this.pinchStart)));
        this.pinchStart = dist;
        this.clampPan(prevScale);
        this.apply();
      }
    });
    const up = (e: PointerEvent) => {
      this.pointers.delete(e.pointerId);
      if (this.pointers.size < 2) this.pinchStart = 0;
    };
    this.stage.addEventListener('pointerup', up);
    this.stage.addEventListener('pointercancel', up);
  }

  private clampPan(_prev: number): void {
    const max = (this.scale - 1) * 300;
    this.tx = Math.min(max, Math.max(-max, this.tx));
    this.ty = Math.min(max * 0.6, Math.max(-max * 0.6, this.ty));
    if (this.scale === 1) {
      this.tx = 0;
      this.ty = 0;
    }
  }
}
