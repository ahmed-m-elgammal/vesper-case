# WORLD.md — the precinct, the desk, and how the world expands

Build Two turned *Ink & Ashes* from a single case into a **police-station world with a case registry**. This document explains the precinct architecture and, most importantly, **how to add a new case without touching engine code**.

## 1. The flow

```
Title card (StartView)
   └─ "Begin the night shift"
        ▼
Precinct exterior  (StationExtScene -- rainy street, art: /art/station_ext.svg)
   └─ click the DOOR (hotspot from world.json)
        ▼  sketch-wipe
Precinct interior  (StationIntScene -- the bullpen, art: /art/station_int.svg)
   ├─ click CAPTAIN BRECHE'S OFFICE  -> conversation graph 'captain'
   ├─ click SERGEANT HOLLIS          -> conversation graph 'hollis_station'
   ├─ click the DUTY BOARD / WINDOW / WATER COOLER  -> flavour lines
   ├─ click the EVIDENCE ROOM / ARCHIVE STAIRS      -> locked lines (future)
   └─ click YOUR DESK (Desk 14)      -> opens the case files
        ▼
Case files (CaseFilesView -- folders from cases.json)
   ├─ first entry ever: intro beats (world.json intro, shown once)
   └─ pick the Vesper folder -> captain's memo (the first-case story)
        ▼  "Take the case -- your first"
Prologue storybook -> dollhouse hub -> Act I rooms  (cases/vesper bundle)
```

Mid-case, the HUD shows a **Precinct** button (only on the dollhouse map): it saves your place in the house and walks you back to the bullpen. Selecting the Vesper folder again resumes exactly where you left off (prologue page, room, clues, flags, deductions).

## 2. Data files

### `public/content/world.json` — the precinct
- **`detective`** — Elias Byrne's identity: name, rank, badge, desk, tagline, four backstory paragraphs (records room, the exam, the misfiled Lantern Alley letter, Hollis's nickname for him).
- **`intro`** — the five hand-written beats shown once when the player first reaches the precinct (`introSeen` flag in the save).
- **`exterior` / `interior`** — station scenes. Each has `art`, `title`, `ambientCaption` (subtitle-friendly) and `hotspots[]`: `{ id, spot [x,y,w,h on 1920x1080 art], label, kind, ... }` with kinds:
  - `door` (`to: 'exterior' | 'interior'`) — moves between street and bullpen;
  - `files` — opens the desk drawer (case registry);
  - `dialogue` (`dialogue: graphId`) — starts a world conversation;
  - `flavor` (`line`) — toast flavour;
  - `locked` (`line`) — future content, stamped answer.
- **`people`** — station staff records (`name`, `shortName`, `initial`, `tint`, optional `portrait`) used by the dialogue sheet. Station portraits: `/art/people/captain.svg`, `/art/people/hollis.svg`.
- **`graphs`** — station dialogue graphs, identical node/choice format to case graphs (see `docs/DIALOGUE.md`). They run on the same engine-neutral runner with **world scope**: their flags/vars land in `state.station` (precinct memory), so they must not reference case clues. Localisation works the same (`@key` into `locales/en.json`).

### `public/content/cases.json` — the desk
One row per folder: `{ id, code, title, subtitle, status, slot, accent, difficulty, location, victim, pitch, memo[] }`.
- `id` must match a directory `/content/cases/<id>/` holding that case's bundle.
- `status`: `available` (playable now), `sealed` (rank-gated), `cold` (cold case), `soon` (being authored). Only `available` folders can be taken; everything else shows its memo and a stamp.
- `memo` is the captain's note shown on the folder's detail page — for the Vesper case it **is** the first-case story.

### `public/content/cases/vesper/` — the case bundle
`case.json`, `suspects.json`, `rooms.json`, `clues.json`, `gates.json`, `timeline.json`, `prologue.json`, `dialogue.json`, `chains.json` (optionally `locale.json`, merged over the global table). Shapes are unchanged from Build One; only the location moved into per-case directories.

## 3. Progression model (GameState v3)

```
state = {
  phase: 'station' | 'prologue' | 'hub' | 'room',
  stationLevel: 'exterior' | 'interior',
  introSeen: boolean,
  activeCaseId: string | null,
  roomId: string | null,                    // live mirror for routing
  cases: { [caseId]: CaseProgress },        // PER-CASE progress
  station: { flags, vars },                 // WORLD-scope memory
  settings, updatedAt
}
CaseProgress = { openedAt, solved, phase, roomId, prologuePage, prologueDone,
                 flags, vars, clues, gates, hintsUsed }
```

- Taking a folder creates/activates its `CaseProgress`; solving the case's final gate (`onSolve.endCard`) marks it `solved` — the desk stamp updates automatically.
- Station NPC conversations write `talked:*` flags into `state.station`, so the precinct remembers you across cases ("case:taken", "talked:captain:any", ...).
- Old saves (v1/v2, flat) migrate into `cases.vesper` on first load; mid-case saves resume in the house, untouched saves restart in the street.

## 4. How to add a new case (author-only workflow)

1. Create `/public/content/cases/<slug>/` and author the nine bundle JSONs (copy the shapes from `vesper/`).
2. Add one row to `/public/content/cases.json` with `status: "available"` (or `sealed`/`cold`/`soon` to ship it as a stamped folder first).
3. Draw the room + close-up SVGs under `/public/art/`.
4. Boot. The validator checks the bundle (clue/gate/graph/locale integrity) and the desk shows the folder automatically — engine code never changes.

To grow the station itself, edit `world.json`: add a hotspot (+ one SVG), a staff member, or a conversation graph. `validateWorld` enforces shape, door targets, and dialogue references at boot.

## 5. Engine seams worth knowing

- `WorldRepository` (`data/ContentRepository.ts`) owns world.json + cases.json + the global locale; `ContentRepository.loadCase(id)` loads/validates one bundle and can be swapped at runtime (`GameVM.attachRepo`) — that swap is the world-expansion seam.
- `StationSceneBase` renders any station scene purely from data; kinds map to intents through `SceneCtx.hooks`.
- `DialogueVM.openGraph` resolves case graphs first, then world graphs, and switches `GameVM.dialogueScope` so effects land in the right memory.
- `CaseFilesView` renders the registry + save status (`caseStatusFor`) and delegates to `GameVM.selectCase`.
