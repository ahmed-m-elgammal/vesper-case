/**
 * Hand-rolled runtime validators for the content JSON. The authoritative
 * machine-readable schemas live in /public/content/schemas/*.schema.json;
 * these checks give friendly errors at boot (dev overlay) without pulling a
 * validator dependency into the bundle.
 */

import type {
  CaseFileMeta,
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
  WorldContent,
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

/** Require a non-empty array; pushes an error when missing. */
function reqArr(v: unknown, what: string, errors: string[]): unknown[] {
  if (!Array.isArray(v) || v.length === 0) {
    errors.push(`${what} must be a non-empty array`);
    return [];
  }
  return v;
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
  const localeKeys = new Set(Object.keys(obj(raw.locale)));
  validateGraphs((raw.graphs ?? {}) as Record<string, DialogueGraph>, clueIds, localeKeys, 'graphs', errors);

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

/**
 * Shared v2 conversation-graph checks. `clueIds` is the set of clue ids the
 * graphs may reference (case clues; empty for world graphs, which must not
 * depend on case evidence). `localeKeys` is the merged locale table.
 */
export function validateGraphs(
  graphs: Record<string, DialogueGraph>,
  clueIds: Set<string>,
  localeKeys: Set<string>,
  label: string,
  errors: string[]
): void {
  const usedKeys = new Set<string>();
  const noteKey = (text: unknown) => {
    if (typeof text === 'string' && text.startsWith('@')) usedKeys.add(text.slice(1));
  };
  for (const [gid, g0] of Object.entries(graphs ?? {})) {
    const g = obj(g0);
    const go = obj(g);
    assert(isStr(go.speaker), `${label}.${gid}.speaker missing`, errors);
    assert(isStr(go.start) && Boolean(obj(go.nodes)[go.start]), `${label}.${gid}.start "${go.start}" is not a node`, errors);
    noteKey(go.speaker);
    const nodeIdsG = new Set(Object.keys(obj(go.nodes)));
    for (const [nid, n] of Object.entries(obj(go.nodes))) {
      const no = obj(n);
      const hasBeats = Array.isArray(no.beats);
      assert(hasBeats || Array.isArray(no.choices) || isStr(no.next) || no.end === true, `${label}.${gid}.${nid} is empty`, errors);
      (Array.isArray(no.beats) ? no.beats : []).forEach((b, bi) => {
        const bo = obj(b);
        assert(typeof bo.t === 'string' && bo.t.length > 0, `${label}.${gid}.${nid}.beats[${bi}].t missing`, errors);
        noteKey(bo.t);
      });
      (Array.isArray(no.choices) ? no.choices : []).forEach((ch, ci) => {
        const co = obj(ch);
        assert(typeof co.text === 'string', `${label}.${gid}.${nid}.choices[${ci}].text missing`, errors);
        noteKey(co.text);
        if (isStr(co.next)) assert(nodeIdsG.has(co.next), `${label}.${gid}.${nid}.choices[${ci}] -> unknown node "${co.next}"`, errors);
        if (co.cond) checkCondition(co.cond as DialogueCondition, `${label}.${gid}.${nid}.choices[${ci}].cond`, clueIds, errors);
        if (co.present) assert(isStr(obj(co.present).miss) && nodeIdsG.has(String(obj(co.present).miss)), `${label}.${gid}.${nid}.choices[${ci}].present.miss unknown`, errors);
        assert(Boolean(co.next) || co.close === true || co.present, `${label}.${gid}.${nid}.choices[${ci}] needs next/close/present`, errors);
      });
      if (isStr(no.next)) assert(nodeIdsG.has(no.next), `${label}.${gid}.${nid}.next -> unknown node "${no.next}"`, errors);
      const eff = obj(no.effects);
      (Array.isArray(eff.setFlags) ? eff.setFlags : []).forEach((f) => assert(typeof f === 'string', `${label}.${gid}.${nid}.effects.setFlags invalid`, errors));
      (Array.isArray(eff.addClues) ? eff.addClues : []).forEach((cid) => assert(clueIds.has(String(cid)), `${label}.${gid}.${nid}.effects.addClues unknown clue "${cid}"`, errors));
      if (no.effects && typeof eff.setVars === 'object' && eff.setVars !== null) {
        for (const [vid, delta] of Object.entries(eff.setVars as Record<string, number>)) {
          assert(typeof delta === 'number', `${label}.${gid}.${nid}.effects.setVars.${vid} must be a number`, errors);
        }
      }
      if (Array.isArray(no.choices)) {
        no.choices.forEach((ch, ci) => {
          const effC = obj(obj(ch).effects);
          (Array.isArray(effC.addClues) ? effC.addClues : []).forEach((cid) => assert(clueIds.has(String(cid)), `${label}.${gid}.${nid}.choices[${ci}].effects.addClues unknown clue "${cid}"`, errors));
        });
      }
    }
    for (const [cid, reaction] of Object.entries(obj(g.reactions))) {
      assert(clueIds.has(cid), `${label}.${gid}.reactions unknown clue "${cid}"`, errors);
      const ro = obj(reaction);
      assert(nodeIdsG.has(String(ro.next)), `${label}.${gid}.reactions.${cid}.next unknown node "${ro.next}"`, errors);
    }
    const presents = obj(g.presents);
    if (isStr(presents.miss)) assert(nodeIdsG.has(presents.miss), `${label}.${gid}.presents.miss unknown node`, errors);
    if (isStr(presents.again)) assert(nodeIdsG.has(presents.again), `${label}.${gid}.presents.again unknown node`, errors);
  }
  for (const key of usedKeys) {
    assert(localeKeys.has(key), `locale key "${key}" is used by ${label} but missing from locales/en.json`, errors);
  }
}

/* ------------------------------------------------------------------ */
/* World content (the precinct) + case registry                        */
/* ------------------------------------------------------------------ */

const HOTSPOT_KINDS = new Set(['door', 'files', 'dialogue', 'flavor', 'locked', 'career']);

/** Which levels a door on each level may lead to (the station's floor plan). */
const DOOR_TARGETS: Record<string, string[]> = {
  exterior: ['interior'],
  interior: ['exterior', 'upper'],
  upper: ['interior'],
};

function checkScene(sc: unknown, what: string, errors: string[]): void {
  const so = obj(sc);
  assert(isStr(so.art), `${what}.art missing`, errors);
  assert(isStr(so.title), `${what}.title missing`, errors);
  assert(isStr(so.ambientCaption), `${what}.ambientCaption missing`, errors);
  const fe = obj(so.firstEntry);
  if (fe.flag !== undefined || fe.lines !== undefined) {
    assert(isStr(fe.flag) && /^seen:[a-z0-9:-]+$/.test(String(fe.flag)), `${what}.firstEntry.flag must be a "seen:*" flag`, errors);
    reqArr(fe.lines, `${what}.firstEntry.lines`, errors).forEach((ln, i) =>
      assert(typeof ln === 'string' && ln.length > 0, `${what}.firstEntry.lines[${i}] must be non-empty`, errors)
    );
  }
  const hs = reqArr(so.hotspots, `${what}.hotspots`, errors);
  const ids = new Set<string>();
  hs.forEach((h, i) => {
    const ho = obj(h);
    assert(isStr(ho.id), `${what}.hotspots[${i}].id missing`, errors);
    if (isStr(ho.id)) {
      assert(!ids.has(ho.id), `${what}.hotspots[${i}] duplicate id "${ho.id}"`, errors);
      ids.add(ho.id);
    }
    assert(isRect(ho.spot), `${what}.hotspots[${i}].spot must be [x,y,w,h]`, errors);
    assert(isStr(ho.label), `${what}.hotspots[${i}].label missing`, errors);
    const kind = String(ho.kind ?? '');
    assert(HOTSPOT_KINDS.has(kind), `${what}.hotspots[${i}].kind "${kind}" invalid`, errors);
    if (kind === 'door') {
      const targets = DOOR_TARGETS[what] ?? [];
      assert(
        targets.includes(String(ho.to)),
        `${what}.hotspots[${i}].to must be one of ${targets.join('|')} (floor plan)`,
        errors
      );
    }
    if (kind === 'dialogue') assert(isStr(ho.dialogue), `${what}.hotspots[${i}].dialogue missing`, errors);
    if (kind === 'flavor' || kind === 'locked') assert(isStr(ho.line), `${what}.hotspots[${i}].line missing`, errors);
  });
  checkNav(so.nav, what, ids, errors);
}

/** Navigation geometry: spawn/stand points must be walkable and unblocked. */
function checkNav(nav: unknown, what: string, hotspotIds: Set<string>, errors: string[]): void {
  if (nav === undefined) return; // levels without nav stay tap-only
  const no = obj(nav);
  assert(Array.isArray(no.walk) && no.walk.length > 0, `${what}.nav.walk must be a non-empty array`, errors);
  const walk = Array.isArray(no.walk) ? no.walk : [];
  walk.forEach((r, i) => {
    assert(isRect(r), `${what}.nav.walk[${i}] must be [x,y,w,h]`, errors);
    const [x, y, w, h] = isRect(r) ? r : [0, 0, 0, 0];
    assert(w > 0 && h > 0, `${what}.nav.walk[${i}] must have positive size`, errors);
  });
  const colliders: Array<[number, number, number, number]> = [];
  (Array.isArray(no.colliders) ? no.colliders : []).forEach((r, i) => {
    assert(isRect(r), `${what}.nav.colliders[${i}] must be [x,y,w,h]`, errors);
    if (isRect(r)) colliders.push(r);
  });
  (Array.isArray(no.props) ? no.props : []).forEach((p, i) => {
    const po = obj(p);
    ['id', 'img'].forEach((k) => assert(isStr(po[k]), `${what}.nav.props[${i}].${k} missing`, errors));
    ['x', 'y', 'w', 'h', 'base'].forEach((k) =>
      assert(typeof po[k] === 'number', `${what}.nav.props[${i}].${k} must be a number`, errors)
    );
    if (isRect(po.solid)) colliders.push(po.solid as [number, number, number, number]);
    if (po.person !== undefined) assert(isStr(po.person), `${what}.nav.props[${i}].person invalid`, errors);
  });

  const insideWalk = (pt: [number, number]) =>
    walk.some((r) => {
      if (!isRect(r)) return false;
      const [x, y, w, h] = r;
      return pt[0] >= x && pt[0] <= x + w && pt[1] >= y && pt[1] <= y + h;
    });
  const blocked = (pt: [number, number]) =>
    colliders.some(([x, y, w, h]) => pt[0] >= x && pt[0] <= x + w && pt[1] >= y && pt[1] <= y + h);
  const badPoint = (pt: unknown, where: string) => {
    if (!Array.isArray(pt) || pt.length !== 2 || pt.some((n) => typeof n !== 'number')) {
      errors.push(`${where} must be [x, y]`);
      return;
    }
    const p = pt as [number, number];
    assert(insideWalk(p), `${where} is not inside a walkable rect`, errors);
    assert(!blocked(p), `${where} sits inside a collider`, errors);
  };

  if (no.spawn !== undefined) badPoint(no.spawn, `${what}.nav.spawn`);
  const sn = obj(no.spawnNear);
  for (const [from, pt] of Object.entries(sn)) {
    assert(['exterior', 'interior', 'upper'].includes(from), `${what}.nav.spawnNear.${from} invalid level`, errors);
    badPoint(pt, `${what}.nav.spawnNear.${from}`);
  }
  const sp = obj(no.standPoints);
  for (const [hid, pt] of Object.entries(sp)) {
    assert(hotspotIds.has(hid), `${what}.nav.standPoints.${hid} has no matching hotspot`, errors);
    badPoint(pt, `${what}.nav.standPoints.${hid}`);
  }
  if (no.reach !== undefined) assert(typeof no.reach === 'number' && (no.reach as number) > 0, `${what}.nav.reach must be a positive number`, errors);
}

/** Runtime checks for world.json (the precinct that hosts every case). */
export function validateWorld(raw: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const det = obj(raw.detective);
  ['name', 'rank', 'badge', 'station', 'tagline'].forEach((k) =>
    assert(isStr(det[k]), `detective.${k} missing`, errors)
  );
  assert(typeof det.desk === 'number', 'detective.desk missing', errors);
  assert(Array.isArray(det.backstory) && det.backstory.length > 0, 'detective.backstory must be non-empty', errors);

  const intro = obj(raw.intro);
  assert(intro.when === 'first-station-entry', 'intro.when must be "first-station-entry"', errors);
  reqArr(intro.lines, 'intro.lines', errors).forEach((ln, i) =>
    assert(typeof ln === 'string' && ln.length > 0, `intro.lines[${i}] must be non-empty`, errors)
  );

  checkScene(raw.exterior, 'exterior', errors);
  checkScene(raw.interior, 'interior', errors);
  if (raw.upper !== undefined) checkScene(raw.upper, 'upper', errors);

  // people
  for (const [pid, p] of Object.entries(obj(raw.people))) {
    const po = obj(p);
    ['name', 'shortName', 'initial', 'tint'].forEach((k) => assert(isStr(po[k]), `people.${pid}.${k} missing`, errors));
  }

  // career ladder: strictly increasing thresholds, unique ids/titles
  const career = obj(raw.career);
  assert(isStr(career.explanation), 'career.explanation missing', errors);
  const ranks = reqArr(career.ranks, 'career.ranks', errors);
  const rankIds = new Set<string>();
  const rankTitles = new Set<string>();
  let lastAfter = -1;
  ranks.forEach((r, i) => {
    const ro = obj(r);
    assert(isStr(ro.id), `career.ranks[${i}].id missing`, errors);
    if (isStr(ro.id)) assert(!rankIds.has(ro.id), `career.ranks[${i}] duplicate id "${ro.id}"`, errors), rankIds.add(String(ro.id));
    assert(isStr(ro.title), `career.ranks[${i}].title missing`, errors);
    if (isStr(ro.title)) {
      assert(!rankTitles.has(ro.title), `career.ranks[${i}] duplicate title "${ro.title}"`, errors);
      rankTitles.add(String(ro.title));
    }
    assert(typeof ro.after === 'number' && (ro.after as number) > lastAfter, `career.ranks[${i}].after must increase (promotion order)`, errors);
    if (typeof ro.after === 'number') lastAfter = ro.after;
  });
  assert(ranks.length > 0 && (obj(ranks[0]) as Record<string, unknown>).after === 0, 'career.ranks[0] must be the starting rank (after: 0)', errors);

  // station graphs: flags-only conditions (no case clues) + merged locale keys
  const localeKeys = new Set(Object.keys(obj(raw.locale)));
  validateGraphs((raw.graphs ?? {}) as Record<string, DialogueGraph>, new Set<string>(), localeKeys, 'world.graphs', errors);

  // dialogue hotspots must point at an existing world graph
  for (const [name, sc] of [['exterior', raw.exterior], ['interior', raw.interior], ['upper', raw.upper]] as const) {
    if (!sc) continue;
    const hs = obj(sc).hotspots;
    const list = Array.isArray(hs) ? hs : [];
    list.forEach((h: unknown, i: number) => {
      const ho = obj(h);
      if (ho.kind === 'dialogue' && isStr(ho.dialogue)) {
        assert(Boolean(obj(raw.graphs)[ho.dialogue]), `${name}.hotspots[${i}] dialogue "${ho.dialogue}" is not a world graph`, errors);
      }
    });
  }

  return errors;
}

/** Runtime checks for cases.json (the desk folders). */
export function validateCaseRegistry(raw: Record<string, unknown>): string[] {
  const errors: string[] = [];
  const STATUSES = new Set(['available', 'sealed', 'cold', 'soon']);
  const cases = reqArr(raw.cases, 'cases', errors);
  const ids = new Set<string>();
  const slots = new Set<string>();
  cases.forEach((c, i) => {
    const co = obj(c);
    const id = String(co.id ?? '');
    assert(/^[a-z][a-z0-9-]*$/.test(id), `cases[${i}].id "${id}" must be a slug (dir name under /content/cases/)`, errors);
    if (id) {
      assert(!ids.has(id), `cases[${i}] duplicate id "${id}"`, errors);
      ids.add(id);
    }
    ['code', 'title', 'subtitle', 'difficulty', 'location', 'victim', 'pitch'].forEach((k) =>
      assert(isStr(co[k]), `cases[${i}].${k} missing`, errors)
    );
    assert(STATUSES.has(String(co.status)), `cases[${i}].status "${co.status}" invalid`, errors);
    assert(typeof co.slot === 'number' && !slots.has(String(co.slot)), `cases[${i}].slot missing or duplicated`, errors);
    if (typeof co.slot === 'number') slots.add(String(co.slot));
    assert(/^#[0-9a-fA-F]{6}$/.test(String(co.accent)), `cases[${i}].accent must be a hex colour`, errors);
    assert(Array.isArray(co.memo), `cases[${i}].memo must be an array`, errors);
    if (co.rankRequired !== undefined) assert(isStr(co.rankRequired), `cases[${i}].rankRequired must be a career rank title`, errors);
  });
  assert(cases.some((c) => obj(c).status === 'available'), 'at least one case must be status "available"', errors);
  return errors;
}

/** Narrow-type accessors used after validation. */
export function asBundle(raw: Record<string, unknown>): ContentBundle {
  return raw as unknown as ContentBundle;
}
export function asWorld(raw: Record<string, unknown>): WorldContent {
  return raw as unknown as WorldContent;
}
export function asCaseRegistry(raw: Record<string, unknown>): CaseFileMeta[] {
  return ((raw.cases as unknown) ?? []) as CaseFileMeta[];
}

export type { CaseMeta, Chain, Clue, DialogueNode, Gate, ProloguePage, Room, Suspect, TimelineEntry };
