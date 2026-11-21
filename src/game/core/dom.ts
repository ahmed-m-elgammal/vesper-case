/**
 * Tiny DOM builder + data-binding helpers for the plain HTML/CSS overlay
 * views. Views are constructed with `el()` and wired to ViewModels with the
 * bind* helpers -- no framework, no virtual DOM, just observable bindings.
 */

import { Observable } from './Observable';

type Attrs = Record<string, string | number | boolean | ((ev: Event) => void)>;

export function el<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Attrs | null,
  children?: Array<Node | string | null | undefined>
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined || v === null) continue;
      if (k === 'class') node.className = String(v);
      else if (k === 'text') node.textContent = String(v);
      else if (k === 'html') node.innerHTML = String(v);
      else if (k.startsWith('on') && typeof v === 'function') {
        node.addEventListener(k.slice(2), v as unknown as EventListener);
      } else if (typeof v === 'boolean') {
        if (v) node.setAttribute(k, '');
      } else {
        node.setAttribute(k, String(v));
      }
    }
  }
  if (children) {
    for (const child of children) {
      if (child === null || child === undefined) continue;
      node.append(typeof child === 'string' ? document.createTextNode(child) : child);
    }
  }
  return node;
}

/** Keep el.textContent in sync with an observable string. */
export function bindText(node: HTMLElement, obs: Observable<string>): () => void {
  return obs.subscribe((v) => {
    node.textContent = v;
  }, true);
}

/** Keep a CSS class present/absent based on a boolean observable. */
export function bindClass(node: HTMLElement, cls: string, obs: Observable<boolean>): () => void {
  return obs.subscribe((on) => {
    node.classList.toggle(cls, on);
  }, true);
}

/** Show/hide a node from a boolean observable. */
export function bindVisible(node: HTMLElement, obs: Observable<boolean>): () => void {
  return obs.subscribe((on) => {
    node.classList.toggle('hidden', !on);
  }, true);
}

/**
 * Re-render a list container whenever `obs` emits. `render(item, key)` returns
 * a Node; the container is fully rebuilt (lists here are small, simpler than
 * keyed diffing).
 */
export function bindList<T>(
  container: HTMLElement,
  obs: Observable<T>,
  render: (value: T) => Node | Array<Node | string | null | undefined>
): () => void {
  return obs.subscribe((value) => {
    container.innerHTML = '';
    const out = render(value);
    if (Array.isArray(out)) container.append(...(out.filter(Boolean) as Node[]));
    else if (out) container.append(out);
  }, true);
}

/** Remove all children. */
export function clear(node: HTMLElement): void {
  node.innerHTML = '';
}

/** Simple deterministic shuffle for chip pools (Fisher-Yates with seed). */
export function shuffled<T>(items: Array<T>, seed: number): Array<T> {
  const arr = items.slice();
  let s = seed >>> 0 || 1;
  const rnd = () => {
    s ^= s << 13;
    s ^= s >>> 17;
    s ^= s << 5;
    s >>>= 0;
    return s / 0xffffffff;
  };
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(rnd() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}
