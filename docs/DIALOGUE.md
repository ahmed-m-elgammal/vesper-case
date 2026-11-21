# The Dialogue System — a data-driven conversation runtime

Build two of *Ink & Ashes* ships a full branching dialogue system: the
detective can talk to the household in Act 1, present evidence in front of
them, catch lies, and watch a trust ("bearing") meter move. This document
explains the authoring-tool decision, the format, and how to write new
conversations.

---

## 1. Why a custom runner (and not Ink or Yarn Spinner)

The brief allowed three options: **Ink (.ink / inkjs)**, **Yarn Spinner
(.yarn)**, or a **custom data-driven runner**. Decision: **custom runner**,
for reasons that follow directly from this project's architecture:

| | Ink (inkjs) | Yarn Spinner | Custom JSON runner (chosen) |
|---|---|---|---|
| Authoring format | `.ink` prose → **compiled** by inklecate into a weave JSON | `.yarn` text → needs a parser/compiler | Hand-authored JSON, same pipeline as rooms/clues/gates |
| Data-driven? | The runtime input is compiler output, not authorable data | Half — syntax is data, store lives inside the runtime | Fully — the graph **is** the content, validated at boot |
| Conditions on game state | External functions glued in per integration | Yarn variables are sandboxed from game state | Conditions read GameState directly (clues, flags, trust vars) |
| Evidence presentation | Would need custom glue anyway | Same | First-class choice type + per-suspect reaction table |
| Dependencies | inkjs + a compile step in CI | a parser/compiler dependency | **zero** — one 200-line state machine |
| Engine-neutral | inkjs is DOM-agnostic | yarn runtime is engine-agnostic | The runner imports no DOM, no Phaser, no VM — it runs in Node tests |
| Localization | Tag-based, tooling-heavy | CSV export tooling | `"@key"` indirection into `locales/en.json` — add a locale file, done |

The interface boundary is kept deliberately clean: `DialogueVM` wraps the
runner, so if a future act wants Ink's prose power for the Act-5
interrogations, an inkjs-backed graph adapter can implement the same
`DialogueContext`/snapshot contract without touching any view code. The
runner (`src/game/dialogue/runner.ts`) is the engine-neutral core: it is
unit-tested in Node (`npm run test:dialogue`) with no DOM or Phaser involved.

## 2. Where things live

```
src/game/dialogue/
  types.ts        graph / node / beat / choice / condition / effects types
  conditions.ts   the condition-AST evaluator (pure function)
  runner.ts       DialogueRunner state machine + legacy-node converter
  loc.ts          "@key" locale resolver (table from locales/en.json)
src/game/viewmodels/DialogueVM.ts   typewriter + observables + present flow
src/game/views/overlays/DialogueView.ts   sheet UI + evidence picker
public/content/dialogue.json   { nodes: [...legacy], graphs: {...} }
public/content/locales/en.json every "@key" used by dialogue + UI
scripts/test-dialogue-runner.ts  engine tests (node)
```

## 3. The format

A **graph** per talkable person (id = suspect id). Nodes contain **beats**
(spoken lines) and **choices**. Everything is data:

```jsonc
"peggy": {
  "id": "peggy", "suspect": "peggy",
  "speaker": "@dlg.name.peggy",
  "start": "root",
  "presents": { "miss": "present_miss", "again": "present_again" },
  "reactions": {
    "hall_clock": { "next": "r_clock", "once": "asked:peggy:pr-clock" },
    "scissors_sideboard": { "next": "r_scissors", "once": "asked:peggy:pr-scissors" }
  },
  "nodes": {
    "root": {
      "beats": [
        { "sp": "npc", "t": "@dlg.peggy.root.1" },
        { "sp": "you", "t": "@dlg.peggy.root.q1" }
      ],
      "choices": [
        { "text": "@dlg.peggy.root.c1", "next": "evening" },
        { "text": "@dlg.peggy.root.c4", "next": "scissors",
          "cond": { "clue": "scissors_sideboard" } },
        { "text": "@dlg.peggy.root.c5", "next": "money",
          "cond": { "trust": "trust:peggy", "gte": 1 } },
        { "text": "@dlg.ui.present", "present": { "miss": "present_miss" } },
        { "text": "@dlg.ui.leave", "next": "bye" }
      ]
    },
    "scissors": {
      "beats": [ { "sp": "npc", "t": "@dlg.peggy.scissors.1" } ],
      "effects": {
        "setFlags": ["talked:peggy:scissors"],
        "addClues": ["peggy_scissors_ownup"],
        "setVars": { "trust:peggy": 1 }
      },
      "next": "root"
    },
    "bye": { "beats": [ ... ], "end": true }
  }
}
```

- **Beats**: `sp` is `npc` (default), `you` (the detective), or `narrator`
  (italic, no typewriter). `t` is raw text or `"@key"`.
- **Choices**: `next` jumps, `cond` gates visibility, `present` opens the
  evidence picker, `close` ends the conversation, `effects` fire on choice.
- **Node effects** (`effects`) fire when the node is **entered**: flags,
  additive numeric vars (`trust:peggy`), and clue grants (testimony).
- **Reactions**: when the player presents clue `X`, the graph jumps to
  `reactions[X].next`; `once` is a flag set on first fire, so repeats go to
  `presents.again`. Unknown clues land on `presents.miss`.
- **Node endings**: `next` (chain), `end: true` (close after beats), choices
  (wait for the player). A hub node loops back to `root` so conversations
  feel like interrogations, not scripts.

## 4. Conditions

A small JSON AST, evaluated against live game state:

```jsonc
{ "clue": "hall_clock" }              // the player holds this clue
{ "noClue": "x" } / { "flag": "f" } / { "noFlag": "f" } / { "asked": "f" }
{ "trust": "trust:peggy", "gte": 1 }  // numeric vars (lte also supported)
{ "all": [...], "any": [...], "not": {...} }
```

The boot validator checks every `clue`/`noClue` id against `clues.json`, so
a typo breaks loudly at load with a readable message, not in play.

## 5. Variables & bearing

`GameState.vars` (save v2) holds numbers like `trust:peggy`. Dialogue
effects mutate them additively; `GameVM.bearingKey()` maps the number to a
label (`icy / guarded / warming / open`) shown on the conversation sheet and
in the notebook's People tab. Conditions can branch on trust, so suspects
open up as they warm to the detective.

## 6. Localization hooks

Every new line of authored text is an `@key` into
`public/content/locales/en.json`. `resolveText()` (loc.ts) resolves keys
with `{param}` interpolation; raw strings pass through untouched (that is
what keeps the build-one briefing content working). Adding a language =
adding `locales/fr.json` with the same keys and loading it at boot — no
engine changes.

## 7. People in rooms

Rooms gain a `people` array; each entry is a suspect id + world-space rect
+ optional presence condition:

```jsonc
"people": [
  { "suspect": "colette", "spot": [2120, 470, 120, 300], "label": "Colette" },
  { "suspect": "peggy",   "spot": [2010, 480, 140, 300],
    "cond": { "flag": "parlour_open" } }
]
```

`RoomVM` derives person hotspots (conditions evaluated through the same
AST), `RoomScene` draws a pencil-sketch figure tinted with the suspect's
palette colour, and a tap opens the graph with the suspect's id. Portraits
come from `suspects.json` → `portrait` (a hand-drawn bust SVG).

## 8. Testing

- **Engine tests** (`npm run test:dialogue`): graph walk, condition gating,
  effects, present hit/again/miss, locale hooks, legacy conversion — all in
  Node, no browser.
- **Boot validator**: graph integrity (unknown nodes/clues/locale keys fail
  loudly), so content errors surface as readable text, never blank screens.
- **Browser walkthrough** (`scripts/walkthrough-dialogue.sh`): drives a real
  conversation end-to-end and captures screenshots.
