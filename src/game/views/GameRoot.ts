/**
 * GameRoot -- composition root of the MVVM game.
 *
 * Wires: WorldRepository + ContentRepository -> GameVM (state) -> ViewModels
 * -> Views (Phaser scenes for precinct/rooms/hub + plain DOM overlays for
 * everything else). The root owns phase routing and overlay z-ordering; it
 * contains no case logic whatsoever.
 */

import { el } from '../core/dom';
import { GameVM } from '../viewmodels/GameVM';
import { NotebookVM } from '../viewmodels/NotebookVM';
import { DialogueVM } from '../viewmodels/DialogueVM';
import { HintVM } from '../viewmodels/HintVM';
import { RoomVM } from '../viewmodels/RoomVM';
import { ContentRepository, WorldRepository } from '../data/ContentRepository';
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
import { CaseFilesView } from './overlays/CaseFilesView';
import { CareerView } from './overlays/CareerView';
import { PromotionCard } from './overlays/PromotionCard';
import { NarrationCard } from './overlays/NarrationCard';
import { StationIntroCard } from './overlays/StationIntroCard';
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
  private prologueView: PrologueView | null = null;
  private notebook!: NotebookView;
  private closeup!: CloseUpView;
  private gate!: GateView;
  private menu!: MenuView;
  private toasts!: ToastView;
  private wipe!: TransitionView;
  private endcard!: EndCardView;
  private caseFiles!: CaseFilesView;
  private careerView!: CareerView;
  private introCard: StationIntroCard | null = null;
  private narrationCard: NarrationCard | null = null;
  private promoCard: PromotionCard | null = null;
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
      el('div', { class: 'boot-text', text: 'Unlocking the precinct...' }),
    ]);
    this.stage.append(splash);

    this.hostEl = el('div', { class: 'phaser-host' });
    const overlayLayer = el('div', { class: 'overlay-layer' });
    this.stage.append(this.hostEl, overlayLayer);
    this.container.append(this.stage);

    let world: WorldRepository;
    let initialRepo: ContentRepository;
    try {
      world = await WorldRepository.load();
      // Preload the first available folder so the prologue/dialogue are ready
      // even before the player picks a file (swapping repos later is cheap).
      const firstAvailable = world.caseList.find((c) => c.status === 'available')?.id ?? 'vesper';
      initialRepo = await ContentRepository.loadCase(firstAvailable, world.locale);
    } catch (err) {
      splash.remove();
      const problems = err instanceof Error && 'problems' in err ? (err as { problems: string[] }).problems : [String(err)];
      this.container.append(
        el('div', { class: 'boot-error' }, [
          el('h2', { text: 'The case file is damaged' }),
          ...problems.map((p) => el('p', { text: p })),
        ])
      );
      return;
    }

    this.vm = new GameVM(initialRepo, world);
    this.nb = new NotebookVM(this.vm);
    this.dvm = new DialogueVM(this.vm);
    this.hintVM = new HintVM(this.vm);
    const mode = await this.vm.boot();
    // Resumed save pointing at another folder: swap the bundle before routing.
    if (mode === 'resumed' && this.vm.state.activeCaseId && this.vm.state.activeCaseId !== initialRepo.caseId) {
      try {
        const repo = await ContentRepository.loadCase(this.vm.state.activeCaseId, world.locale);
        this.vm.attachRepo(repo);
      } catch {
        this.vm.toast('That case folder is missing from the archive.', 'warn');
      }
    }
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
      gotoStation: () => {
        if (this.vm.state.phase === 'hub') {
          this.wipe.play(() => this.vm.gotoStation());
        }
      },
    });
    this.notebook = new NotebookView(this.vm, this.nb, (id) => void this.closeup.open(id));
    this.closeup = new CloseUpView(this.vm);
    this.gate = new GateView(this.vm, this.hintVM);
    this.menu = new MenuView(this.vm, () => this.menu.close());
    const hintView = new HintView(this.hintVM);
    this.toasts = new ToastView(this.vm);
    this.wipe = new TransitionView();
    this.endcard = new EndCardView(this.vm, (closeTo) => {
      // Act closers walk the player back into the house; only the finale card
      // sends them to the precinct (the Captain, the count, the ceremony).
      if (closeTo === 'hub') {
        this.wipe.play(() => this.vm.gotoHub());
      } else {
        this.vm.gotoStation();
      }
    });
    this.caseFiles = new CaseFilesView(this.vm, {
      onTakeCase: (id) => void this.vm.selectCase(id),
    });
    this.careerView = new CareerView(this.vm);

    const layer = this.stage.querySelector('.overlay-layer') as HTMLElement;
    layer.append(
      this.hud.node,
      this.notebook.node,
      this.closeup.node,
      this.gate.node,
      this.menu.node,
      this.caseFiles.node,
      this.careerView.node,
      hintView.node,
      this.endcard.node,
      this.wipe.node
    );
    this.stage.append(this.toasts.node);
    layer.append(this.buildDialogue());

    /* ---- phaser ---- */
    // UI-block watcher: the station scenes freeze the walking detective while
    // any full-screen overlay (dialogue, notebook, desk drawer, cards...) is up.
    // Every blocking view carries the 'overlay' class; the hint chip does not
    // count, and '.hidden' nodes never do.
    let uiBlockCount = 0;
    const isBlockingOverlay = (n: Element) =>
      n.classList.contains('overlay') && !n.classList.contains('hint-overlay') && !n.classList.contains('hidden');
    const recountOverlays = () => {
      uiBlockCount = Array.from(this.stage.querySelectorAll('.overlay')).filter(isBlockingOverlay).length;
    };
    const overlayObserver = new MutationObserver(recountOverlays);
    overlayObserver.observe(this.stage, { subtree: true, childList: true, attributes: true, attributeFilter: ['class'] });
    recountOverlays();
    this.unsubs.push(() => overlayObserver.disconnect());

    const ctx: SceneCtx = {
      vm: this.vm,
      isUIBlocked: () => uiBlockCount > 0,
      hooks: {
        openClue: (clueId) => {
          this.vm.collectClue(clueId);
          void this.closeup.open(clueId);
        },
        openGate: (gateId) => this.gate.open(gateId),
        openDialogue: (speakerId) => this.dvm.openGraph(speakerId),
        openCaseFiles: () => this.caseFiles.open(),
        openCareer: () => this.careerView.open(),
        narrate: (payload) => this.playNarration(payload),
        toast: (text, kind) => this.vm.toast(text, kind),
        wipe: (mid) => this.wipe.play(mid),
      },
    };
    this.phaser = new PhaserHost(this.hostEl, ctx);
    await this.phaser.ready();
    if (this.destroyed) return;
    splash.remove();

    /* ---- routing ---- */
    this.unsubs.push(this.vm.phase$.subscribe((phase) => this.route(phase)));
    // Room-to-room moves keep phase='room', so route on roomId changes as well.
    this.unsubs.push(
      this.vm.roomId$.subscribe((roomId) => {
        if (this.vm.state.phase === 'room' && roomId) this.route('room');
      })
    );
    // Station level swaps (street <-> bullpen) re-render the station.
    this.unsubs.push(
      this.vm.stationLevel$.subscribe((level) => {
        if (this.vm.state.phase === 'station') this.phaser.showStation(level);
      })
    );
    this.unsubs.push(
      this.vm.bus.on('gate:solved', ({ gateId }) => {
        const gate = this.vm.repo.gate(gateId);
        if (gate?.onSolve.endCard) {
          // Only a finale end card closes the folder; act closers just turn the page.
          const card = this.vm.repo.endCard(gate.onSolve.endCard);
          if (card?.finale) this.vm.markCaseSolved();
          window.setTimeout(() => this.endcard.show(gate.onSolve.endCard), 700);
        }
      })
    );
    this.unsubs.push(this.vm.bus.on('notebook:open', ({ tab }) => this.notebook.open(tab as NotebookTab)));

    // Imported save codes route after the fact (loads a different folder first).
    const onRouteEvent = (e: Event) => {
      const detail = (e as CustomEvent<{ phase: string }>).detail;
      void this.routeAfterImport(detail?.phase);
    };
    window.addEventListener('game:route', onRouteEvent);
    this.unsubs.push(() => window.removeEventListener('game:route', onRouteEvent));

    // Escape closes the topmost overlay (evidence picker -> dialogue -> ...)
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return;
      if (this.dvm.presenting$.value) this.dvm.cancelPresent();
      else if (this.dvm.active$.value) this.dvm.close();
      else if (!this.menu.node.classList.contains('hidden')) this.menu.close();
      else if (!this.notebook.node.classList.contains('hidden')) this.notebook.close();
      else if (!this.closeup.node.classList.contains('hidden')) this.closeup.close();
      else if (!this.gate.node.classList.contains('hidden')) {
        const id = this.gate['gateVM']?.gate.id;
        if (id) this.vm.markGateOffered(id);
        this.gate.close();
      } else if (this.caseFiles.isOpen) this.caseFiles.close();
      else if (this.careerView.isOpen) this.careerView.close();
    };
    window.addEventListener('keydown', onKey);
    this.unsubs.push(() => window.removeEventListener('keydown', onKey));

    /* ---- entry ---- */
    if (mode === 'fresh') {
      this.startView = new StartView(
        this.vm,
        mode,
        () => {
          this.startView?.close();
          this.startView = null;
          this.vm.beginNightShift();
        },
        () => {
          this.startView?.close();
          this.startView = null;
          this.vm.gotoStation();
        }
      );
      this.stage.append(this.startView.node);
    } else {
      this.route(this.vm.state.phase);
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
    const dv = new DialogueView(this.dvm, this.nb, this.vm);
    return dv.node;
  }

  /** The prologue overlay is created on demand (its bundle follows the case). */
  private ensurePrologue(): PrologueView {
    if (!this.prologueView) {
      this.prologueView = new PrologueView(this.vm, () => {
        this.prologueView?.destroy();
        this.prologueView = null;
        this.vm.finishPrologue();
      });
      (this.stage.querySelector('.overlay-layer') as HTMLElement).append(this.prologueView.node);
    }
    return this.prologueView;
  }

  private destroyPrologue(): void {
    this.prologueView?.destroy();
    this.prologueView = null;
  }

  private maybeShowIntro(): void {
    if (this.vm.state.introSeen || this.introCard) return;
    this.introCard = new StationIntroCard(this.vm, () => {
      this.introCard = null;
    });
    this.stage.append(this.introCard.node);
  }

  /** Once-only level narration (data from world.json scenes' firstEntry). */
  private playNarration(payload: { flag: string; lines: string[] }): void {
    if (this.narrationCard) return;
    this.narrationCard = new NarrationCard('Old Town Precinct', payload.lines, () => {
      this.narrationCard = null;
      this.vm.setWorldFlag(payload.flag);
    });
    this.stage.append(this.narrationCard.node);
  }

  /** The commendation ceremony, if a promotion is waiting when the player returns. */
  private maybeShowPromotion(): void {
    const pending = this.vm.pendingPromotion();
    if (!pending || this.promoCard) return;
    const rank = this.vm.careerRanks.find((r) => r.id === pending);
    if (!rank) return;
    this.promoCard = new PromotionCard(this.vm, rank, () => {
      this.promoCard = null;
      this.vm.acknowledgePromotion();
    });
    this.stage.append(this.promoCard.node);
  }

  private async routeAfterImport(phase: string | undefined): Promise<void> {
    const state = this.vm.state;
    if (state.activeCaseId && this.vm.repo.caseId !== state.activeCaseId) {
      try {
        const repo = await ContentRepository.loadCase(state.activeCaseId, this.vm.world.locale);
        this.vm.attachRepo(repo);
        this.vm.publishAll();
      } catch {
        this.vm.toast('That case folder is missing from the archive.', 'warn');
      }
    }
    this.route(phase ?? state.phase);
  }

  private route(phase: string): void {
    if (this.destroyed) return;
    switch (phase) {
      case 'station': {
        this.destroyPrologue();
        this.hud.node.classList.add('hidden');
        this.roomVM = null;
        this.activeRoomId = null;
        this.hud.attachRoom(null);
        this.phaser.showStation(this.vm.state.stationLevel);
        this.maybeShowIntro();
        this.maybeShowPromotion();
        break;
      }
      case 'prologue': {
        if (this.introCard) {
          this.introCard.node.remove();
          this.introCard = null;
        }
        if (this.narrationCard) {
          this.narrationCard.node.remove();
          this.narrationCard = null;
        }
        if (this.promoCard) {
          this.promoCard.node.remove();
          this.promoCard = null;
        }
        this.hud.node.classList.add('hidden');
        this.phaser.game.scene.stop('station-ext');
        this.phaser.game.scene.stop('station-int');
        this.phaser.game.scene.stop('station-up');
        this.phaser.game.scene.stop('hub');
        this.phaser.game.scene.stop('room');
        this.ensurePrologue();
        break;
      }
      case 'hub': {
        this.destroyPrologue();
        if (this.introCard) {
          this.introCard.node.remove();
          this.introCard = null;
        }
        if (this.narrationCard) {
          this.narrationCard.node.remove();
          this.narrationCard = null;
        }
        this.hud.node.classList.remove('hidden');
        this.roomVM = null;
        this.activeRoomId = null;
        this.hud.attachRoom(null);
        this.phaser.showHub();
        break;
      }
      case 'room': {
        this.destroyPrologue();
        this.hud.node.classList.remove('hidden');
        const roomId = this.vm.state.roomId;
        if (!roomId) return;
        // route() fires from BOTH roomId$ and phase$ on every room entry; the
        // guard must not depend on scene.isActive(), which is false while the
        // scene is still booting -- that race used to build two RoomVMs (the
        // scene kept one, the HUD the other) and desynced tool selection.
        if (this.activeRoomId === roomId) break;
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
        openDialogue: (speakerId) => this.dvm.openGraph(speakerId),
        openCaseFiles: () => this.caseFiles.open(),
        openCareer: () => this.careerView.open(),
        narrate: (payload) => this.playNarration(payload),
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
