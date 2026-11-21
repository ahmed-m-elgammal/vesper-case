/**
 * SaveSystem -- persistence model for the game.
 *
 * - Autosaves the GameState to IndexedDB (localStorage fallback) after every
 *   clue, deduction, flag or setting change (debounced).
 * - Export/import: a compact, checksummed save code the player can copy
 *   between devices. Format: "IA1|<base64url(json)>|<fnv1a>".
 */

import type { GameState } from '../data/types';

const DB_NAME = 'ink-and-ashes';
const STORE = 'saves';
const KEY = 'slot1';
const LS_FALLBACK = 'ink-and-ashes-save';

export class SaveSystem {
  private db: IDBDatabase | null = null;
  private timer: ReturnType<typeof setTimeout> | null = null;
  private lastJSON = '';

  constructor(private onWrote: () => void) {}

  async init(): Promise<void> {
    try {
      this.db = await new Promise<IDBDatabase>((resolve, reject) => {
        const req = indexedDB.open(DB_NAME, 1);
        req.onupgradeneeded = () => {
          const db = req.result;
          if (!db.objectStoreNames.contains(STORE)) db.createObjectStore(STORE);
        };
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
        req.onblocked = () => reject(new Error('indexeddb blocked'));
      });
    } catch {
      this.db = null; // fall back to localStorage
    }
  }

  load(): Promise<GameState | null> {
    const parse = (raw: unknown): GameState | null => {
      if (!raw) return null;
      try {
        const state = typeof raw === 'string' ? (JSON.parse(raw) as GameState) : (raw as GameState);
        if (state && state.v === 1) return state;
        return null;
      } catch {
        return null;
      }
    };
    if (this.db) {
      return new Promise((resolve) => {
        try {
          const tx = this.db!.transaction(STORE, 'readonly');
          const req = tx.objectStore(STORE).get(KEY);
          req.onsuccess = () => resolve(parse(req.result));
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      });
    }
    try {
      const raw = localStorage.getItem(LS_FALLBACK);
      return Promise.resolve(parse(raw));
    } catch {
      return Promise.resolve(null);
    }
  }

  /** Debounced autosave -- safe to call after every small mutation. */
  queueSave(state: GameState): void {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      void this.saveNow(state);
    }, 350);
  }

  async saveNow(state: GameState): Promise<void> {
    state.updatedAt = Date.now();
    const json = JSON.stringify(state);
    if (json === this.lastJSON) return;
    this.lastJSON = json;
    if (this.db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = this.db!.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).put(json, KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    } else {
      try {
        localStorage.setItem(LS_FALLBACK, json);
      } catch {
        /* storage full/unavailable -- game still playable this session */
      }
    }
    this.onWrote();
  }

  async clear(): Promise<void> {
    this.lastJSON = '';
    if (this.db) {
      await new Promise<void>((resolve) => {
        try {
          const tx = this.db!.transaction(STORE, 'readwrite');
          tx.objectStore(STORE).delete(KEY);
          tx.oncomplete = () => resolve();
          tx.onerror = () => resolve();
        } catch {
          resolve();
        }
      });
    }
    try {
      localStorage.removeItem(LS_FALLBACK);
    } catch {
      /* ignore */
    }
  }

  /* ---------------- save codes ---------------- */

  static encode(state: GameState): string {
    const json = JSON.stringify(state);
    const b64 = btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
    return `IA1|${b64}|${SaveSystem.fnv1a(json)}`;
  }

  static decode(code: string): GameState | null {
    try {
      const parts = code.trim().split('|');
      if (parts.length !== 3 || parts[0] !== 'IA1') return null;
      const b64 = parts[1].replace(/-/g, '+').replace(/_/g, '/');
      const json = decodeURIComponent(escape(atob(b64)));
      if (SaveSystem.fnv1a(json) !== parts[2]) return null;
      const state = JSON.parse(json) as GameState;
      if (state.v !== 1) return null;
      return state;
    } catch {
      return null;
    }
  }

  private static fnv1a(str: string): string {
    let h = 0x811c9dc5;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return (h >>> 0).toString(16);
  }
}
