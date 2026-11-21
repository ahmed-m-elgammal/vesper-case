/**
 * Game entrypoint -- mounts the whole MVVM game into a container element.
 * The Next.js page imports this; nothing here knows about React.
 */

import { GameRoot } from './views/GameRoot';

export function mountGame(container: HTMLElement): () => void {
  const root = new GameRoot(container);
  void root.start();
  return () => {
    root.destroy();
  };
}
