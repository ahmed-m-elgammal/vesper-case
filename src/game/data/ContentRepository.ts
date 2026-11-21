/**
 * ContentRepository -- loads every case JSON from /public/content, validates
 * it against the runtime checks, caches close-up SVG text for the DOM
 * overlays, and exposes typed accessors + index maps. The engine never
 * hard-codes case facts; it only reads this repository.
 */

import { asBundle, validateBundle } from './validate';
import type { Clue, ContentBundle, Gate, Room, Suspect } from './types';

const FILES = {
  case: '/content/case.json',
  suspects: '/content/suspects.json',
  rooms: '/content/rooms.json',
  clues: '/content/clues.json',
  gates: '/content/gates.json',
  timeline: '/content/timeline.json',
  prologue: '/content/prologue.json',
  dialogue: '/content/dialogue.json',
  chains: '/content/chains.json',
} as const;

export class ContentError extends Error {
  constructor(public problems: string[]) {
    super('Case content failed validation:\n- ' + problems.join('\n- '));
  }
}

export class ContentRepository {
  readonly bundle: ContentBundle;
  private roomsById = new Map<string, Room>();
  private cluesById = new Map<string, Clue>();
  private suspectsById = new Map<string, Suspect>();
  private gatesById = new Map<string, Gate>();
  private svgCache = new Map<string, string>();

  private constructor(bundle: ContentBundle) {
    this.bundle = bundle;
    for (const r of bundle.rooms) this.roomsById.set(r.id, r);
    for (const c of bundle.clues) this.cluesById.set(c.id, c);
    for (const s of bundle.suspects) this.suspectsById.set(s.id, s);
    for (const g of bundle.gates) this.gatesById.set(g.id, g);
  }

  static async load(): Promise<ContentRepository> {
    const entries = await Promise.all(
      Object.entries(FILES).map(async ([key, url]) => {
        const res = await fetch(url, { cache: 'no-cache' });
        if (!res.ok) throw new Error(`Failed to load ${url} (${res.status})`);
        return [key, await res.json()] as const;
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
    const problems = validateBundle(raw);
    if (problems.length > 0) throw new ContentError(problems);
    return new ContentRepository(asBundle(raw));
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

  dialogueNode(id: string) {
    return this.bundle.dialogue.find((n) => n.id === id);
  }

  /** Fetch (and cache) a close-up SVG as text for inline DOM injection. */
  async closeupSvg(url: string): Promise<string> {
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
