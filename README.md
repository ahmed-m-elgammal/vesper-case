# Ink & Ashes — The Precinct Files

A browser-based detective deduction game with a hand-drawn storybook look, built on a **data-driven MVVM architecture**. You are Detective Elias Byrne, Grade I, badge 4613, desk 14 at the Old Town Precinct. When you open the game you step out into the rain, click the precinct door, walk to your desk — and choose a case folder. The world is bigger than one mystery now; the folders on your desk decide what you work tonight.

**This build ships the Precinct hub + Prologue + Act I**: a drawn police station (exterior street with rain, interior bullpen), the desk case-file registry (one playable case + three data-authored future folders), the captain's first-case memo, station staff you can actually talk to (Captain Breche, Sergeant Hollis — the same branching dialogue system as the interrogations), and the full Vesper case Act I inside 7 Hollow Lane (21 evidence items, 2 deduction gates, notebook, autosave, save codes). Acts 2–5 of the Vesper case remain authored data waiting for their milestones.

---

## 1. Quick start

```bash
bun install          # or npm install
bun run lint         # eslint (passes clean)
npx tsc --noEmit     # typecheck (passes clean)
npm run test:dialogue  # conversation-runtime engine tests (node, no browser)
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
   world.json            THE PRECINCT: detective lore, station scenes + hotspots,
                         station staff, station dialogue graphs
   cases.json            THE DESK: case registry (folders, statuses, memos)
   cases/<id>/           one directory per case: case.json, suspects.json,
   (vesper/)             rooms.json, clues.json, gates.json, timeline.json,
                         prologue.json, dialogue.json, chains.json
   locales/en.json       global locale table for "@key" text indirection
        │  validated at boot (validate.ts; schemas in /public/content/schemas)
        ▼
MODEL    GameState (src/game/data/types.ts, v3) — per-case progress records
        under state.cases[activeCaseId] + world-scope station memory,
        persisted by SaveSystem (v1/v2 saves migrate forward)
        ▼
VIEWMODELS (src/game/viewmodels)         <- Observable<T> / Computed<T>
   GameVM (root: state, intents, precinct + case routing, toasts, settings,
          gates, autosave; swaps the active case's ContentRepository)
   RoomVM (hotspots: clues + doors, tool gating, door decisions)
   NotebookVM (clue cards / people / timeline rows / threads)
   GateVM (chip pool, slots, JSON-rule validation)
   DialogueVM (graph-runner adapter: typewriter, choices, evidence present,
          bearing; resolves graphs from the case bundle OR the world)
   HintVM  (three-tier Think)
        ▼
VIEWS
   Phaser scenes (src/game/views/phaser): StationExtScene (rainy street),
     StationIntScene (bullpen, data-driven hotspots), HubScene (dollhouse),
     RoomScene (parallax layers, drag pan, hotspots) — render + intent only
   DOM overlays (src/game/views/overlays): Start, StationIntroCard, CaseFiles
     (desk folders + captain memo), Prologue storybook, Close-up (zoom +
     nested reveals), Gate, Notebook, Dialogue, HUD, Menu, Hints, Toasts,
     sketch-wipe Transition, End card
        ▼
GameRoot (src/game/views/GameRoot.ts) — composition root: phase routing
   (station/prologue/hub/room), overlay z-order, case-bundle swaps; contains
   no case logic.
```

Rules of the architecture:

- Views never mutate state; they call ViewModel methods and subscribe to observables (`src/game/core/Observable.ts`).
- All world and case facts live in JSON. Adding a case = adding `/content/cases/<id>/` + a registry row; adding a station room or NPC = editing `world.json` (+ one SVG). No engine code changes.
- Two progression scopes: **per-case** (`state.cases[id]`: clues/flags/vars/gates) and **world-scope** (`state.station`: precinct NPC memory like `talked:captain:any`). Dialogue effects follow the graph's origin (case bundle vs world).
- Persistence: autosave (debounced) to **IndexedDB** after every clue/deduction/flag/setting change, with a localStorage fallback, plus export/import **save codes** (`IA1|base64|fnv1a`) in Menu → Save. Old v1/v2 saves migrate into the precinct automatically.

## 3. Project structure

```
src/app/            Next.js host (page.tsx mounts the game browser-only via ssr:false)
src/game/
  main.ts           mountGame(container) entrypoint
  GameHost.tsx      client-only mount component
  style.css         the whole storybook stylesheet
  core/             Observable, Computed, EventBus, DOM builder + bind helpers
  dialogue/         ENGINE-NEUTRAL conversation runtime: graph types, condition
                    evaluator, DialogueRunner state machine, locale resolver
                    (no DOM / Phaser / VM imports -- unit-tested in Node)
  data/             types (content + GameState), validators, ContentRepository
  save/             SaveSystem (IndexedDB v3 saves + v1/v2 migration, save codes)
  viewmodels/       GameVM, RoomVM, NotebookVM, GateVM, DialogueVM, HintVM
  views/
    GameRoot.ts     composition root / phase router
    phaser/         PhaserHost, StationExtScene, StationIntScene (data-driven
                    hotspots), HubScene, RoomScene (people figures), SceneCtx
    overlays/       Start, StationIntroCard, CaseFiles (desk folders), Prologue,
                    Notebook, CloseUp, Gate, Dialogue (+evidence picker), HUD,
                    Menu, Hint, Toast, Transition, EndCard
public/
  art/              hand-inked SVG layers (rooms, hub, plan) + closeups/*.svg
                    + people/*.svg (case + station portraits)
                    + station_ext.svg / station_int.svg (the precinct)
  content/          world.json + cases.json + cases/<id>/ bundles
                    + locales/en.json + schemas/*.schema.json
  icons/            PWA icons        manifest.webmanifest, sw.js
docs/               CASE_BIBLE.md (full truth), DIALOGUE.md (conversations),
                    WORLD.md (the precinct + how to add a case), ASSETS.md
scripts/            gen_icons.py, test-dialogue-runner.ts, walkthrough scripts
```

## 4. Content authoring guide

0. **The precinct** (`world.json`, see `docs/WORLD.md`): detective identity + backstory, first-entry intro beats, exterior/interior scenes (art + `hotspots` — `door`/`files`/`dialogue`/`flavor`/`locked`), station staff (`people`) and their conversation `graphs`.
1. **Case registry** (`cases.json`): one row per desk folder — id (must match `/content/cases/<id>/`), code, title, status (`available` / `sealed` / `cold` / `soon`), pitch, and the captain's memo. The desk renders this; playability is data.
2. **Case bundle** (`cases/<id>/*.json`): the same shapes as before — rooms, clues, gates, suspects, timeline, prologue, dialogue graphs, chains (validated per case).
3. **Rooms** (`rooms.json`): id, act, width/height (2400x900), ordered layers (SVG path + scrollFactor for parallax), doors (with `lockedByGate` / `lockedAct`), hub plate rect, three-tier hints.
4. **Clues** (`clues.json`): id, name, room + world-space `spot` rect (matching the art), optional `tool` gate, close-up SVG + notebook note, chain ids, optional `timeline` link, optional `reveals` (nested clues inside the close-up, e.g. "search his pockets").
5. **Gates** (`gates.json`): fill-in-the-sentence slots (`before`/`after` text, `answer`, `chips` pool with distractors), `requiresClues`, and `onSolve` rewards (flags, unlocked rooms, dialogue, end card).
6. **Suspects** (`suspects.json`): public statement + hidden `secret` / `lie` / `redHerring` (Act 5 systems will surface them; the data ships now).
7. **Timeline** (`timeline.json`): rows revealed by `file` / `clue:<id>` / `flag:<id>` / `locked`.
8. **Conversations** (`dialogue.json` for case people, `world.json` `graphs` for station staff — see `docs/DIALOGUE.md`): beats (`npc`/`you`/`narrator`), choices with `cond` (clue/flag/trust AST), `effects` (flags, additive trust vars, testimony clues), evidence `reactions` (hit / `once` / again / miss).
9. **Localization hooks**: conversation text is `"@key"` indirection into `locales/en.json`; adding a locale file adds a language with zero engine changes.
10. Every JSON is checked at boot by a friendly validator (including graph integrity and locale-key coverage) — a broken file shows a readable "the case file is damaged" overlay instead of a white screen.

Hotspot rects are in world units and must sit inside the matching art objects (see `docs/ASSETS.md` coordinates).

## 5. Accessibility & platform notes

- Text size (3 steps), hotspot shimmer toggle, colour-blind-safe clue accent (rust/cobalt/forest), subtitles for key sounds, no-penalty hints ("Think": nudge → stronger nudge → near-answer).
- Mouse + touch from day one: drag to pan rooms, pinch/wheel zoom in close-ups, thumb-sized hotspots, landscape-first layout with FIT letterboxing.
- Autosave after every meaningful action; save codes travel between devices.

## 6. Milestone roadmap

- [x] **M1** — vertical slice + prologue: parallax rooms, hotspots with close-ups and nested reveals, notebook (4 tabs), autosave + save codes, one deduction gate unlocking the parlour, Act-1 gate + end card, hub map, PWA shell, accessibility settings.
- [x] **M4 (dialogue, shipped early)** — branching conversations: engine-neutral graph runner (conditions, variables, localization hooks), people hotspots with tinted figures, evidence presentation with per-suspect reactions, catchable lies (Peggy's clock), trust/bearing meter, notebook People tab live updates, Act-1 interrogations for Colette / Tobias / Peggy. An Ink (inkjs) adapter can implement the same runner interface later for Act-5 prose-heavy interrogations.
- [x] **M2.5 (the precinct, shipped early)** — case-selection hub: drawn police station (rainy exterior + bullpen interior with data-driven hotspots), desk case-file registry (world expansion by data), detective's first-case story (intro beats + captain's memo), talkable station staff (Captain Breche, Sergeant Hollis) on the same dialogue runtime, per-case save records (GameState v3) with v1/v2 migration, Precinct button to leave the house mid-case.
- [ ] **M2** — hub tools & transitions: UV torch, tape measure, page-turn variants, per-room ambience.
- [ ] **M3** — evidence board & deduction engine (string links between clues).
- [ ] **M5** — full case content, act by act (the case bible is the source of truth).
- [ ] **M6** — polish: audio (Howler), captions for all key sounds, performance pass (texture atlas + WebP for photographic layers if ever added).

## 7. Verification

The golden path was verified end-to-end in a real browser (agent-browser): start → case file → Sergeant Hollis briefing → hub → hall (7 clues, nested reveals) → Gate 1 (wrong + correct attempts) → parlour (9 clues + 2 nested) → Gate 2 → end card → notebook tabs → settings → save-code export/import → mobile landscape → Think hints. The dialogue milestone adds: engine tests (`npm run test:dialogue`, 6 scenarios in Node) and a browser walkthrough of a full interrogation (`scripts/walkthrough-dialogue.sh`) — topics, evidence presentation, a caught lie, bearing shifts. `bun run lint` and `npx tsc --noEmit` pass clean.
