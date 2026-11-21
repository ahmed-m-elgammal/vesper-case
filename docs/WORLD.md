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
   ├─ first time in: firstEntry narration beats (once, flag "seen:interior")
   ├─ click CAPTAIN BRECHE'S OFFICE  -> conversation graph 'captain'
   ├─ click SERGEANT HOLLIS          -> conversation graph 'hollis_station'
   ├─ click CONSTABLE DEWI           -> conversation graph 'dewi_station'
   ├─ click YOUR BADGE (brass name-plate) -> service record (CareerView)
   ├─ click the DUTY BOARD / WINDOW / WATER COOLER  -> flavour lines
   ├─ click the STAIRS               -> the upper floor
   └─ click YOUR DESK (Desk 14)      -> opens the case files
        ▼  sketch-wipe
Precinct upper floor (StationUpScene -- canteen + archive, art: /art/station_up.svg)
   ├─ first time in: firstEntry narration beats (flag "seen:upper")
   ├─ click MISS ADA QUILL           -> conversation graph 'quill_archive'
   ├─ click DR. BARNABY CRAY         -> conversation graph 'cray_canteen'
   ├─ click the SHELVES / KETTLE / RADIO / RECORDS ROOM -> flavour + locked lines
   └─ click the STAIRS               -> back to the bullpen
        ▼
Case files (CaseFilesView -- folders from cases.json)
   ├─ first entry ever: intro beats (world.json intro, shown once)
   └─ pick the Vesper folder -> captain's memo (the first-case story)
        ▼  "Take the case -- your first"
Prologue storybook -> dollhouse hub -> Act I rooms  (cases/vesper bundle)
        ▼  finale gate solved
End card ("Take it back to the precinct") -> Precinct interior
   └─ the staff's conversations now offer their "case closed" branches
   └─ if the closure crossed a career threshold -> promotion ceremony, then
      the service record counts toward the next grade
```

Mid-case, the HUD shows a **Precinct** button (only on the dollhouse map): it saves your place in the house and walks you back to the bullpen. Selecting the Vesper folder again resumes exactly where you left off (prologue page, room, clues, flags, deductions).

## 2. Data files

### `public/content/world.json` — the precinct
- **`detective`** — Elias Byrne's identity: name, rank, badge, desk, tagline, four backstory paragraphs (records room, the exam, the misfiled Lantern Alley letter, Hollis's nickname for him).
- **`intro`** — the five hand-written beats shown once when the player first reaches the precinct (`introSeen` flag in the save).
- **`career`** — the promotion ladder, pure data: `explanation` (the in-fiction rule), `ceremony[]` (framing lines for the commendation card), and `ranks[]` — `{ id, title, after, note }` where `after` is the number of closed cases the grade requires (thresholds must increase; `ranks[0].after` is 0). Six ranks ship: Grade I → II → III → Inspector → Chief Inspector → Superintendent, one grade per ten closures.
- **`exterior` / `interior` / `upper`** — station scenes. Each has `art`, `title`, `ambientCaption` (subtitle-friendly), optional `firstEntry` (`{ flag: "seen:<level>", lines[] }` — once-only narration on first walk-in) and `hotspots[]`: `{ id, spot [x,y,w,h on 1920x1080 art], label, kind, ... }` with kinds:
  - `door` (`to: 'exterior' | 'interior' | 'upper'`) — moves between levels (exterior↔interior↔upper, enforced by the validator);
  - `files` — opens the desk drawer (case registry);
  - `dialogue` (`dialogue: graphId`) — starts a world conversation;
  - `career` — opens the service record (rank ladder, folder history, personnel notes);
  - `flavor` (`line`) — toast flavour;
  - `locked` (`line`) — future content, stamped answer.
- **`people`** — station staff records (`name`, `shortName`, `initial`, `tint`, optional `portrait`, optional `role`) used by the dialogue sheet. Station portraits: `captain.svg`, `hollis.svg`, `dewi.svg`, `quill.svg`, `cray.svg`.
- **`graphs`** — station dialogue graphs, identical node/choice format to case graphs (see `docs/DIALOGUE.md`). They run on the same engine-neutral runner with **world scope**: their flags/vars land in `state.station` (precinct memory), so they must not reference case clues. Localisation works the same (`@key` into `locales/en.json`). Special world flags to react to in content: `case:taken` (a folder is in play) and `case:<caseId>:solved` (the finale gate closed it) — the captain's, Hollis's, Dewi's, Quill's and Cray's graphs all have conditional "case closed" branches off the second.

### `public/content/cases.json` — the desk
One row per folder: `{ id, code, title, subtitle, status, slot, accent, difficulty, location, victim, pitch, memo[], rankRequired? }`.
- `id` must match a directory `/content/cases/<id>/` holding that case's bundle.
- `status`: `available` (playable now), `sealed` (rank-gated), `cold` (cold case), `soon` (being authored). Only `available` folders can be taken; everything else shows its memo and a stamp.
- `rankRequired` (optional): a career rank title (`career.ranks[].title`). While the detective's grade is below it, the folder reads SEALED and its detail page shows live unlock progress ("Sealed until Detective Grade II -- 0 / 10 cases closed"). The pier folder opens at Grade II, the Lantern Alley cold case at Grade III.
- `memo` is the captain's note shown on the folder's detail page — for the Vesper case it **is** the first-case story.

### `public/content/cases/vesper/` — the case bundle
`case.json`, `suspects.json`, `rooms.json`, `clues.json`, `gates.json`, `timeline.json`, `prologue.json`, `dialogue.json`, `chains.json` (optionally `locale.json`, merged over the global table). Shapes are unchanged from Build One; only the location moved into per-case directories.

## 3. Progression model (GameState v3)

```
state = {
  phase: 'station' | 'prologue' | 'hub' | 'room',
  stationLevel: 'exterior' | 'interior' | 'upper',
  introSeen: boolean,
  activeCaseId: string | null,
  roomId: string | null,                    // live mirror for routing
  cases: { [caseId]: CaseProgress },        // PER-CASE progress
  station: { flags, vars },                 // WORLD-scope memory
  career: { promotionsSeen: string[], pending: string | null },
  settings, updatedAt
}
CaseProgress = { openedAt, solved, phase, roomId, prologuePage, prologueDone,
                 flags, vars, clues, gates, hintsUsed }
```

- Taking a folder creates/activates its `CaseProgress`; solving the case's final gate (`onSolve.endCard`) marks it `solved` — the desk stamp updates automatically, the world flag `case:<id>:solved` lets the staff react, and the end card walks you back to the precinct.
- **Career:** `GameVM.solvedCount()` counts solved folders; `currentRank()` is the highest career rank whose `after` threshold is met. Crossing a threshold queues `career.pending` — the next arrival at the precinct plays the **commendation ceremony** (`PromotionCard`), then the rank is filed in `career.promotionsSeen`. The service record (brass name-plate on desk 14) shows the ladder, the count, folder history and Elias's personnel notes.
- Station NPC conversations write `talked:*` flags into `state.station`, so the precinct remembers you across cases ("case:taken", "case:vesper:solved", "talked:captain:any", "talked:quill:letter"...).
- Old saves (v1/v2, flat) migrate into `cases.vesper` on first load; mid-case saves resume in the house, untouched saves restart in the street. The `career` block is additive — old saves start it empty.

## 4. How to add a new case (author-only workflow)

1. Create `/public/content/cases/<slug>/` and author the nine bundle JSONs (copy the shapes from `vesper/`).
2. Add one row to `/public/content/cases.json` with `status: "available"` (or `sealed`/`cold`/`soon` to ship it as a stamped folder first).
3. Draw the room + close-up SVGs under `/public/art/`.
4. Boot. The validator checks the bundle (clue/gate/graph/locale integrity) and the desk shows the folder automatically — engine code never changes.

To grow the station itself, edit `world.json`: add a hotspot (+ one SVG), a staff member (`people` + `graphs` + portrait), a scene's `firstEntry` narration, or career ranks. `validateWorld` enforces shape, the floor plan (exterior↔interior↔upper), rank thresholds, and dialogue/locale references at boot.

## 4.1 How to add a promotion rank or a rank-gated case

1. Append a rank to `career.ranks` with the next threshold (`after: 60`, a `title`, a `note`) — the ceremony, service record and desk header pick it up as data.
2. Give any folder in `cases.json` a `rankRequired` matching that title; the desk shows the unlock progress automatically and `GameVM.selectCase` refuses the folder until the grade is earned.

## 4.2 How to add a new station level (if ever needed)

1. Draw a 1920x1080 SVG, add the scene block to `world.json` (`art`, `title`, `ambientCaption`, `firstEntry`, `hotspots`).
2. Add the level to `StationLevel`/`DOOR_TARGETS` in `types.ts` + `validate.ts` and to `PhaserHost.STATION_KEY` + `LEVEL_BY_KEY` in `StationSceneBase.ts`.
3. Add a thin scene class (see `StationUpScene.ts` — ten lines) and register it in `PhaserHost`'s scene list.

## 5. Engine seams worth knowing

- `WorldRepository` (`data/ContentRepository.ts`) owns world.json + cases.json + the global locale; `ContentRepository.loadCase(id)` loads/validates one bundle and can be swapped at runtime (`GameVM.attachRepo`) — that swap is the world-expansion seam.
- `StationSceneBase` renders any station scene purely from data; kinds map to intents through `SceneCtx.hooks`.
- `DialogueVM.openGraph` resolves case graphs first, then world graphs, and switches `GameVM.dialogueScope` so effects land in the right memory.
- `CaseFilesView` renders the registry + save status (`caseStatusFor`) and delegates to `GameVM.selectCase`.
