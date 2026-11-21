/**
 * Typed event bus for cross-cutting game signals that do not belong to a
 * single ViewModel (scene transitions, save flashes, audio cues, ...).
 */

export interface GameEventMap {
  'clue:collected': { id: string; name: string; room: string | null };
  'gate:opened': { gateId: string };
  'gate:solved': { gateId: string };
  'room:enter': { roomId: string };
  'room:doorLocked': { to: string; line: string };
  'notify:toast': { text: string; kind: 'clue' | 'info' | 'warn' };
  'dialogue:play': { dialogueId: string };
  'closeup:open': { clueId: string };
  'notebook:open': { tab?: string };
  'gate:open': { gateId: string };
  'endcard:show': { cardId: string };
  'save:wrote': { at: number };
  'transition:wipe': { midway: () => void; done?: () => void };
  'settings:changed': { key: string };
  'caption': { text: string };
}

type Handler<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void;

export class EventBus {
  private map = new Map<keyof GameEventMap, Set<Handler<never>>>();

  on<K extends keyof GameEventMap>(key: K, fn: Handler<K>): () => void {
    let set = this.map.get(key);
    if (!set) {
      set = new Set();
      this.map.set(key, set);
    }
    set.add(fn as Handler<never>);
    return () => {
      set?.delete(fn as Handler<never>);
    };
  }

  emit<K extends keyof GameEventMap>(key: K, payload: GameEventMap[K]): void {
    const set = this.map.get(key);
    if (!set) return;
    for (const fn of Array.from(set)) {
      try {
        (fn as Handler<K>)(payload);
      } catch (err) {
        console.error(`[EventBus] handler error for "${String(key)}"`, err);
      }
    }
  }
}
