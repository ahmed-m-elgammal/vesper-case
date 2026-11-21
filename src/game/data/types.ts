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
  /** Locale table (en) for "@key" text indirection. */
  locale: Record<string, string>;
  chains: Chain[];
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

export interface GameState {
  v: 2;
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
  settings: Settings;
  updatedAt: number;
}

export function freshState(): GameState {
  return {
    v: 2,
    phase: 'prologue',
    roomId: null,
    prologuePage: 0,
    prologueDone: false,
    flags: {},
    vars: {},
    clues: {},
    gates: {},
    hintsUsed: {},
    settings: { textSize: 1, highlights: true, accent: 'rust', subtitles: true },
    updatedAt: 0,
  };
}

/** Bring an older persisted state (v1 or partial v2) up to the current shape. */
export function migrateState(loaded: Partial<GameState> | null | undefined): GameState {
  const state = { ...freshState(), ...(loaded ?? {}), settings: { ...freshState().settings, ...(loaded?.settings ?? {}) } };
  state.v = 2;
  state.vars = { ...(loaded?.vars ?? {}) };
  return state;
}
