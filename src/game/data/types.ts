/**
 * Content schema types -- these mirror the JSON Schema files in
 * /public/content/schemas/. All case content is data-driven: the engine
 * reads these shapes, never hard-codes case facts.
 */

import type { DialogueCondition } from '../dialogue/types';

export type { DialogueCondition } from '../dialogue/types';
export type {
  DialogueGraph,
  DialogueBeat,
  DialogueBeatSpeaker,
  DialogueChoice,
  DialogueNodeV2,
  DialogueEffects,
  DialogueContext,
  LegacyDialogueNode,
} from '../dialogue/types';

export type Rect = [x: number, y: number, w: number, h: number];
export type ToolId = 'magnifier' | 'uv' | 'tape' | null;

export interface CaseMeta {
  title: string;
  subtitle: string;
  build: string;
  epigraph: string;
  location: string;
  dateLabel: string;
  weather: string;
  tod: string;
  clueAccent: string;
  victim: {
    name: string;
    age: number;
    found: string;
    cause: string;
    about: string[];
  };
  officialStory: string[];
  playerBrief: string[];
}

export interface Suspect {
  id: string;
  name: string;
  shortName: string;
  age: number;
  role: string;
  initial: string;
  tint: string;
  /** Hand-drawn bust SVG for the conversation sheet (optional). */
  portrait?: string;
  /** Where this person stands during Act 1 ("talk to people" hotspots). */
  where?: string;
  /** Statement taken by Sergeant Hollis the morning after (public info). */
  statement: string;
  /** Hidden until Act 5 -- present in data, never shown early. */
  secret: string;
  lie: string;
  redHerring: string;
}

export interface CloseUp {
  /** Path to the inline-SVG inset (or null for text-only). */
  svg: string | null;
  title: string;
  /** Extra lines shown under the inset. */
  caption?: string;
}

export interface Reveal {
  /** Spot inside the 800x600 close-up space. */
  spot: Rect;
  label: string;
  /** Clue id to collect + open. */
  clue: string;
}

export interface Clue {
  id: string;
  name: string;
  room: string | null;
  /** World-space hotspot; null for nested clues (opened via reveals). */
  spot: Rect | null;
  tool: ToolId;
  closeup: CloseUp;
  /** Notebook paragraph (the clue's meaning, written in the detective's voice). */
  note: string;
  /** One-line caption for toasts. */
  toast: string;
  chains: string[];
  /** Timeline entry revealed by this clue (optional). */
  timeline?: string;
  reveals?: Reveal[];
}

export interface RoomLayer {
  key: string;
  src: string;
  scrollFactor: number;
  depth: number;
}

export interface Door {
  to: string;
  spot: Rect;
  label: string;
  /** Gate that must be solved before this door opens. */
  lockedByGate?: string;
  /** Act label shown for not-yet-built rooms. */
  lockedAct?: string;
  /** Flavor line shown when locked without a gate. */
  lockedLine?: string;
}

/** A talkable person standing in a room (hotspot wired to a dialogue graph). */
export interface RoomPerson {
  /** suspects.json id -- the dialogue graph with the same id is opened. */
  suspect: string;
  /** World-space hotspot rect. */
  spot: Rect;
  /** Optional display label (defaults to the suspect's shortName). */
  label?: string;
  /** Presence condition -- person only stands here when it passes. */
  cond?: DialogueCondition;
}

export interface Room {
  id: string;
  title: string;
  act: number;
  width: number;
  height: number;
  layers: RoomLayer[];
  doors: Door[];
  people?: RoomPerson[];
  /** Hub cutaway placement (1920x1000 space). */
  hubPlate: Rect;
  hubLabel: string;
  hubAct: number;
  hints: { tier1: string; tier2: string; tier3: string };
}

export interface GateSlot {
  before: string;
  after?: string;
  answer: string;
  chips: string[];
}

export interface Gate {
  id: string;
  title: string;
  prompt: string;
  requiresClues: string[];
  slots: GateSlot[];
  onSolve: {
    flags?: string[];
    unlockRooms?: string[];
    dialogue?: string;
    endCard?: string;
  };
}

export interface TimelineEntry {
  id: string;
  time: string;
  text: string;
  /** 'file' = known from the case file; 'clue:<id>' = revealed by evidence;
   *  'locked' = future build. */
  revealedBy: string;
}

export interface Chain {
  id: string;
  name: string;
  blurb: string;
  clueIds: string[];
}

export type PrologueTemplate =
  | 'cover'
  | 'letter'
  | 'victim'
  | 'plan'
  | 'story'
  | 'suspects'
  | 'kit'
  | 'begin';

export interface ProloguePage {
  id: string;
  template: PrologueTemplate;
  title?: string;
  body?: string[];
  letter?: { to: string; lines: string[]; sign: string };
  footnote?: string;
}

export interface LegacyDialogueChoice {
  text: string;
  next: string;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  initial: string;
  lines: string[];
  choices?: LegacyDialogueChoice[];
  next?: string;
  flag?: string;
}

export interface HintSet {
  tier1: string;
  tier2: string;
  tier3: string;
}

export interface ContentBundle {
  case: CaseMeta;
  suspects: Suspect[];
  rooms: Room[];
  clues: Clue[];
  gates: Gate[];
  timeline: TimelineEntry[];
  prologue: ProloguePage[];
  /** Legacy flat briefing nodes (build one). */
  dialogue: DialogueNode[];
  /** Conversation graphs keyed by id (v2 dialogue system). */
  graphs: Record<string, import('../dialogue/types').DialogueGraph>;
  /** Locale table for "@key" text indirection (global + case-merged). */
  locale: Record<string, string>;
  chains: Chain[];
}

/* ------------------------------------------------------------------ */
/* World content (the precinct that hosts every case)                  */
/* ------------------------------------------------------------------ */

/** A station staff member talkable through a dialogue graph. */
export interface WorldPerson {
  name: string;
  shortName: string;
  initial: string;
  tint: string;
  portrait?: string;
}

export type StationHotspotKind = 'door' | 'files' | 'dialogue' | 'flavor' | 'locked';

export interface StationHotspot {
  id: string;
  /** World-space rect on the 1920x1080 scene art. */
  spot: Rect;
  label: string;
  kind: StationHotspotKind;
  /** door: which station level to enter. */
  to?: 'exterior' | 'interior';
  /** dialogue: graph id in world.graphs. */
  dialogue?: string;
  /** flavor/locked: toast line. */
  line?: string;
}

export interface StationSceneData {
  art: string;
  title: string;
  ambientCaption: string;
  hotspots: StationHotspot[];
}

export interface DetectiveLore {
  name: string;
  rank: string;
  badge: string;
  desk: number;
  station: string;
  tagline: string;
  backstory: string[];
}

export interface WorldContent {
  detective: DetectiveLore;
  intro: { when: 'first-station-entry'; lines: string[] };
  exterior: StationSceneData;
  interior: StationSceneData;
  people: Record<string, WorldPerson>;
  /** Station staff conversation graphs (same shape as case graphs). */
  graphs: Record<string, import('../dialogue/types').DialogueGraph>;
}

/** One folder on the desk. `id` maps to /content/cases/<id>/ for its bundle. */
export interface CaseFileMeta {
  id: string;
  code: string;
  title: string;
  subtitle: string;
  status: 'available' | 'sealed' | 'cold' | 'soon';
  slot: number;
  accent: string;
  difficulty: string;
  location: string;
  victim: string;
  pitch: string;
  memo: string[];
  firstCase?: boolean;
  rankRequired?: string;
}

/* ------------------------------------------------------------------ */
/* Persistent state (the M in MVVM for progression)                    */
/* ------------------------------------------------------------------ */

export interface Settings {
  textSize: 0 | 1 | 2;
  highlights: boolean;
  accent: 'rust' | 'cobalt' | 'forest';
  subtitles: boolean;
}

/** Per-case progression -- everything below lives inside one case. */
export interface CaseProgress {
  openedAt: number;
  solved: boolean;
  phase: 'prologue' | 'hub' | 'room';
  roomId: string | null;
  prologuePage: number;
  prologueDone: boolean;
  flags: Record<string, boolean>;
  /** Numeric dialogue variables ("trust:peggy" etc.). */
  vars: Record<string, number>;
  clues: Record<string, { at: number }>;
  gates: Record<string, boolean>;
  hintsUsed: Record<string, number>;
}

export function freshCaseProgress(): CaseProgress {
  return {
    openedAt: Date.now(),
    solved: false,
    phase: 'prologue',
    roomId: null,
    prologuePage: 0,
    prologueDone: false,
    flags: {},
    vars: {},
    clues: {},
    gates: {},
    hintsUsed: {},
  };
}

export interface GameState {
  v: 3;
  /** 'station' = precinct world (case selection); the rest live inside a case. */
  phase: 'station' | 'prologue' | 'hub' | 'room';
  /** Which precinct view is showing while phase === 'station'. */
  stationLevel: 'exterior' | 'interior';
  /** Precinct intro card has been shown (once, ever). */
  introSeen: boolean;
  /** The folder being worked, or null when no case is taken yet. */
  activeCaseId: string | null;
  /** Live mirror of cases[activeCaseId].roomId for routing (persisted in cp too). */
  roomId: string | null;
  /** Everything case-specific, keyed by case id -- this is what makes the world expandable. */
  cases: Record<string, CaseProgress>;
  /** World-scope progression: precinct NPC memory (talked:* etc.), case-independent. */
  station: { flags: Record<string, boolean>; vars: Record<string, number> };
  settings: Settings;
  updatedAt: number;
}

export function freshState(): GameState {
  return {
    v: 3,
    phase: 'station',
    stationLevel: 'exterior',
    introSeen: false,
    activeCaseId: null,
    roomId: null,
    cases: {},
    station: { flags: {}, vars: {} },
    settings: { textSize: 1, highlights: true, accent: 'rust', subtitles: true },
    updatedAt: 0,
  };
}

/** The flat v1/v2 save shape (one case, all progress at the top level). */
interface LegacyState {
  v?: number;
  phase?: string;
  roomId?: string | null;
  prologuePage?: number;
  prologueDone?: boolean;
  flags?: Record<string, boolean>;
  vars?: Record<string, number>;
  clues?: Record<string, { at: number }>;
  gates?: Record<string, boolean>;
  hintsUsed?: Record<string, number>;
  settings?: Partial<Settings>;
  station?: { flags?: Record<string, boolean>; vars?: Record<string, number> };
  cases?: Record<string, CaseProgress>;
  activeCaseId?: string | null;
  stationLevel?: 'exterior' | 'interior';
  introSeen?: boolean;
}

/**
 * Bring an older persisted state up to the current shape.
 * v1/v2 stored one case's progress flat -- wrap it into cases['vesper']
 * (the only case that existed) so old saves keep working in the precinct.
 */
export function migrateState(loaded: Partial<GameState> | null | undefined): GameState {
  const old = (loaded ?? {}) as LegacyState;
  const state: GameState = { ...freshState(), ...(old as Partial<GameState>) } as GameState;
  state.settings = { ...freshState().settings, ...(old.settings ?? {}) };

  const version = old.v ?? 1;
  if (version < 3) {
    // Flat v1/v2 shape: clues/flags/vars/gates lived at the top level.
    const legacy: CaseProgress = {
      ...freshCaseProgress(),
      phase: (old.phase === 'station' ? 'prologue' : (old.phase as CaseProgress['phase'])) ?? 'prologue',
      roomId: old.roomId ?? null,
      prologuePage: old.prologuePage ?? 0,
      prologueDone: old.prologueDone ?? false,
      flags: { ...(old.flags ?? {}) },
      vars: { ...(old.vars ?? {}) },
      clues: { ...(old.clues ?? {}) },
      gates: { ...(old.gates ?? {}) },
      hintsUsed: { ...(old.hintsUsed ?? {}) },
    };
    const hadProgress =
      Object.keys(legacy.clues).length > 0 ||
      Object.keys(legacy.flags).length > 0 ||
      Object.keys(legacy.gates).length > 0 ||
      legacy.prologueDone;
    state.cases = { vesper: legacy };
    state.activeCaseId = 'vesper';
    state.phase = legacy.phase;
    state.roomId = legacy.roomId;
    // Untouched old saves restart from the station; mid-case ones resume.
    if (!hadProgress) {
      state.phase = 'station';
      state.stationLevel = 'exterior';
      state.introSeen = false;
    }
  }

  state.stationLevel = state.stationLevel === 'interior' ? 'interior' : 'exterior';
  state.cases = state.cases ?? {};
  state.station = { flags: { ...(old.station?.flags ?? {}) }, vars: { ...(old.station?.vars ?? {}) } };
  if (state.activeCaseId && !state.cases[state.activeCaseId]) {
    state.cases[state.activeCaseId] = freshCaseProgress();
  }
  if (state.activeCaseId) state.roomId = state.cases[state.activeCaseId].roomId ?? null;
  state.v = 3;
  return state;
}
