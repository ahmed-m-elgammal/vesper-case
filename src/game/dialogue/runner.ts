/**
 * DialogueRunner -- an engine-neutral conversation state machine.
 *
 * Walks a DialogueGraph node/choice graph: plays beats (typed out by the
 * presentation layer), waits on filtered choices, jumps via next/close/end,
 * applies effects through the DialogueContext, and routes evidence
 * presentation through the graph's reaction table.
 *
 * No DOM, no Phaser, no ViewModels -- it can be driven from a browser view,
 * a Node test, or any future engine. All mutations of real game state happen
 * through the injected DialogueContext.
 */

import { evalCondition } from './conditions';
import type {
  DialogueBeat,
  DialogueChoice,
  DialogueContext,
  DialogueEffects,
  DialogueGraph,
  DialogueNodeV2,
  LegacyDialogueNode,
} from './types';

export interface RunnerSnapshot {
  /** Current beat to display (null while waiting for a choice or closed). */
  beat: DialogueBeat | null;
  nodeId: string;
  /** Choices offered right now (only when beat === null and not closed). */
  choices: DialogueChoice[];
  /** True when the conversation has ended. */
  closed: boolean;
  /** Effects that fired on entering the current node (for the host to observe). */
  enteredNodeId: string;
}

export class DialogueRunner {
  private nodeId = '';
  private beatIndex = 0;
  private choices: DialogueChoice[] = [];
  private closedFlag = false;

  constructor(
    private graph: DialogueGraph,
    private ctx: DialogueContext,
    private onChange: (snap: RunnerSnapshot) => void
  ) {}

  start(startId?: string): void {
    this.enterNode(startId ?? this.graph.start);
  }

  /** Presentation-layer tap: finish typing is handled upstream; here move on. */
  advance(): void {
    if (this.closedFlag) return;
    const node = this.currentNode();
    if (!node) return this.close();
    const beats = node.beats ?? [];
    if (this.beatIndex < beats.length) {
      this.beatIndex += 1;
      if (this.beatIndex < beats.length) {
        this.emit(beats[this.beatIndex]);
        return;
      }
      // fall through: beats exhausted -- resolve choices / next / end in one pass
    }
    if (node.choices && node.choices.length > 0) {
      this.choices = node.choices.filter((c) => evalCondition(c.cond, this.ctx));
      this.emit(null);
      return;
    }
    if (node.end) return this.close();
    if (node.next) return this.enterNode(node.next);
    // Dead end with no choices/next/end -> close (authoring safety)
    this.close();
  }

  /** Player picked a visible choice (index into the last filtered list). */
  choose(index: number): void {
    const choice = this.choices[index];
    if (!choice) return;
    if (choice.effects) this.ctx.applyEffects(choice.effects);
    if (choice.close) return this.close();
    if (choice.present) {
      // Presentation mode: the host opens its evidence picker and calls
      // present(clueId) -- snapshot stays waiting on choices meanwhile.
      this.emit(null);
      return;
    }
    if (choice.next) return this.enterNode(choice.next);
    this.close();
  }

  /** The choice the host is waiting on (so it can open the picker). */
  pendingPresentChoice(): DialogueChoice | null {
    const node = this.currentNode();
    if (!node?.choices) return null;
    const visible = node.choices.filter((c) => evalCondition(c.cond, this.ctx));
    const idx = visible.findIndex((c) => Boolean(c.present));
    return idx >= 0 ? visible[idx] : null;
  }

  /** Currently offered choices (filtered by conditions) -- read-only view. */
  visibleChoices(): DialogueChoice[] {
    return this.choices.slice();
  }

  /** Player showed a piece of evidence. Route through the reaction table. */
  present(clueId: string): void {
    if (this.closedFlag) return;
    const reaction = this.graph.reactions?.[clueId];
    const miss = this.graph.presents?.miss;
    const again = this.graph.presents?.again;
    if (reaction) {
      if (reaction.once && this.ctx.hasFlag(reaction.once)) {
        if (again) return this.enterNode(again);
        if (miss) return this.enterNode(miss);
        return this.close();
      }
      if (reaction.once) this.ctx.applyEffects({ setFlags: [reaction.once] });
      return this.enterNode(reaction.next);
    }
    if (miss) return this.enterNode(miss);
    this.close();
  }

  /** Force-end (Escape key, door taps, etc.). */
  close(): void {
    this.closedFlag = true;
    this.choices = [];
    this.emit(null);
  }

  isClosed(): boolean {
    return this.closedFlag;
  }

  /* ------------------------------------------- internals */

  private currentNode(): DialogueNodeV2 | undefined {
    return this.graph.nodes[this.nodeId];
  }

  private enterNode(id: string): void {
    const node = this.graph.nodes[id];
    if (!node) {
      // Authoring safety: unknown node -> close instead of hanging.
      this.close();
      return;
    }
    this.nodeId = id;
    this.choices = [];
    if (node.effects) this.ctx.applyEffects(node.effects);
    const beats = node.beats ?? [];
    this.beatIndex = 0;
    if (beats.length === 0) {
      // Empty node: resolve immediately to choices / next / end.
      this.advance();
      return;
    }
    this.emit(beats[0]);
  }

  private emit(beat: DialogueBeat | null): void {
    this.onChange({
      beat,
      nodeId: this.nodeId,
      choices: beat ? [] : this.choices,
      closed: this.closedFlag,
      enteredNodeId: this.nodeId,
    });
  }
}

/**
 * Convert the legacy flat node list (build one's briefing dialogues) into a
 * graph so the whole runtime speaks one format. Legacy nodes map to beats of
 * the graph speaker; `flag` becomes an entering effect.
 */
export function graphFromLegacyNodes(nodes: LegacyDialogueNode[], startId: string): DialogueGraph {
  const byId = new Map<string, LegacyDialogueNode>();
  for (const n of nodes) byId.set(n.id, n);
  const start = byId.get(startId) ?? nodes[0];
  const out: Record<string, DialogueNodeV2> = {};
  for (const n of nodes) {
    const node: DialogueNodeV2 = {
      beats: (n.lines ?? []).map((t) => ({ sp: 'npc' as const, t })),
      choices: n.choices?.map((c) => ({ text: c.text, next: c.next })),
      next: n.next,
      end: !n.choices?.length && !n.next,
      effects: n.flag ? { setFlags: [n.flag] } : undefined,
    };
    out[n.id] = node;
  }
  return {
    id: start?.id ?? 'legacy',
    speaker: start?.speaker ?? '',
    start: start?.id ?? 'legacy',
    nodes: out,
  };
}
