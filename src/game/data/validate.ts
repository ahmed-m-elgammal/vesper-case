/**
 * Hand-rolled runtime validators for the content JSON. The authoritative
 * machine-readable schemas live in /public/content/schemas/*.schema.json;
 * these checks give friendly errors at boot (dev overlay) without pulling a
 * validator dependency into the bundle.
 */

import type {
  CaseMeta,
  Chain,
  Clue,
  ContentBundle,
  DialogueNode,
  Gate,
  ProloguePage,
  Room,
  Suspect,
  TimelineEntry,
} from './types';

function isStr(v: unknown): v is string {
  return typeof v === 'string' && v.length > 0;
}
function isRect(v: unknown): v is [number, number, number, number] {
  return (
    Array.isArray(v) &&
    v.length === 4 &&
    v.every((n) => typeof n === 'number' && Number.isFinite(n))
  );
}
function assert(condition: unknown, message: string, errors: string[]): void {
  if (!condition) errors.push(message);
}

function obj(v: unknown): Record<string, unknown> {
  return (v ?? {}) as Record<string, unknown>;
}

export function validateBundle(raw: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const req = (v: unknown, what: string) => {
    assert(Array.isArray(v) && v.length > 0, `${what} must be a non-empty array`, errors);
    return Array.isArray(v) ? v : [];
  };

  /* case */
  const c = obj(raw.case);
  assert(isStr(c.title), 'case.title missing', errors);
  assert(isStr(obj(c.victim).name), 'case.victim.name missing', errors);

  /* suspects */
  const suspectIds = new Set<string>();
  req(raw.suspects, 'suspects').forEach((s, i) => {
    const so = obj(s);
    assert(isStr(so.id), `suspects[${i}].id missing`, errors);
    if (isStr(so.id)) suspectIds.add(so.id);
    assert(isStr(so.name), `suspects[${i}].name missing`, errors);
    assert(isStr(so.statement), `suspects[${i}].statement missing`, errors);
    ['secret', 'lie', 'redHerring'].forEach((k) =>
      assert(isStr(so[k]), `suspects[${i}].${k} missing (Act 5 data must still exist)`, errors)
    );
  });

  /* rooms */
  const roomIds = new Set<string>();
  const rooms = req(raw.rooms, 'rooms');
  rooms.forEach((r, i) => {
    const ro = obj(r);
    assert(isStr(ro.id), `rooms[${i}].id missing`, errors);
    if (isStr(ro.id)) roomIds.add(ro.id);
    assert(typeof ro.width === 'number' && typeof ro.height === 'number', `rooms[${i}] size missing`, errors);
    assert(Array.isArray(ro.layers), `rooms[${i}].layers must be an array`, errors);
    (Array.isArray(ro.layers) ? ro.layers : []).forEach((l, j) => {
      const lo = obj(l);
      assert(isStr(lo.key) && isStr(lo.src), `rooms[${i}].layers[${j}] key/src missing`, errors);
    });
    assert(isRect(ro.hubPlate), `rooms[${i}].hubPlate missing`, errors);
    ['tier1', 'tier2', 'tier3'].forEach((k) =>
      assert(isStr(obj(ro.hints)[k]), `rooms[${i}].hints.${k} missing`, errors)
    );
  });

  /* clues */
  const clueIds = new Set<string>();
  const clues = req(raw.clues, 'clues');
  clues.forEach((cl, i) => {
    const clo = obj(cl);
    assert(isStr(clo.id), `clues[${i}].id missing`, errors);
    if (isStr(clo.id)) clueIds.add(clo.id);
    assert(isStr(clo.name), `clues[${i}].name missing`, errors);
    assert(isStr(clo.note) && isStr(clo.toast), `clues[${i}].note/toast missing`, errors);
    assert(clo.spot === null || isRect(clo.spot), `clues[${i}].spot must be rect or null`, errors);
    if (typeof clo.room === 'string') {
      assert(roomIds.has(clo.room), `clues[${i}].room "${clo.room}" is not a known room`, errors);
    }
    const cu = obj(clo.closeup);
    assert(isStr(cu.title), `clues[${i}].closeup.title missing`, errors);
    assert(Array.isArray(clo.chains), `clues[${i}].chains must be an array`, errors);
    if (Array.isArray(clo.reveals)) {
      clo.reveals.forEach((rv, j) => {
        const rvo = obj(rv);
        assert(isRect(rvo.spot), `clues[${i}].reveals[${j}].spot missing`, errors);
        assert(isStr(rvo.clue), `clues[${i}].reveals[${j}].clue missing`, errors);
      });
    }
  });
  clues.forEach((cl) => {
    const clo = obj(cl);
    if (Array.isArray(clo.reveals)) {
      clo.reveals.forEach((rv, j) => {
        const id = obj(rv).clue;
        assert(clueIds.has(String(id)), `clues[${clo.id}].reveals[${j}] -> unknown clue "${id}"`, errors);
      });
    }
  });

  /* gates */
  const gateIds = new Set<string>();
  req(raw.gates, 'gates').forEach((g, i) => {
    const go = obj(g);
    assert(isStr(go.id), `gates[${i}].id missing`, errors);
    if (isStr(go.id)) gateIds.add(go.id);
    assert(isStr(go.prompt) && isStr(go.title), `gates[${i}].title/prompt missing`, errors);
    const slots = req(go.slots, `gates[${i}].slots`);
    slots.forEach((s, j) => {
      const so = obj(s);
      assert(isStr(so.answer), `gates[${i}].slots[${j}].answer missing`, errors);
      const chips = req(so.chips, `gates[${i}].slots[${j}].chips`);
      assert(
        chips.map(String).includes(String(so.answer)),
        `gates[${i}].slots[${j}] answer not in its chips`,
        errors
      );
    });
    req(go.requiresClues, `gates[${i}].requiresClues`).forEach((id) =>
      assert(clueIds.has(String(id)), `gates[${i}] requires unknown clue "${id}"`, errors)
    );
  });

  /* rooms -> doors / gates */
  rooms.forEach((r, i) => {
    const ro = obj(r);
    req(ro.doors, `rooms[${i}].doors`).forEach((d, j) => {
      const dobj = obj(d);
      const to = dobj.to;
      assert(isStr(to), `rooms[${i}].doors[${j}].to missing`, errors);
      if (isStr(to)) {
        assert(roomIds.has(to), `rooms[${i}].doors[${j}] -> unknown room "${to}"`, errors);
        if (isStr(dobj.lockedByGate)) {
          assert(gateIds.has(dobj.lockedByGate), `rooms[${i}].doors[${j}] unknown gate "${dobj.lockedByGate}"`, errors);
        }
      }
      assert(isRect(dobj.spot), `rooms[${i}].doors[${j}].spot missing`, errors);
    });
  });

  /* timeline */
  req(raw.timeline, 'timeline').forEach((t, i) => {
    const to = obj(t);
    assert(isStr(to.id) && isStr(to.time) && isStr(to.text), `timeline[${i}] incomplete`, errors);
    const rb = String(to.revealedBy ?? '');
    if (rb.startsWith('clue:')) {
      assert(clueIds.has(rb.slice(5)), `timeline[${i}] reveals unknown clue "${rb}"`, errors);
    }
  });

  /* prologue pages */
  req(raw.prologue, 'prologue').forEach((p, i) => {
    const po = obj(p);
    assert(isStr(po.id) && isStr(po.template), `prologue[${i}] id/template missing`, errors);
  });

  /* dialogue */
  const nodeIds = new Set<string>();
  req(raw.dialogue, 'dialogue').forEach((n, i) => {
    const no = obj(n);
    assert(isStr(no.id), `dialogue[${i}].id missing`, errors);
    if (isStr(no.id)) nodeIds.add(no.id);
    assert(isStr(no.speaker) && Array.isArray(no.lines) && no.lines.length > 0, `dialogue[${i}] speaker/lines missing`, errors);
  });
  req(raw.dialogue, 'dialogue').forEach((n, i) => {
    const no = obj(n);
    if (Array.isArray(no.choices)) {
      no.choices.forEach((ch, j) => {
        const next = obj(ch).next;
        assert(nodeIds.has(String(next)), `dialogue[${i}].choices[${j}] -> unknown node "${next}"`, errors);
      });
    }
    if (isStr(no.next)) {
      assert(nodeIds.has(no.next), `dialogue[${i}].next -> unknown node "${no.next}"`, errors);
    }
  });

  /* chains */
  req(raw.chains, 'chains').forEach((ch, i) => {
    const cho = obj(ch);
    assert(isStr(cho.id) && isStr(cho.name), `chains[${i}] id/name missing`, errors);
    req(cho.clueIds, `chains[${i}].clueIds`).forEach((id) =>
      assert(clueIds.has(String(id)), `chains[${i}] unknown clue "${id}"`, errors)
    );
  });

  /* cross-check: suspect count and fair-play minimums */
  assert(req(raw.suspects, 'suspects').length >= 5, 'case must have >= 5 suspects', errors);
  assert(clues.length >= 12, 'Act 1 build should ship >= 12 clues', errors);

  return errors;
}

/** Narrow-type accessor used by ContentRepository after validation. */
export function asBundle(raw: Record<string, unknown>): ContentBundle {
  return raw as unknown as ContentBundle;
}

export type { CaseMeta, Chain, Clue, DialogueNode, Gate, ProloguePage, Room, Suspect, TimelineEntry };
