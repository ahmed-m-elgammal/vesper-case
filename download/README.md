# Ink & Ashes — The Vesper Case

A browser-based detective deduction game with a hand-drawn storybook look, built on a **data-driven MVVM architecture**. One house, one night: read the case file, walk the rooms, collect evidence, catch the lies, and name the culprit, the method and the motive.

**This build ships the Prologue + Act I** (entrance hall + the parlour, 18 evidence items, 2 deduction gates, full notebook, autosave, save codes). Acts 2–5 (kitchen/stairs, bedrooms/study, attic/basement + the 60% twist, Ink interrogations + evidence board + final accusation) are authored as locked content and arrive in later milestones — the case bible already contains the full truth.

---

## 1. Quick start

```bash
bun install          # or npm install
bun run lint         # eslint (passes clean)
npx tsc --noEmit     # typecheck (passes clean)
bun run dev          # Next.js dev server on port 3000 — open the preview
```

Production static deploy (Cloudflare Pages / itch.io / any static host):

```bash
bun run build        # next build + static assets in .next/standalone + public
bun run start        # serve the production build (registers the service worker)
```

The game is fully client-side: Phaser rooms + plain DOM overlays + JSON content, no server needed. The service worker (`public/sw.js`) precaches the shell and runtime-caches content/art for offline play (registered in production builds only).

## 2. Architecture — data-driven MVVM

```
CONTENT (JSON, /public/content)          <- authors touch ONLY this
   case.json  suspects.json  rooms.json  clues.json
   gates.json timeline.json prologue.json dialogue.json chains.json
        │  validated at boot (validate.ts; schemas in /public/content/schemas)
        ▼
MODEL    GameState (src/game/data/types.ts) — progression persisted by SaveSystem
        ▼
VIEWMODELS (src/game/viewmodels)         <- Observable<T> / Computed<T>
   GameVM (root: state, intents, toasts, settings, gates, autosave)
   RoomVM (hotspots: clues + doors, tool gating, door decisions)
   NotebookVM (clue cards / people / timeline rows / threads)
   GateVM (chip pool, slots, JSON-rule validation)
   DialogueVM (JSON tree, typewriter; Ink plugs into the same interface in M4)
   HintVM  (three-tier Think)
        ▼
VIEWS
   Phaser scenes (src/game/views/phaser): HubScene (dollhouse), RoomScene
     (parallax layers, drag pan, hotspots, transitions) — thin, render + intent only
   DOM overlays (src/game/views/overlays): Start, Prologue storybook, Close-up
     (pinch/wheel zoom, nested reveals), Gate, Notebook, Dialogue, HUD, Menu,
     Hints, Toasts, sketch-wipe Transition, End card
        ▼
GameRoot (src/game/views/GameRoot.ts) — composition root: phase routing,
   overlay z-order, scene switching; contains no case logic.
```

Rules of the architecture:

- Views never mutate state; they call ViewModel methods and subscribe to observables (`src/game/core/Observable.ts`).
- All case facts live in JSON. Adding an act = adding JSON + SVG art; no engine code changes.
- Persistence: autosave (debounced) to **IndexedDB** after every clue/deduction/flag/setting change, with a localStorage fallback, plus export/import **save codes** (`IA1|base64|fnv1a`) in Menu → Save.

## 3. Project structure

```
src/app/            Next.js host (page.tsx mounts the game browser-only via ssr:false)
src/game/
  main.ts           mountGame(container) entrypoint
  GameHost.tsx      client-only mount component
  style.css         the whole storybook stylesheet
  core/             Observable, Computed, EventBus, DOM builder + bind helpers
  data/             types (content + GameState), validators, ContentRepository
  save/             SaveSystem (IndexedDB, save codes)
  viewmodels/       GameVM, RoomVM, NotebookVM, GateVM, DialogueVM, HintVM
  views/
    GameRoot.ts     composition root / phase router
    phaser/         PhaserHost, HubScene, RoomScene, SceneCtx
    overlays/       Start, Prologue, Notebook, CloseUp, Gate, Dialogue, HUD,
                    Menu, Hint, Toast, Transition, EndCard
public/
  art/              hand-inked SVG layers (rooms, hub, plan) + closeups/*.svg
  content/          ALL case content (JSON) + schemas/*.schema.json
  icons/            PWA icons        manifest.webmanifest, sw.js
docs/               CASE_BIBLE.md (full truth), ASSETS.md (asset list)
scripts/            gen_icons.py, walkthrough scripts (browser verification)
```

## 4. Content authoring guide

1. **Rooms** (`rooms.json`): id, act, width/height (2400x900), ordered layers (SVG path + scrollFactor for parallax), doors (with `lockedByGate` / `lockedAct`), hub plate rect, three-tier hints.
2. **Clues** (`clues.json`): id, name, room + world-space `spot` rect (matching the art), optional `tool` gate, close-up SVG + notebook note, chain ids, optional `timeline` link, optional `reveals` (nested clues inside the close-up, e.g. "search his pockets").
3. **Gates** (`gates.json`): fill-in-the-sentence slots (`before`/`after` text, `answer`, `chips` pool with distractors), `requiresClues`, and `onSolve` rewards (flags, unlocked rooms, dialogue, end card).
4. **Suspects** (`suspects.json`): public statement + hidden `secret` / `lie` / `redHerring` (Act 5 systems will surface them; the data ships now).
5. **Timeline** (`timeline.json`): rows revealed by `file` / `clue:<id>` / `locked`.
6. Every JSON is checked at boot by a friendly validator — a broken file shows a readable "the case file is damaged" overlay instead of a white screen.

Hotspot rects are in world units and must sit inside the matching art objects (see `docs/ASSETS.md` coordinates).

## 5. Accessibility & platform notes

- Text size (3 steps), hotspot shimmer toggle, colour-blind-safe clue accent (rust/cobalt/forest), subtitles for key sounds, no-penalty hints ("Think": nudge → stronger nudge → near-answer).
- Mouse + touch from day one: drag to pan rooms, pinch/wheel zoom in close-ups, thumb-sized hotspots, landscape-first layout with FIT letterboxing.
- Autosave after every meaningful action; save codes travel between devices.

## 6. Milestone roadmap

- [x] **M1 (this build)** — vertical slice + prologue: parallax rooms, hotspots with close-ups and nested reveals, notebook (4 tabs), autosave + save codes, one deduction gate unlocking the parlour, Act-1 gate + end card, hub map, PWA shell, accessibility settings.
- [ ] **M2** — hub tools & transitions: UV torch, tape measure, page-turn variants, per-room ambience.
- [ ] **M3** — evidence board & deduction engine (string links between clues).
- [ ] **M4** — interrogations with Ink (inkjs) behind the existing DialogueVM interface.
- [ ] **M5** — full case content, act by act (the case bible is the source of truth).
- [ ] **M6** — polish: audio (Howler), captions for all key sounds, performance pass (texture atlas + WebP for photographic layers if ever added).

## 7. Verification

The golden path was verified end-to-end in a real browser (agent-browser): start → case file → Sergeant Hollis briefing → hub → hall (7 clues, nested reveals) → Gate 1 (wrong + correct attempts) → parlour (9 clues + 2 nested) → Gate 2 → end card → notebook tabs → settings → save-code export/import → mobile landscape → Think hints. `bun run lint` and `npx tsc --noEmit` pass clean.
