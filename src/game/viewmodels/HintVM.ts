/**
 * HintVM -- the three-tier "Think" button. Context is either a room id or a
 * gate id; hints come from JSON (rooms[].hints / gates use room-agnostic
 * entries via gates.json title context). Tiers unlock progressively.
 */

import { Observable } from '../core/Observable';
import type { HintSet } from '../data/types';
import type { GameVM } from './GameVM';

export class HintVM {
  readonly open$: Observable<boolean>;
  readonly context$: Observable<string | null>;
  readonly tier$: Observable<0 | 1 | 2 | 3>;
  readonly set$: Observable<HintSet | null>;

  constructor(private game: GameVM) {
    this.open$ = new Observable<boolean>(false);
    this.context$ = new Observable<string | null>(null);
    this.tier$ = new Observable<0 | 1 | 2 | 3>(0);
    this.set$ = new Observable<HintSet | null>(null);
  }

  show(context: string): void {
    const hints = this.game.repo.room(context)?.hints ?? this.gateHints(context);
    if (!hints) {
      this.game.toast('Think when you have a room or a deduction open.', 'info');
      return;
    }
    const used = this.game.state.hintsUsed[context] ?? 0;
    this.set$.value = hints;
    this.context$.value = context;
    this.tier$.value = Math.min(3, Math.max(1, used + 1)) as 1 | 2 | 3;
    this.open$.value = true;
    this.game.addHintUse(context);
  }

  private gateHints(gateId: string): HintSet | null {
    const gate = this.game.repo.gate(gateId);
    if (!gate) return null;
    // Gates reuse the room hints of the room the gate guards.
    const guardRoom = this.game.repo.roomList.find((r) =>
      r.doors.some((d) => d.lockedByGate === gateId)
    );
    if (guardRoom) return null; // room hints cover it
    return {
      tier1: `Read ${gate.title} aloud to yourself: who, what, when.`,
      tier2: gate.prompt,
      tier3: `Answers: ${gate.slots.map((s) => s.answer).join(' | ')}.`,
    };
  }

  stronger(): void {
    const t = this.tier$.value;
    if (t < 3) {
      this.tier$.value = (t + 1) as 2 | 3;
      if (this.context$.value) this.game.addHintUse(this.context$.value);
    }
  }

  close(): void {
    this.open$.value = false;
  }
}
