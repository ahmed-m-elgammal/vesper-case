/**
 * Content schema types -- these mirror the JSON Schema files in
 * /public/content/schemas/. All case content is data-driven: the engine
 * reads these shapes, never hard-codes case facts.
 */

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

export interface Room {
  id: string;
  title: string;
  act: number;
  width: number;
  height: number;
  layers: RoomLayer[];
  doors: Door[];
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

export interface DialogueChoice {
  text: string;
  next: string;
}

export interface DialogueNode {
  id: string;
  speaker: string;
  initial: string;
  lines: string[];
  choices?: DialogueChoice[];
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
  dialogue: DialogueNode[];
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
  v: 1;
  phase: 'prologue' | 'hub' | 'room';
  roomId: string | null;
  prologuePage: number;
  prologueDone: boolean;
  flags: Record<string, boolean>;
  clues: Record<string, { at: number }>;
  gates: Record<string, boolean>;
  hintsUsed: Record<string, number>;
  settings: Settings;
  updatedAt: number;
}

export function freshState(): GameState {
  return {
    v: 1,
    phase: 'prologue',
    roomId: null,
    prologuePage: 0,
    prologueDone: false,
    flags: {},
    clues: {},
    gates: {},
    hintsUsed: {},
    settings: { textSize: 1, highlights: true, accent: 'rust', subtitles: true },
    updatedAt: 0,
  };
}
