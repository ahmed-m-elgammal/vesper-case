/**
 * DialogueVM -- presentation-side adapter over the engine-neutral
 * DialogueRunner. Owns the typewriter, resolves "@locale.key" text, exposes
 * observable view state (beat, choices, evidence-presentation mode, bearing)
 * and keeps the legacy `play(dialogueId)` interface used by the prologue and
 * the gate flow.
 */

import { Observable } from '../core/Observable';
import { DialogueRunner, graphFromLegacyNodes } from '../dialogue/runner';
import { resolveText } from '../dialogue/loc';
import type { DialogueBeat, DialogueChoice, DialogueGraph, DialogueBeatSpeaker } from '../dialogue/types';
import type { GameVM } from './GameVM';

export interface DialogueBeatView {
  sp: DialogueBeatSpeaker;
  text: string;
}

export interface DialogueChoiceView {
  index: number;
  text: string;
  /** Opens the evidence picker instead of jumping straight to a node. */
  present?: boolean;
}

export class DialogueVM {
  readonly active$ = new Observable<boolean>(false);
  readonly speakerName$ = new Observable<string>('');
  readonly suspectId$ = new Observable<string | null>(null);
  readonly beat$ = new Observable<DialogueBeatView | null>(null);
  readonly typingDone$ = new Observable<boolean>(true);
  readonly choices$ = new Observable<DialogueChoiceView[]>([]);
  readonly presenting$ = new Observable<boolean>(false);
  /** Resolved bearing chip text, e.g. "Bearing: guarded" (empty when hidden). */
  readonly bearing$ = new Observable<string>('');

  private runner: DialogueRunner | null = null;
  private graph: DialogueGraph | null = null;
  private typeTimer: ReturnType<typeof setInterval> | null = null;
  private fullText = '';
  private legacyGraphCache: DialogueGraph | null = null;

  constructor(private game: GameVM) {
    // Root raises play requests from anywhere (prologue, gate solves).
    game.bus.on('dialogue:play', ({ dialogueId }: { dialogueId: string }) => this.play(dialogueId));
  }

  /** Open a conversation graph by id (Act-1 people use their suspect id). */
  openGraph(graphId: string): void {
    const graph = this.game.repo.dialogueGraph(graphId);
    if (!graph) return; // authoring safety: no graph -> no conversation
    this.start(graph);
  }

  /** Legacy entry point: a flat node id (prologue briefing, gate solves). */
  play(dialogueId: string, onDone?: () => void): void {
    const graph = this.game.repo.dialogueGraph(dialogueId);
    if (graph) {
      this.start(graph, onDone);
      return;
    }
    const node = this.game.repo.dialogueNode(dialogueId);
    if (!node) {
      onDone?.();
      return;
    }
    if (!this.legacyGraphCache) {
      this.legacyGraphCache = graphFromLegacyNodes(this.game.repo.bundle.dialogue, dialogueId);
    }
    this.start(this.legacyGraphCache, onDone, dialogueId);
  }

  /** Begin (or restart) the conversation at the graph's start node. */
  restart(): void {
    if (this.graph) this.start(this.graph);
  }

  close(): void {
    this.stopTyping();
    this.runner = null;
    this.graph = null;
    this.active$.value = false;
    this.presenting$.value = false;
    this.beat$.value = null;
    this.choices$.value = [];
    this.bearing$.value = '';
  }

  /* ----------------------------------------- presentation intents */

  /** Tap: finish typing instantly, otherwise advance the runner. */
  advance(): void {
    if (!this.runner) return;
    if (!this.typingDone$.value) {
      this.stopTyping();
      this.beat$.value = { sp: this.currentSp, text: this.fullText };
      this.typingDone$.value = true;
      return;
    }
    this.runner.advance();
  }

  choose(index: number): void {
    if (!this.runner) return;
    const choice = this.runner.visibleChoices()[index];
    if (!choice) return;
    if (choice.present) {
      this.presenting$.value = true; // picker opens; runner keeps waiting
      return;
    }
    this.runner.choose(index);
  }

  /** The player picked a clue from the evidence picker. */
  pickClue(clueId: string): void {
    if (!this.runner) return;
    this.presenting$.value = false;
    this.runner.present(clueId);
  }

  /** Put the evidence back without showing anything. */
  cancelPresent(): void {
    this.presenting$.value = false;
  }

  /* ----------------------------------------- internals */

  private currentSp: DialogueBeatSpeaker = 'npc';
  private pendingOnDone: (() => void) | null = null;

  private start(graph: DialogueGraph, onDone?: () => void, startAt?: string): void {
    this.stopTyping();
    this.graph = graph;
    this.pendingOnDone = onDone ?? null;
    this.active$.value = true;
    this.presenting$.value = false;
    this.speakerName$.value = resolveText(graph.speaker);
    const suspectId = graph.suspect ?? graph.id;
    this.suspectId$.value = suspectId;
    this.updateBearing();
    this.runner = new DialogueRunner(graph, this.game, (snap) => this.onSnapshot(snap, suspectId));
    this.runner.start(startAt);
  }

  private onSnapshot(
    snap: { beat: DialogueBeat | null; choices: DialogueChoice[]; closed: boolean },
    suspectId: string
  ): void {
    if (snap.closed) {
      const cb = this.pendingOnDone;
      this.close();
      cb?.();
      return;
    }
    if (snap.beat) {
      const sp = snap.beat.sp ?? 'npc';
      const text = resolveText(snap.beat.t);
      this.currentSp = sp;
      this.fullText = text;
      this.choices$.value = [];
      this.typingDone$.value = false;
      this.startTyping(text, sp);
    } else {
      this.stopTyping();
      this.beat$.value = null;
      this.currentSp = 'npc';
      this.typingDone$.value = true;
      this.choices$.value = snap.choices.map((c, i) => ({
        index: i,
        text: resolveText(c.text),
        present: Boolean(c.present),
      }));
    }
    this.updateBearing(suspectId);
  }

  private updateBearing(suspectId?: string): void {
    const id = suspectId ?? this.suspectId$.value;
    if (!id || !this.game.repo.suspect(id)) {
      this.bearing$.value = '';
      return;
    }
    const label = resolveText(this.game.bearingKey(id));
    this.bearing$.value = `${resolveText('@dlg.ui.bearing')}: ${label}`;
  }

  private startTyping(text: string, sp: DialogueBeatSpeaker): void {
    this.stopTyping();
    this.beat$.value = { sp, text: '' };
    if (sp === 'narrator') {
      // Narration reads as written; no typewriter.
      this.beat$.value = { sp, text };
      this.typingDone$.value = true;
      return;
    }
    let i = 0;
    this.typeTimer = setInterval(() => {
      i += 2;
      this.beat$.value = { sp, text: text.slice(0, i) };
      if (i >= text.length) this.stopTyping(true);
    }, 18);
  }

  private stopTyping(done = false): void {
    if (this.typeTimer) {
      clearInterval(this.typeTimer);
      this.typeTimer = null;
    }
    if (done) {
      this.typingDone$.value = true;
      if (this.beat$.value) this.beat$.value = { sp: this.beat$.value.sp, text: this.fullText };
    }
  }
}
