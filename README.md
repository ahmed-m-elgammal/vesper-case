# Ink & Ashes — The Precinct Files

A browser-based detective deduction game with a hand-drawn storybook look, built on a **data-driven MVVM architecture**. You are Detective Elias Byrne, Grade I, badge 4613, desk 14 at the Old Town Precinct. When you open the game you step out into the rain and **walk** — free 360-degree movement, around the furniture, through doorways, behind Constable Dewi and the water cooler — to your desk, where the case folders wait. The world is bigger than one mystery now; the folders on your desk decide what you work tonight.

**This build ships the Walking Precinct + Prologue + Acts I, II & III**: a drawn police station (exterior street with rain, interior bullpen, upper canteen/archive) that you now physically walk with the detective (WASD/arrows or tap-to-move with A* pathfinding, Y-sorted furniture, per-level position memory), the desk case-file registry (one playable case + three data-authored future folders), the captain's first-case memo, station staff you can actually talk to, and the Vesper case inside 7 Hollow Lane: Act I (the hall + the parlour, poison and hearth and bolt), Act II (the kitchen and the upper landing, the dark half hour) **and Act III (the study, the bedrooms and the bathroom, 36 evidence items, 4 deduction gates, the UV torch finally earning its keep, forgery resolved and the confession's carbons found)**, notebook, autosave, save codes. Acts 4–5 of the Vesper case (attic + the twist, interrogations + accusation) remain authored data waiting for their milestones.

**Play it live**: <https://ahmed-m-elgammal.github.io/vesper-case/> (deployed by the Pages workflow on every push to `main`; first enablement is one click — Settings → Pages → Source: **GitHub Actions**).

---

## 1. Quick start

```bash
bun install          # or npm install
bun run lint         # eslint (passes clean)
npx tsc --noEmit     # typecheck (passes clean)
npm run test:dialogue  # conversation-runtime engine tests (node, no browser)
bun run dev          # Next.js dev server on port 3000 — open the preview
```

Production static deploy (GitHub Pages — automated, see `.github/workflows/deploy-pages.yml`):

```bash
NEXT_PUBLIC_BASE_PATH=/vesper-case npx next build   # fully static export in out/
# the workflow pushes it to Pages on every commit to main
```

Other static hosts (Cloudflare Pages / itch.io) work the same way; locally, `npm run build && npm run start` serves the standalone production build. The export boots and plays with zero server: the base path (`NEXT_PUBLIC_BASE_PATH`) is prefixed onto every content/art URL at build time (`src/game/core/assetUrl.ts`).

The game is fully client-side: Phaser rooms + plain DOM overlays + JSON content, no server needed. The service worker (`public/sw.js`) precaches the shell and runtime-caches content/art for offline play (registered in production builds only).

## 2. Architecture — data-driven MVVM

```
CONTENT (JSON, /public/content)          <- authors touch ONLY this
   world.json            THE PRECINCT: detective lore, station scenes + hotspots,
                         station staff, station dialogue graphs
   cases.json            THE DESK: case registry (folders, statuses, memos)
   cases/<id>/           one directory per case: case.json, suspects.json,
   (vesper/)             rooms.json, clues.json, gates.json, timeline.json,
                         prologue.json, dialogue.json, chains.json, endCards.json
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
   Phaser scenes (src/game/views/phaser): StationSceneBase (the shared walking
     precinct renderer: Y-sorted props + walker + walk-then-interact),
     StationPlayer (360° movement, grid A*, collision), StationExt/Int/UpScene
     (thin data-backed subclasses), HubScene (dollhouse),
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
- All world and case facts live in JSON. Adding a case = adding `/content/cases/<id>/` + a registry row; adding a station room, NPC or piece of furniture = editing `world.json` (+ one SVG). No engine code changes.
- **Walking geometry is data too** (`world.json` `nav` per level): walkable rect unions, collider footprints (furniture baked into the art), depth-sorted `props` (overlay sprites with a `base` floor-line — the water cooler, Constable Dewi), `spawn`/`spawnNear` per origin door, and hotspot `standPoints`. Hotspot rects stay interaction-only; collision is separate geometry, so overlapping visuals never block valid paths.
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
    phaser/         PhaserHost, StationSceneBase (walker host, Y-sort, ?nav=1
                    debug overlay), StationPlayer (360° controller: WASD/arrows
                    + tap-to-move, grid A* + string-pulling, circle-vs-rect
                    collision, facing/walk cycle), StationExt/Int/UpScene,
                    HubScene, RoomScene (people figures), SceneCtx
    overlays/       Start, StationIntroCard, CaseFiles (desk folders), Prologue,
                    Notebook, CloseUp, Gate, Dialogue (+evidence picker), HUD,
                    Menu, Hint, Toast, Transition, EndCard
public/
  art/              hand-inked SVG layers (rooms, hub, plan) + closeups/*.svg
                    + people/*.svg (case + station portraits)
                    + station_ext/int/up.svg (the precinct)
                    + player/*.svg (the detective's 9 walk frames)
                    + station_int_dewi.svg + station_int_cooler.svg (Y-sort props)
  content/          world.json + cases.json + cases/<id>/ bundles
                    + locales/en.json + schemas/*.schema.json
  icons/            PWA icons        manifest.webmanifest, sw.js
docs/               CASE_BIBLE.md (full truth), DIALOGUE.md (conversations),
                    WORLD.md (the precinct + how to add a case), ASSETS.md
scripts/            gen_icons.py, test-dialogue-runner.ts, walkthrough scripts
```

## 4. Content authoring guide

0. **The precinct** (`world.json`, see `docs/WORLD.md`): detective identity + backstory, first-entry intro beats, exterior/interior/upper scenes (art + `hotspots` — `door`/`files`/`dialogue`/`flavor`/`locked`/`career`, plus once-only `firstEntry` narration), each level's `nav` block (`spawn`, `spawnNear`, walkable `walk` rects, `colliders`, depth-sorted `props`, `standPoints`, `reach`), station staff (`people`) and their conversation `graphs`, and the **career ladder** (`career.ranks` — promotion every 10 closed cases; folders in `cases.json` can set `rankRequired` to a rank title to gate by grade).
1. **Case registry** (`cases.json`): one row per desk folder — id (must match `/content/cases/<id>/`), code, title, status (`available` / `sealed` / `cold` / `soon`), optional `rankRequired` (career grade that unlocks the folder), pitch, and the captain's memo. The desk renders this; playability is data.
2. **Case bundle** (`cases/<id>/*.json`): the same shapes as before — rooms, clues, gates, suspects, timeline, prologue, dialogue graphs, chains (validated per case).
3. **Rooms** (`rooms.json`): id, act, width/height (2400x900), ordered layers (SVG path + scrollFactor for parallax), doors (with `lockedByGate` / `lockedAct`), hub plate rect, three-tier hints.
4. **Clues** (`clues.json`): id, name, room + world-space `spot` rect (matching the art), optional `tool` gate, close-up SVG + notebook note, chain ids, optional `timeline` link, optional `reveals` (nested clues inside the close-up, e.g. "search his pockets").
5. **Gates** (`gates.json`): fill-in-the-sentence slots (`before`/`after` text, `answer`, `chips` pool with distractors), `requiresClues`, and `onSolve` rewards (flags, unlocked rooms, **`openActs`** — the act the gate swings open — `dialogue`, `endCard`). Doors can carry `gateOnExit` to offer a closing deduction as you leave a room.
6. **Suspects** (`suspects.json`): public statement + hidden `secret` / `lie` / `redHerring` (Act 5 systems will surface them; the data ships now).
7. **Timeline** (`timeline.json`): rows revealed by `file` / `clue:<id>` / `flag:<id>` / `locked`.
8. **Conversations** (`dialogue.json` for case people, `world.json` `graphs` for station staff — see `docs/DIALOGUE.md`): beats (`npc`/`you`/`narrator`), choices with `cond` (clue/flag/trust AST), `effects` (flags, additive trust vars, testimony clues), evidence `reactions` (hit / `once` / again / miss).
9. **Localization hooks**: conversation text is `"@key"` indirection into `locales/en.json`; adding a locale file adds a language with zero engine changes.
10. Every JSON is checked at boot by a friendly validator (including graph integrity and locale-key coverage) — a broken file shows a readable "the case file is damaged" overlay instead of a white screen.

Hotspot rects are in world units and must sit inside the matching art objects (see `docs/ASSETS.md` coordinates).

## 5. Accessibility & platform notes

- Text size (3 steps), hotspot shimmer toggle, colour-blind-safe clue accent (rust/cobalt/forest), subtitles for key sounds, no-penalty hints ("Think": nudge → stronger nudge → near-answer).
- Mouse + touch from day one: **walk the precinct with WASD / arrow keys (diagonals included) or tap anywhere to walk there**; tapping a hotspot walks the detective to it first, then fires the interaction; E / Space / Enter interacts with whatever he is standing next to. Drag to pan rooms, pinch/wheel zoom in close-ups, thumb-sized hotspots, landscape-first layout with FIT letterboxing. Boot with `?nav=1` (or press N) to see the walkable/collision debug overlay.
- Autosave after every meaningful action; save codes travel between devices.

## 6. Milestone roadmap

- [x] **M1** — vertical slice + prologue: parallax rooms, hotspots with close-ups and nested reveals, notebook (4 tabs), autosave + save codes, one deduction gate unlocking the parlour, Act-1 gate + end card, hub map, PWA shell, accessibility settings.
- [x] **M4 (dialogue, shipped early)** — branching conversations: engine-neutral graph runner (conditions, variables, localization hooks), people hotspots with tinted figures, evidence presentation with per-suspect reactions, catchable lies (Peggy's clock), trust/bearing meter, notebook People tab live updates, Act-1 interrogations for Colette / Tobias / Peggy. An Ink (inkjs) adapter can implement the same runner interface later for Act-5 prose-heavy interrogations.
- [x] **M2.5 (the precinct, shipped early)** — case-selection hub: drawn police station (rainy exterior + bullpen interior with data-driven hotspots), desk case-file registry (world expansion by data), detective's first-case story (intro beats + captain's memo), talkable station staff (Captain Breche, Sergeant Hollis) on the same dialogue runtime, per-case save records (GameState v3) with v1/v2 migration, Precinct button to leave the house mid-case.
- [x] **M2.6 (the living precinct)** — upper floor (canteen + archive + records room, hand-drawn) with once-only first-entry narration per level; three new staff with full conversations (Constable Dewi, Miss Ada Quill — the records-room supervisor from the backstory, Dr. Barnaby Cray — the surgeon behind "the surgeon says poison"); captain + Hollis react to a closed case; **career ladder** (6 ranks, promotion ceremony every 10 closures, service record on the desk plaque with folder history + personnel notes), rank-gated folders with live unlock progress, end card returns to the precinct.
- [x] **M2.7 (the walking precinct)** — the detective now walks all three precinct levels: free 360-degree movement (WASD/arrows, normalized diagonals, accel/decel) plus tap-to-move with **grid A\* over the walkable-rect union** (string-pulled paths, no corner cutting); circle-vs-rect collision resolved axis-by-axis (slides along desks, never clips corners); **Y-axis depth sorting** — he passes behind Constable Dewi and the water cooler (overlay props with floor-line `base`); walk-then-interact flow (tap a hotspot → he walks to its stand point → the action fires; E/Space works when close); per-level position memory in the save; UI-block freeze while overlays are up; `?nav=1` debug overlay of walkable/colliders/stand points; the validator checks every spawn/stand point is walkable and unblocked.
- [x] **M5a (Act II, shipped)** — the kitchen and the upper landing open after the Act-1 gate (`onSolve.openActs`): 7 new clues (the burnt loaf, the pantry lantern, the wireless, wet flag prints, Colette's rounds book, the worn stair runner, Peggy's tonic glass), the gate-act2 deduction (offered by `gateOnExit` on the exit doors), data-driven **end cards** (`endCards.json`; only a `finale` card closes a folder — act closers walk you back into the house), new conversations (Colette's rounds, Tobias's wax, Peggy's tonic — plus 16 new evidence reactions), 2 new chains, timeline entries for 10:35/10:48/11:21, and hand-inked art: 6 room layers + 7 close-ups.
- [x] **M5b (Act III, shipped)** — the study, Peggy's room, Edmund's room and the bathroom open when gate-act2 closes (`openActs: [3]`): 8 new clues (the candle's mark, the final notice, Ruth's journal, the medicine cabinet, the blotter under the UV torch, the 10:19 cab receipt, the safe's carbon pages 40–43, the apprentice's tin), the gate-act3 deduction "What the Study Kept", end card `act-three-curtain`, 12 room layers + 8 close-ups (generator-scripted in the same hand-inked style), Peggy owning her lie and her debts, Tobias answering for his button and remembering the carbons, the forgery red herring resolved and the confession thread grown. The UV torch now genuinely unlocks (the HUD reads `tool_uv_granted`) — and room routing no longer builds duplicate RoomVMs.
- [ ] **M2** — hub tools & transitions: tape measure, page-turn variants, per-room ambience.
- [ ] **M3** — evidence board & deduction engine (string links between clues).
- [ ] **M5c** — Acts 4–5: attic + cellar + laundry (the twist), interrogations, the evidence board and the final accusation (culprit / method / motive).
- [ ] **M6** — polish: audio (Howler), captions for all key sounds, performance pass (texture atlas + WebP for photographic layers if ever added).

## 7. Verification

The golden path was verified end-to-end in a real browser (agent-browser): start → case file → Sergeant Hollis briefing → hub → hall (7 clues, nested reveals) → Gate 1 (wrong + correct attempts) → parlour (9 clues + 2 nested) → Gate 2 → end card → notebook tabs → settings → save-code export/import → mobile landscape → Think hints. The dialogue milestone adds: engine tests (`npm run test:dialogue`, 6 scenarios in Node) and a browser walkthrough of a full interrogation (`scripts/walkthrough-dialogue.sh`) — topics, evidence presentation, a caught lie, bearing shifts. The walking precinct adds `scripts/verify-movement.sh`: a scripted browser run that walks all three levels — keyboard diagonals, kerb clamping, tap-to-move, the captain's office through its doorway, depth occlusion behind Dewi and the cooler, the desk → case-files freeze/unfreeze cycle, stairs down and up with arrival-point spawns, and per-level save positions. `bun run lint`, `npx tsc --noEmit`, `npm run test:dialogue` and `scripts/validate-content.ts` pass clean.
