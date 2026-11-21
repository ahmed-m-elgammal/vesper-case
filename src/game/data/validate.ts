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
  DialogueCondition,
  DialogueGraph,
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

/** Recursively check a condition AST; clue references must exist. */
function checkCondition(
  cond: DialogueCondition,
  where: string,
  clueIds: Set<string>,
  errors: string[]
): void {
  if (!cond || typeof cond !== 'object') return;
  if ('all' in cond) {
    cond.all.forEach((c, i) => checkCondition(c, `${where}.all[${i}]`, clueIds, errors));
    return;
  }
  if ('any' in cond) {
    cond.any.forEach((c, i) => checkCondition(c, `${where}.any[${i}]`, clueIds, errors));
    return;
  }
  if ('not' in cond) {
    checkCondition(cond.not, `${where}.not`, clueIds, errors);
    return;
  }
  if ('clue' in cond) {
    assert(clueIds.has(cond.clue), `${where} -> unknown clue "${cond.clue}"`, errors);
  }
  if ('noClue' in cond) {
    assert(clueIds.has(cond.noClue), `${where} -> unknown clue "${cond.noClue}"`, errors);
  }
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

  /* rooms (clue ids collected early -- people presence conditions reference them) */
  const clueIds = new Set<string>();
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
    (Array.isArray(ro.people) ? ro.people : []).forEach((p, j) => {
      const po = obj(p);
      assert(isRect(po.spot), `rooms[${i}].people[${j}].spot missing`, errors);
      if (isStr(po.suspect)) {
        assert(suspectIds.has(po.suspect), `rooms[${i}].people[${j}] unknown suspect "${po.suspect}"`, errors);
      } else {
        errors.push(`rooms[${i}].people[${j}].suspect missing`);
      }
      if (po.cond) checkCondition(po.cond as DialogueCondition, `rooms[${i}].people[${j}].cond`, clueIds, errors);
    });
    ['tier1', 'tier2', 'tier3'].forEach((k) =>
      assert(isStr(obj(ro.hints)[k]), `rooms[${i}].hints.${k} missing`, errors)
    );
  });

  /* clues */
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

  /* dialogue -- legacy flat nodes AND/OR v2 conversation graphs */
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

  /* dialogue v2 graphs */
  const graphs = (raw.graphs ?? {}) as Record<string, DialogueGraph>;
  const localeKeys = new Set(Object.keys(obj(raw.locale)));
  const usedKeys = new Set<string>();
  const noteKey = (text: unknown, where: string) => {
    if (typeof text === 'string' && text.startsWith('@')) {
      const key = text.slice(1);
      usedKeys.add(key);
      void where;
    }
  };
  for (const [gid, g] of Object.entries(graphs)) {
    const go = obj(g);
    assert(isStr(go.speaker), `graphs.${gid}.speaker missing`, errors);
    assert(isStr(go.start) && Boolean(obj(go.nodes)[go.start]), `graphs.${gid}.start "${go.start}" is not a node`, errors);
    noteKey(go.speaker, `graphs.${gid}.speaker`);
    const nodeIdsG = new Set(Object.keys(obj(go.nodes)));
    for (const [nid, n] of Object.entries(obj(go.nodes))) {
      const no = obj(n);
      const hasBeats = Array.isArray(no.beats);
      assert(hasBeats || Array.isArray(no.choices) || isStr(no.next) || no.end === true, `graphs.${gid}.${nid} is empty`, errors);
      (Array.isArray(no.beats) ? no.beats : []).forEach((b, bi) => {
        const bo = obj(b);
        assert(typeof bo.t === 'string' && bo.t.length > 0, `graphs.${gid}.${nid}.beats[${bi}].t missing`, errors);
        noteKey(bo.t, `graphs.${gid}.${nid}.beats[${bi}]`);
      });
      (Array.isArray(no.choices) ? no.choices : []).forEach((ch, ci) => {
        const co = obj(ch);
        assert(typeof co.text === 'string', `graphs.${gid}.${nid}.choices[${ci}].text missing`, errors);
        noteKey(co.text, `graphs.${gid}.${nid}.choices[${ci}]`);
        if (isStr(co.next)) assert(nodeIdsG.has(co.next), `graphs.${gid}.${nid}.choices[${ci}] -> unknown node "${co.next}"`, errors);
        if (co.cond) checkCondition(co.cond as DialogueCondition, `graphs.${gid}.${nid}.choices[${ci}].cond`, clueIds, errors);
        if (co.present) assert(isStr(obj(co.present).miss) && nodeIdsG.has(String(obj(co.present).miss)), `graphs.${gid}.${nid}.choices[${ci}].present.miss unknown`, errors);
        assert(Boolean(co.next) || co.close === true || co.present, `graphs.${gid}.${nid}.choices[${ci}] needs next/close/present`, errors);
      });
      if (isStr(no.next)) assert(nodeIdsG.has(no.next), `graphs.${gid}.${nid}.next -> unknown node "${no.next}"`, errors);
      const eff = obj(no.effects);
      (Array.isArray(eff.setFlags) ? eff.setFlags : []).forEach((f) => assert(typeof f === 'string', `graphs.${gid}.${nid}.effects.setFlags invalid`, errors));
      (Array.isArray(eff.addClues) ? eff.addClues : []).forEach((cid) => assert(clueIds.has(String(cid)), `graphs.${gid}.${nid}.effects.addClues unknown clue "${cid}"`, errors));
      if (no.effects && typeof eff.setVars === 'object' && eff.setVars !== null) {
        for (const [vid, delta] of Object.entries(eff.setVars as Record<string, number>)) {
          assert(typeof delta === 'number', `graphs.${gid}.${nid}.effects.setVars.${vid} must be a number`, errors);
        }
      }
      if (Array.isArray(no.choices)) {
        no.choices.forEach((ch, ci) => {
          const effC = obj(obj(ch).effects);
          (Array.isArray(effC.addClues) ? effC.addClues : []).forEach((cid) => assert(clueIds.has(String(cid)), `graphs.${gid}.${nid}.choices[${ci}].effects.addClues unknown clue "${cid}"`, errors));
        });
      }
    }
    for (const [cid, reaction] of Object.entries(obj(g.reactions))) {
      assert(clueIds.has(cid), `graphs.${gid}.reactions unknown clue "${cid}"`, errors);
      const ro = obj(reaction);
      assert(nodeIdsG.has(String(ro.next)), `graphs.${gid}.reactions.${cid}.next unknown node "${ro.next}"`, errors);
    }
    const presents = obj(g.presents);
    if (isStr(presents.miss)) assert(nodeIdsG.has(presents.miss), `graphs.${gid}.presents.miss unknown node`, errors);
    if (isStr(presents.again)) assert(nodeIdsG.has(presents.again), `graphs.${gid}.presents.again unknown node`, errors);
  }
  for (const key of usedKeys) {
    assert(localeKeys.has(key), `locale key "${key}" is used by dialogue but missing from locales/en.json`, errors);
  }

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
