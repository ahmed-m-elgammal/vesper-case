/**
 * DialogueVM -- plays a JSON dialogue tree (dialogue.json) with line-by-line
 * advance and choices. In (inkjs) interrogations arrive in Milestone 4 and
 * will plug into the same overlay; this VM keeps the interface they need.
 */

import { Observable } from '../core/Observable';
import type { DialogueNode } from '../data/types';
import type { GameVM } from './GameVM';

export class DialogueVM {
  readonly active$: Observable<boolean>;
  readonly node$: Observable<DialogueNode | null>;
  readonly lineIndex$: Observable<number>;
  readonly line$ = new Observable<string>('');
  readonly typingDone$ = new Observable<boolean>(true);

  private queue: string[] = [];
  private onDone: (() => void) | null = null;
  private typeTimer: ReturnType<typeof setInterval> | null = null;

  constructor(private game: GameVM) {
    this.active$ = new Observable<boolean>(false);
    this.node$ = new Observable<DialogueNode | null>(null);
    this.lineIndex$ = new Observable<number>(0);

    // Root listens for play requests raised anywhere in the game.
    game.bus.on('dialogue:play', ({ dialogueId }) => this.play(dialogueId));
  }

  play(dialogueId: string, onDone?: () => void): void {
    const startNode = this.game.repo.dialogueNode(dialogueId);
    if (!startNode) {
      onDone?.();
      return;
    }
    this.onDone = onDone ?? null;
    this.setNode(startNode);
    this.active$.value = true;
  }

  private setNode(node: DialogueNode): void {
    this.node$.value = node;
    this.queue = node.lines.slice();
    this.lineIndex$.value = 0;
    if (node.flag) this.game.setFlag(node.flag);
    this.startLine(this.queue[0] ?? '');
  }

  private startLine(text: string): void {
    this.line$.value = '';
    this.typingDone$.value = false;
    if (this.typeTimer) clearInterval(this.typeTimer);
    let i = 0;
    this.typeTimer = setInterval(() => {
      i += 2;
      this.line$.value = text.slice(0, i);
      if (i >= text.length) {
        if (this.typeTimer) clearInterval(this.typeTimer);
        this.typeTimer = null;
        this.typingDone$.value = true;
      }
    }, 18);
  }

  /** Tap: finish typing, or advance to next line / node / choice wait. */
  advance(): void {
    if (!this.node$.value) return;
    if (!this.typingDone$.value) {
      if (this.typeTimer) clearInterval(this.typeTimer);
      this.typeTimer = null;
      this.line$.value = this.queue[this.lineIndex$.value] ?? '';
      this.typingDone$.value = true;
      return;
    }
    const node = this.node$.value;
    const nextIdx = this.lineIndex$.value + 1;
    if (nextIdx < this.queue.length) {
      this.lineIndex$.value = nextIdx;
      this.startLine(this.queue[nextIdx]);
      return;
    }
    if (node.choices && node.choices.length > 0) return; // wait for a choice tap
    this.finishNode(node);
  }

  choose(choiceIndex: number): void {
    const node = this.node$.value;
    if (!node?.choices) return;
    const choice = node.choices[choiceIndex];
    const nextNode = this.game.repo.dialogueNode(choice.next);
    if (nextNode) this.setNode(nextNode);
    else this.finishNode(node);
  }

  private finishNode(node: DialogueNode): void {
    this.active$.value = false;
    this.node$.value = null;
    if (node.flag) this.game.setFlag(node.flag);
    const cb = this.onDone;
    this.onDone = null;
    cb?.();
  }
}
