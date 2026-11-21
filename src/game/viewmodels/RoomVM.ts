/**
 * RoomVM -- per-room presentation model. Derives the interactive hotspot
 * list (clues + doors) from content + progression, and answers "what happens
 * when the player taps this?" for the RoomScene.
 */

import { Computed, Observable } from '../core/Observable';
import type { Clue, Door, Rect, Room } from '../data/types';
import type { GameVM } from './GameVM';

export interface Hotspot {
  kind: 'clue' | 'door';
  id: string;
  spot: Rect;
  label: string;
  clue?: Clue;
  door?: Door;
  found: boolean;
  needsTool: 'magnifier' | 'uv' | 'tape' | null;
}

export class RoomVM {
  readonly room: Room;
  readonly title$: Observable<string>;
  readonly hotspots$: Observable<Hotspot[]>;
  readonly tool$: Observable<'magnifier' | 'uv' | null>;

  constructor(private game: GameVM, roomId: string) {
    const room = game.repo.room(roomId);
    if (!room) throw new Error(`Unknown room ${roomId}`);
    this.room = room;
    this.title$ = new Observable<string>(room.title);
    this.tool$ = new Observable<'magnifier' | 'uv' | null>('magnifier');

    this.hotspots$ = new Computed<Hotspot[]>(
      () => {
        const found = game.clues$.value;
        const flags = game.flags$.value;
        const clueSpots: Hotspot[] = game.repo
          .cluesForRoom(roomId)
          .map((clue) => ({
            kind: 'clue' as const,
            id: clue.id,
            spot: clue.spot as Rect,
            label: clue.name,
            clue,
            found: Boolean(found[clue.id]),
            needsTool: clue.tool ?? null,
          }));
        const doorSpots: Hotspot[] = room.doors.map((door) => ({
          kind: 'door' as const,
          id: `door:${door.to}`,
          spot: door.spot,
          label: door.label,
          door,
          found: false,
          needsTool: null,
        }));
        void flags;
        return [...clueSpots, ...doorSpots];
      },
      [game.clues$, game.flags$]
    );
  }

  /** Intent: player tapped a clue hotspot. Returns the clue if it may open. */
  tapClue(hotspot: Hotspot): { ok: true; clue: Clue } | { ok: false; reason: string } {
    if (!hotspot.clue) return { ok: false, reason: 'Nothing here.' };
    if (hotspot.needsTool && this.tool$.value !== hotspot.needsTool) {
      const names: Record<string, string> = { magnifier: 'your magnifier', uv: 'the UV torch', tape: 'the tape measure' };
      return { ok: false, reason: `This wants ${names[hotspot.needsTool]}.` };
    }
    return { ok: true, clue: hotspot.clue };
  }

  /**
   * Intent: player tapped a door. Decides open / gate / locked.
   */
  tapDoor(hotspot: Hotspot): { action: 'enter' } | { action: 'gate'; gateId: string } | { action: 'locked'; line: string } {
    const door = hotspot.door;
    if (!door) return { action: 'locked', line: 'It will not open.' };
    const target = this.game.repo.room(door.to);
    if (!target) return { action: 'locked', line: 'Not part of this house.' };

    // Not yet built (future acts)
    if (door.lockedAct && target.act > 1 && !this.game.unlockedRooms$.value.includes(door.to)) {
      return { action: 'locked', line: door.lockedLine ?? `That way opens later in the case.` };
    }

    // Gate-gated door
    if (door.lockedByGate) {
      const gateId = door.lockedByGate;
      if (this.game.gates$.value[gateId]) return { action: 'enter' };
      if (this.game.gateReady(gateId)) return { action: 'gate', gateId };
      const gate = this.game.repo.gate(gateId);
      const missing = gate ? gate.requiresClues.filter((c) => !this.game.hasClue(c)).length : 0;
      return {
        action: 'locked',
        line:
          door.lockedLine ??
          (missing > 0
            ? `Not yet -- the hall still has ${missing} thing${missing === 1 ? '' : 's'} to tell you.`
            : `Not yet. Look again before you open this door.`),
      };
    }

    // Act-1 exit door doubles as the Act-1 deduction trigger (Sergeant waits in the hall).
    if (door.to === 'hall' && this.game.gateReady('gate-act1') && !this.game.gateOffered('gate-act1')) {
      return { action: 'gate', gateId: 'gate-act1' };
    }
    return { action: 'enter' };
  }

  hintContext(): string {
    return this.room.id;
  }
}
