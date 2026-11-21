/**
 * Minimal MVVM observable primitives.
 *
 * The whole game binds to these: ViewModels expose Observable<T> properties,
 * Views (Phaser scenes and plain-DOM overlays) subscribe to them. Nothing in
 * the view layer ever mutates game state directly -- it calls ViewModel
 * methods, which mutate the state model and emit through observables.
 */

export type Unsubscribe = () => void;
export type Observer<T> = (value: T, old: T) => void;

export class Observable<T> {
  private subs = new Set<Observer<T>>();

  constructor(private _value: T) {}

  get value(): T {
    return this._value;
  }

  set value(next: T) {
    const old = this._value;
    if (old === next) return;
    this._value = next;
    for (const fn of this.subs) {
      try {
        fn(next, old);
      } catch (err) {
        console.error('[Observable] subscriber error', err);
      }
    }
  }

  /** Subscribe; pass fireNow=true to invoke immediately with the current value. */
  subscribe(fn: Observer<T>, fireNow = false): Unsubscribe {
    this.subs.add(fn);
    if (fireNow) fn(this._value, this._value);
    return () => {
      this.subs.delete(fn);
    };
  }

  map<U>(fn: (v: T) => U): Observable<U> {
    const out = new Observable<U>(fn(this._value));
    this.subscribe((v) => {
      out.value = fn(v);
    });
    return out;
  }
}

/** Derived observable that recomputes whenever any source emits. */
export class Computed<T> extends Observable<T> {
  constructor(
    compute: () => T,
    sources: Array<{ subscribe(fn: () => void): void }>
  ) {
    super(compute());
    for (const src of sources) {
      src.subscribe(() => {
        const next = compute();
        // Bypass override: Computed is read-only from outside.
        (this as unknown as { value: T }).value = next;
      });
    }
  }
}
