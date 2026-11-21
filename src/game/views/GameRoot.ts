/**
 * GameRoot -- composition root of the MVVM game.
 *
 * Wires: ContentRepository -> GameVM (state) -> ViewModels -> Views
 * (Phaser scenes for rooms/hub + plain DOM overlays for everything else).
 * The root owns phase routing and overlay z-ordering; it contains no case
 * logic whatsoever.
 */

import { el } from '../core/dom';
import { GameVM } from '../viewmodels/GameVM';
import { NotebookVM } from '../viewmodels/NotebookVM';
import { DialogueVM } from '../viewmodels/DialogueVM';
import { HintVM } from '../viewmodels/HintVM';
import { RoomVM } from '../viewmodels/RoomVM';
import { ContentRepository, ContentError } from '../data/ContentRepository';
import { PhaserHost } from './phaser/PhaserHost';
import type { SceneCtx } from './phaser/SceneCtx';
import { StartView } from './overlays/StartView';
import { PrologueView } from './overlays/PrologueView';
import { NotebookView } from './overlays/NotebookView';
import { CloseUpView } from './overlays/CloseUpView';
import { GateView } from './overlays/GateView';
import { DialogueView } from './overlays/DialogueView';
import { HudView } from './overlays/HudView';
import { MenuView } from './overlays/MenuView';
import { HintView } from './overlays/HintView';
import { ToastView } from './overlays/ToastView';
import { TransitionView } from './overlays/TransitionView';
import { EndCardView } from './overlays/EndCardView';
import type { NotebookTab } from '../viewmodels/NotebookVM';

export class GameRoot {
  private vm!: GameVM;
  private nb!: NotebookVM;
  private dvm!: DialogueVM;
  private hintVM!: HintVM;
  private phaser!: PhaserHost;
  private roomVM: RoomVM | null = null;
  private activeRoomId: string | null = null;

  private stage!: HTMLElement;
  private hostEl!: HTMLElement;
  private hud!: HudView;
  private prologueView!: PrologueView;
  private notebook!: NotebookView;
  private closeup!: CloseUpView;
  private gate!: GateView;
  private menu!: MenuView;
  private toasts!: ToastView;
  private wipe!: TransitionView;
  private endcard!: EndCardView;
  private startView: StartView | null = null;
  private unsubs: Array<() => void> = [];
  private destroyed = false;

  constructor(private container: HTMLElement) {}

  async start(): Promise<void> {
    this.container.innerHTML = '';
    this.stage = el('div', { class: 'stage' });

    // Boot splash (hand-drawn loading screen)
    const splash = el('div', { class: 'boot-splash' }, [
      el('div', { class: 'boot-circle' }),
      el('div', { class: 'boot-text', text: 'Opening the case file...' }),
    ]);
    this.stage.append(splash);

    this.hostEl = el('div', { class: 'phaser-host' });
    const overlayLayer = el('div', { class: 'overlay-layer' });
    this.stage.append(this.hostEl, overlayLayer);
    this.container.append(this.stage);

    let repo: ContentRepository;
    try {
      repo = await ContentRepository.load();
    } catch (err) {
      splash.remove();
      const problems = err instanceof ContentError ? err.problems : [String(err)];
      this.container.append(
        el('div', { class: 'boot-error' }, [
          el('h2', { text: 'The case file is damaged' }),
          ...problems.map((p) => el('p', { text: p })),
        ])
      );
      return;
    }

    this.vm = new GameVM(repo);
    this.nb = new NotebookVM(this.vm);
    this.dvm = new DialogueVM(this.vm);
    this.hintVM = new HintVM(this.vm);
    const mode = await this.vm.boot();
    this.vm.publishAll();

    await document.fonts.ready.catch(() => undefined);
    if (this.destroyed) return;

    /* ---- overlays ---- */
    this.hud = new HudView(this.vm, this.hintVM, {
      openNotebook: () => this.notebook.open(),
      openMenu: () => this.menu.open(),
      gotoHub: () => {
        if (this.vm.state.phase === 'room') {
          this.wipe.play(() => this.vm.gotoHub());
        }
      },
    });
    this.prologueView = new PrologueView(this.vm, () => {
      this.prologueView.destroy();
      this.vm.finishPrologue();
    });
    this.notebook = new NotebookView(this.vm, this.nb, (id) => void this.closeup.open(id));
    this.closeup = new CloseUpView(this.vm);
    this.gate = new GateView(this.vm, this.hintVM);
    this.menu = new MenuView(this.vm, () => this.menu.close());
    const hintView = new HintView(this.hintVM);
    this.toasts = new ToastView(this.vm);
    this.wipe = new TransitionView();
    this.endcard = new EndCardView(this.vm, () => {
      this.vm.gotoHub();
    });

    const layer = this.stage.querySelector('.overlay-layer') as HTMLElement;
    layer.append(
      this.hud.node,
      this.prologueView.node,
      this.notebook.node,
      this.closeup.node,
      this.gate.node,
      this.menu.node,
      hintView.node,
      this.endcard.node,
      this.wipe.node
    );
    this.stage.append(this.toasts.node);
    layer.append(this.buildDialogue());

    /* ---- phaser ---- */
    const ctx: SceneCtx = {
      vm: this.vm,
      hooks: {
        openClue: (clueId) => {
          this.vm.collectClue(clueId);
          void this.closeup.open(clueId);
        },
        openGate: (gateId) => this.gate.open(gateId),
        toast: (text, kind) => this.vm.toast(text, kind),
        wipe: (mid) => this.wipe.play(mid),
      },
    };
    this.phaser = new PhaserHost(this.hostEl, ctx);
    await this.phaser.ready();
    if (this.destroyed) return;
    splash.remove();

    /* ---- routing ---- */
    this.unsubs.push(
      this.vm.phase$.subscribe((phase) => this.route(phase))
    );
    // Room-to-room moves keep phase='room', so route on roomId changes as well.
    this.unsubs.push(
      this.vm.roomId$.subscribe((roomId) => {
        if (this.vm.phase$.value === 'room' && roomId) this.route('room');
      })
    );
    this.unsubs.push(
      this.vm.bus.on('gate:solved', ({ gateId }) => {
        const gate = this.vm.repo.gate(gateId);
        if (gate?.onSolve.endCard) {
          window.setTimeout(() => this.endcard.show(), 700);
        }
      })
    );
    this.unsubs.push(
      this.vm.bus.on('notebook:open', ({ tab }) => this.notebook.open(tab as NotebookTab))
    );

    // Escape closes the topmost overlay
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (!this.menu.node.classList.contains('hidden')) this.menu.close();
      else if (!this.notebook.node.classList.contains('hidden')) this.notebook.close();
      else if (!this.closeup.node.classList.contains('hidden')) this.closeup.close();
      else if (!this.gate.node.classList.contains('hidden')) {
        const id = this.gate['gateVM']?.gate.id;
        if (id) this.vm.markGateOffered(id);
        this.gate.close();
      }
    };
    window.addEventListener('keydown', onKey);
    this.unsubs.push(() => window.removeEventListener('keydown', onKey));

    /* ---- entry ---- */
    if (mode === 'fresh') {
      this.startView = new StartView(this.vm, mode, () => {
        this.startView?.close();
        this.startView = null;
        this.vm.startPrologue();
      });
      this.stage.append(this.startView.node);
    } else {
      this.route(this.vm.phase$.value);
    }

    // PWA: register the service worker in production static deploys.
    if (process.env.NODE_ENV === 'production' && 'serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => undefined);
    }

    // Debug/verification hook (harmless in production)
    (window as unknown as { __game: unknown }).__game = { vm: this.vm, root: this, game: this.phaser.game };
  }

  /** DialogueView is built lazily so the VM subscription order stays simple. */
  private buildDialogue(): HTMLElement {
    const dv = new DialogueView(this.dvm);
    return dv.node;
  }

  private route(phase: string): void {
    if (this.destroyed) return;
    switch (phase) {
      case 'prologue': {
        this.hud.node.classList.add('hidden');
        this.phaser.game.scene.stop('hub');
        this.phaser.game.scene.stop('room');
        break;
      }
      case 'hub': {
        this.prologueView.destroy();
        this.hud.node.classList.remove('hidden');
        this.roomVM = null;
        this.hud.attachRoom(null);
        this.phaser.showHub();
        break;
      }
      case 'room': {
        this.prologueView.destroy();
        this.hud.node.classList.remove('hidden');
        const roomId = this.vm.state.roomId;
        if (!roomId) return;
        if (this.activeRoomId === roomId && this.phaser.game.scene.isActive('room')) break;
        this.activeRoomId = roomId;
        this.roomVM = new RoomVM(this.vm, roomId);
        this.hud.attachRoom(this.roomVM);
        this.phaser.showRoom({ roomId, roomVM: this.roomVM, ctx: this.buildCtx() });
        break;
      }
      default:
        break;
    }
  }

  private buildCtx(): SceneCtx {
    return {
      vm: this.vm,
      hooks: {
        openClue: (clueId) => {
          this.vm.collectClue(clueId);
          void this.closeup.open(clueId);
        },
        openGate: (gateId) => this.gate.open(gateId),
        toast: (text, kind) => this.vm.toast(text, kind),
        wipe: (mid) => this.wipe.play(mid),
      },
    };
  }

  destroy(): void {
    this.destroyed = true;
    this.unsubs.forEach((u) => u());
    this.unsubs = [];
    try {
      this.phaser?.destroy();
    } catch {
      /* already gone */
    }
    this.container.innerHTML = '';
  }
}
