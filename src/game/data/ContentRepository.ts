/**
 * ContentRepository -- loads case JSON bundles from /public/content/cases/<id>/,
 * validates them against the runtime checks, caches close-up SVG text for the
 * DOM overlays, and exposes typed accessors + index maps. The engine never
 * hard-codes case facts; it only reads repositories.
 *
 * WorldRepository loads the precinct world (world.json + cases.json + the
 * global locale) -- the station that hosts every case and lets the world
 * expand case by case.
 */

import { asBundle, asCaseRegistry, asWorld, validateBundle, validateCaseRegistry, validateWorld } from './validate';
import { setLocaleTable } from '../dialogue/loc';
import { withBase } from '../core/assetUrl';
import type {
  CaseFileMeta,
  Clue,
  ContentBundle,
  DialogueGraph,
  DialogueNode,
  EndCardContent,
  Gate,
  Room,
  StationSceneData,
  Suspect,
  WorldContent,
} from './types';

const CASE_FILES = {
  case: 'case.json',
  suspects: 'suspects.json',
  rooms: 'rooms.json',
  clues: 'clues.json',
  gates: 'gates.json',
  timeline: 'timeline.json',
  prologue: 'prologue.json',
  dialogue: 'dialogue.json',
  chains: 'chains.json',
} as const;

export class ContentError extends Error {
  constructor(public problems: string[]) {
    super('Case content failed validation:\n- ' + problems.join('\n- '));
  }
}

async function fetchJson(url: string, cache: RequestCache = 'no-cache'): Promise<unknown> {
  const res = await fetch(url, { cache });
  if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
  return res.json();
}

/* ------------------------------------------------------------------ */
/* World (precinct) repository                                         */
/* ------------------------------------------------------------------ */

export class WorldRepository {
  readonly world: WorldContent;
  readonly caseList: CaseFileMeta[];
  readonly locale: Record<string, string>;
  private graphsById = new Map<string, DialogueGraph>();
  private svgCache = new Map<string, string>();

  private constructor(world: WorldContent, caseList: CaseFileMeta[], locale: Record<string, string>) {
    this.world = world;
    this.caseList = caseList;
    this.locale = locale;
    for (const [id, g] of Object.entries(world.graphs ?? {})) this.graphsById.set(id, g);
    // The global locale table is the base layer; case bundles merge on top.
    setLocaleTable(locale);
  }

  static async load(): Promise<WorldRepository> {
    const [rawWorld, rawRegistry, locale] = await Promise.all([
      fetchJson(withBase('/content/world.json')),
      fetchJson(withBase('/content/cases.json')),
      fetchJson(withBase('/content/locales/en.json')) as Promise<Record<string, string>>,
    ]);
    // Give the world validator the global locale so "@key" lines can be checked.
    const worldRaw = { ...(rawWorld as Record<string, unknown>), locale };
    const problems = [...validateWorld(worldRaw), ...validateCaseRegistry(rawRegistry as Record<string, unknown>)];
    if (problems.length > 0) throw new ContentError(problems);
    const world = asWorld(worldRaw);
    normalizeWorldAssetPaths(world);
    return new WorldRepository(world, asCaseRegistry(rawRegistry as Record<string, unknown>), locale ?? {});
  }

  case(id: string): CaseFileMeta | undefined {
    return this.caseList.find((c) => c.id === id);
  }

  /** Station conversation graph by id (captain, sergeant, ...). */
  dialogueGraph(id: string): DialogueGraph | undefined {
    return this.graphsById.get(id);
  }

  person(id: string) {
    return this.world.people[id];
  }

  /** Fetch (and cache) an SVG as text for inline DOM injection. */
  async closeupSvg(url: string): Promise<string> {
    url = withBase(url);
    if (!url) return '';
    const hit = this.svgCache.get(url);
    if (hit) return hit;
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`Failed to load svg ${url}`);
    const text = await res.text();
    this.svgCache.set(url, text);
    return text;
  }
}

/* ------------------------------------------------------------------ */
/* Case bundle repository                                              */
/* ------------------------------------------------------------------ */

/**
 * Rewrite absolute asset paths in loaded content with the deployment base
 * (empty in dev / standalone, "/vesper-case" on GitHub Pages). Idempotent:
 * withBase only prefixes paths that do not already carry the base.
 */
function normalizeCaseAssetPaths(bundle: ContentBundle): void {
  for (const r of bundle.rooms) {
    for (const l of r.layers) l.src = withBase(l.src);
  }
  for (const c of bundle.clues) {
    if (c.closeup?.svg) c.closeup.svg = withBase(c.closeup.svg);
  }
  for (const s of bundle.suspects) {
    if (s.portrait) s.portrait = withBase(s.portrait);
  }
}

function normalizeWorldAssetPaths(world: WorldContent): void {
  const scenes = [world.exterior, world.interior, world.upper].filter(Boolean) as StationSceneData[];
  for (const sc of scenes) {
    sc.art = withBase(sc.art);
    for (const prop of sc.nav?.props ?? []) prop.img = withBase(prop.img);
  }
  for (const p of Object.values(world.people ?? {})) {
    if (p.portrait) p.portrait = withBase(p.portrait);
  }
}

export class ContentRepository {
  readonly caseId: string;
  readonly bundle: ContentBundle;
  private roomsById = new Map<string, Room>();
  private cluesById = new Map<string, Clue>();
  private suspectsById = new Map<string, Suspect>();
  private gatesById = new Map<string, Gate>();
  private graphsById = new Map<string, DialogueGraph>();
  private svgCache = new Map<string, string>();

  private constructor(caseId: string, bundle: ContentBundle) {
    this.caseId = caseId;
    this.bundle = bundle;
    for (const r of bundle.rooms) this.roomsById.set(r.id, r);
    for (const c of bundle.clues) this.cluesById.set(c.id, c);
    for (const s of bundle.suspects) this.suspectsById.set(s.id, s);
    for (const g of bundle.gates) this.gatesById.set(g.id, g);
    for (const [id, g] of Object.entries(bundle.graphs ?? {})) this.graphsById.set(id, g);
    setLocaleTable(bundle.locale ?? {});
  }

  /** Load + validate one case bundle from /content/cases/<caseId>/. */
  static async loadCase(caseId: string, globalLocale: Record<string, string> = {}): Promise<ContentRepository> {
    const entries = await Promise.all(
      Object.entries(CASE_FILES).map(async ([key, file]) => {
        const data = await fetchJson(withBase(`/content/cases/${caseId}/${file}`));
        return [key, data] as const;
      })
    );
    const raw = Object.fromEntries(entries) as Record<string, unknown>;
    // Accept both bare arrays and { key: [...] } wrapper shapes.
    const ARRAY_KEYS = ['suspects', 'rooms', 'clues', 'gates', 'timeline', 'prologue', 'dialogue', 'chains'];
    for (const key of ARRAY_KEYS) {
      const v = raw[key];
      if (v && !Array.isArray(v) && Array.isArray((v as Record<string, unknown>)[key])) {
        raw[key] = (v as Record<string, unknown>)[key];
      }
    }
    /*
     * dialogue.json may be a legacy flat array (build one) or the v2 shape
     * { nodes: [...], graphs: {...} }. Normalize into bundle.dialogue (array)
     * + bundle.graphs (record).
     */
    const d = raw.dialogue;
    if (d && !Array.isArray(d)) {
      const obj = d as Record<string, unknown>;
      raw.dialogue = Array.isArray(obj.nodes) ? obj.nodes : [];
      raw.graphs = obj.graphs ?? {};
    } else {
      raw.graphs = {};
    }

    // endCards.json is optional (act closers + the finale card, selected by
    // gate.onSolve.endCard). Accept a bare map or an { endCards: {...} } wrapper.
    let endCards: Record<string, EndCardContent> = {};
    try {
      const ec = (await fetchJson(withBase(`/content/cases/${caseId}/endCards.json`), 'force-cache')) as Record<string, unknown>;
      const wrapper = ec && typeof ec === 'object' ? (ec as Record<string, unknown>).endCards : undefined;
      endCards = ((wrapper && typeof wrapper === 'object' ? wrapper : ec) ?? {}) as Record<string, EndCardContent>;
    } catch {
      /* no end cards authored -- gates must not reference one (validator checks) */
    }
    raw.endCards = endCards;

    // Locale: global table first, then an optional per-case locale.json on top.
    let locale: Record<string, string> = { ...globalLocale };
    try {
      const caseLocale = (await fetchJson(withBase(`/content/cases/${caseId}/locale.json`), 'force-cache')) as Record<string, string>;
      locale = { ...locale, ...caseLocale };
    } catch {
      /* no per-case locale -- global table covers it */
    }
    raw.locale = locale;

    const problems = validateBundle(raw);
    if (problems.length > 0) throw new ContentError(problems);
    const bundle = asBundle(raw);
    normalizeCaseAssetPaths(bundle);
    return new ContentRepository(caseId, bundle);
  }

  get roomList(): Room[] {
    return this.bundle.rooms;
  }

  room(id: string): Room | undefined {
    return this.roomsById.get(id);
  }

  clue(id: string): Clue | undefined {
    return this.cluesById.get(id);
  }

  cluesForRoom(roomId: string): Clue[] {
    return this.bundle.clues.filter((c) => c.room === roomId && c.spot);
  }

  suspect(id: string): Suspect | undefined {
    return this.suspectsById.get(id);
  }

  gate(id: string): Gate | undefined {
    return this.gatesById.get(id);
  }

  gates(): Gate[] {
    return this.bundle.gates;
  }

  /** Authored act-closer / finale card by id (gate.onSolve.endCard). */
  endCard(id: string): EndCardContent | undefined {
    return this.bundle.endCards?.[id];
  }

  dialogueNode(id: string): DialogueNode | undefined {
    return this.bundle.dialogue.find((n) => n.id === id);
  }

  /** Conversation graph by id (case people use their suspect id). */
  dialogueGraph(id: string): DialogueGraph | undefined {
    return this.graphsById.get(id);
  }

  /** Fetch (and cache) a close-up SVG as text for inline DOM injection. */
  async closeupSvg(url: string): Promise<string> {
    url = withBase(url);
    if (!url) return '';
    const hit = this.svgCache.get(url);
    if (hit) return hit;
    const res = await fetch(url, { cache: 'force-cache' });
    if (!res.ok) throw new Error(`Failed to load close-up ${url}`);
    const text = await res.text();
    this.svgCache.set(url, text);
    return text;
  }
}
