/**
 * Dialogue content types -- the node/choice graph format the conversation
 * runtime executes. Everything here is plain data: conditions, effects and
 * text are authored in JSON (public/content/dialogue.json + locales), never
 * hard-coded. The runner in runner.ts is engine-neutral: no DOM, no Phaser,
 * no ViewModels -- it only talks to the DialogueContext interface, so it can
 * be unit-tested in Node and reused by any future presentation layer.
 */

/** Who is talking in a beat. 'npc' uses the graph speaker; 'you' is the detective. */
export type DialogueBeatSpeaker = 'you' | 'npc' | 'narrator';

export interface DialogueBeat {
  sp?: DialogueBeatSpeaker;
  /** Raw text, or an "@locale.key" indirection resolved via the locale table. */
  t: string;
}

/**
 * Condition AST. Leaves query game state; combinators nest. All clue ids
 * must exist in clues.json (checked by the boot validator); flag ids are
 * free-form ("talked:colette:evening", "asked:peggy:pr-clock", ...).
 */
export type DialogueCondition =
  | { clue: string }
  | { noClue: string }
  | { flag: string }
  | { noFlag: string }
  | { asked: string }
  | { trust: string; gte?: number; lte?: number }
  | { all: DialogueCondition[] }
  | { any: DialogueCondition[] }
  | { not: DialogueCondition };

/** Effects a node or choice applies when reached. setVars are additive. */
export interface DialogueEffects {
  setFlags?: string[];
  setVars?: Record<string, number>;
  addClues?: string[];
}

/** The runner's only view of the game. Implemented by GameVM in the app. */
export interface DialogueContext {
  hasClue(id: string): boolean;
  hasFlag(id: string): boolean;
  /** Numeric variable lookup -- e.g. "trust:peggy". Missing means 0. */
  getVar(id: string): number;
  /** Clue ids the player holds (for evidence presentation). */
  foundClueIds(): string[];
  /** Apply effects through the real game (flags, variables, clue collection). */
  applyEffects(effects: DialogueEffects): void;
}

export interface DialogueChoice {
  /** Raw text or "@key". */
  text: string;
  /** Node to jump to after the choice. Omit with `close` to end. */
  next?: string;
  /** Only offered when the condition passes (default: always offered). */
  cond?: DialogueCondition;
  /** Opens the evidence picker; picking routes via the graph's reactions. */
  present?: {
    /** Node shown when the presented clue has no authored reaction. */
    miss: string;
  };
  /** Ends the conversation immediately. */
  close?: boolean;
  effects?: DialogueEffects;
}

export interface DialogueNodeV2 {
  beats?: DialogueBeat[];
  choices?: DialogueChoice[];
  /** Unconditional jump after the beats finish. */
  next?: string;
  /** Terminal node: close the conversation after the beats. */
  end?: boolean;
  effects?: DialogueEffects;
}

export interface DialogueReaction {
  /** Node to jump to when this clue is presented. */
  next: string;
  /** Flag set when the reaction fires; a second present of the same clue goes to `presents.again`. */
  once?: string;
}

export interface DialogueGraph {
  id: string;
  /** suspects.json id for portrait/bearing linkage (same as id by convention). */
  suspect?: string;
  /** Display name; raw text or "@key". */
  speaker: string;
  start: string;
  presents?: {
    /** Node for presented evidence with no authored reaction. */
    miss?: string;
    /** Node for evidence already presented once (falls back to miss/close). */
    again?: string;
  };
  reactions?: Record<string, DialogueReaction>;
  nodes: Record<string, DialogueNodeV2>;
}

/** Legacy flat node (the briefing dialogues shipped in build one). */
export interface LegacyDialogueNode {
  id: string;
  speaker: string;
  initial: string;
  lines: string[];
  choices?: Array<{ text: string; next: string }>;
  next?: string;
  flag?: string;
}
