/**
 * Engine-level tests for the dialogue runner -- runs in Node (no DOM, no
 * Phaser, no browser), proving the conversation runtime is engine-neutral.
 *
 *   npx tsx scripts/test-dialogue-runner.ts
 *
 * Exits non-zero on the first failure; prints PASS lines for each scenario.
 */

import { DialogueRunner, graphFromLegacyNodes } from '../src/game/dialogue/runner';
import { evalCondition } from '../src/game/dialogue/conditions';
import { resolveText, setLocaleTable } from '../src/game/dialogue/loc';
import type { DialogueContext, DialogueEffects, DialogueGraph } from '../src/game/dialogue/types';

/* ---------------------------------------- mock game context */

class MockCtx implements DialogueContext {
  clues = new Set<string>();
  flags = new Set<string>();
  vars = new Map<string, number>();
  log: string[] = [];

  hasClue(id: string): boolean {
    return this.clues.has(id);
  }
  hasFlag(id: string): boolean {
    return this.flags.has(id);
  }
  getVar(id: string): number {
    return this.vars.get(id) ?? 0;
  }
  foundClueIds(): string[] {
    return [...this.clues];
  }
  applyEffects(e: DialogueEffects): void {
    for (const f of e.setFlags ?? []) {
      this.flags.add(f);
      this.log.push(`flag:${f}`);
    }
    for (const [id, delta] of Object.entries(e.setVars ?? {})) {
      this.vars.set(id, this.getVar(id) + delta);
      this.log.push(`var:${id}:${delta}`);
    }
    for (const c of e.addClues ?? []) {
      this.clues.add(c);
      this.log.push(`clue:${c}`);
    }
  }
}

function fail(msg: string): never {
  console.error(`FAIL -- ${msg}`);
  process.exit(1);
}

function ok(msg: string): void {
  console.log(`PASS -- ${msg}`);
}

function makeGraph(): DialogueGraph {
  return {
    id: 'test',
    suspect: 'peggy',
    speaker: 'Test Person',
    start: 'root',
    presents: { miss: 'miss', again: 'again' },
    reactions: {
      clue_a: { next: 'hit_a', once: 'asked:test:pr-a' },
    },
    nodes: {
      root: {
        beats: [{ t: 'hello' }, { sp: 'you', t: 'my question' }],
        choices: [
          { text: 'ask about clock', next: 'clock', cond: { clue: 'clue_a' } },
          { text: 'ask about weather', next: 'weather' },
          { text: 'show evidence', present: { miss: 'miss' } },
          { text: 'goodbye', next: 'bye' },
        ],
      },
      clock: {
        beats: [{ t: 'the clock stopped' }],
        effects: { setFlags: ['talked:test:clock'], setVars: { 'trust:peggy': 1 }, addClues: ['clue_new'] },
        next: 'root',
      },
      weather: { beats: [{ t: 'raining' }], next: 'root' },
      miss: { beats: [{ t: 'nothing to say' }], next: 'root' },
      again: { beats: [{ t: 'shown already' }], next: 'root' },
      hit_a: { beats: [{ t: 'caught me' }], end: true },
      bye: { beats: [{ t: 'farewell' }], end: true },
    },
  };
}

/* ---------------------------------------- scenarios */

// 1. Walk: beats -> choice -> node -> back to root -> bye -> closed
{
  const ctx = new MockCtx();
  let lastBeat: string | null = null;
  let choicesSeen = 0;
  const runner = new DialogueRunner(makeGraph(), ctx, (snap) => {
    if (snap.beat) lastBeat = snap.beat.t;
    if (!snap.beat && snap.choices.length > 0) choicesSeen = snap.choices.length;
  });
  runner.start();
  runner.advance(); // finish beat 1 -> beat 2
  if (lastBeat !== 'my question') fail(`expected 'my question', got '${lastBeat}'`);
  runner.advance(); // beats done -> choices
  // clue_a not owned: 'ask about clock' filtered out -> 3 choices remain
  if (choicesSeen !== 3) fail(`expected 3 visible choices without clue_a, got ${choicesSeen}`);
  runner.choose(0); // 'ask about weather'
  if (lastBeat !== 'raining') fail(`expected 'raining', got '${lastBeat}'`);
  runner.advance(); // -> root beats again
  runner.advance();
  runner.advance(); // -> choices
  runner.choose(2); // goodbye
  runner.advance(); // bye beat
  runner.advance(); // end -> closed
  if (!runner.isClosed()) fail('runner should be closed after bye/end');
  ok('graph walk: beats, filtered choices, hub loop, terminal close');
}

// 2. Condition gating unlocks when the clue is found
{
  const ctx = new MockCtx();
  let choiceCount = 0;
  const runner = new DialogueRunner(makeGraph(), ctx, (snap) => {
    if (!snap.beat && snap.choices.length > 0) choiceCount = snap.choices.length;
  });
  ctx.clues.add('clue_a');
  runner.start();
  runner.advance();
  runner.advance();
  if (choiceCount !== 4) fail(`expected 4 choices with clue_a, got ${choiceCount}`);
  runner.choose(0); // ask about clock
  runner.advance();
  if (!ctx.hasFlag('talked:test:clock')) fail('clock topic should set talked flag');
  if (ctx.getVar('trust:peggy') !== 1) fail('clock topic should raise trust to 1');
  if (!ctx.hasClue('clue_new')) fail('clock topic should add clue_new');
  ok('conditions + effects: clue gating, setFlags, setVars, addClues');
}

// 3. Evidence presentation: hit (once), repeat -> again, unknown -> miss
{
  const ctx = new MockCtx();
  let lastBeat: string | null = null;
  const runner = new DialogueRunner(makeGraph(), ctx, (snap) => {
    if (snap.beat) lastBeat = snap.beat.t;
  });
  runner.start();
  runner.advance();
  runner.advance(); // waiting on choices
  runner.present('clue_a');
  if (lastBeat !== 'caught me') fail(`present hit expected 'caught me', got '${lastBeat}'`);
  if (!ctx.hasFlag('asked:test:pr-a')) fail('reaction.once flag not set');
  // Graph ended (end:true). Start fresh to test the repeat path.
  const ctx2 = new MockCtx();
  ctx2.flags.add('asked:test:pr-a');
  const runner2 = new DialogueRunner(makeGraph(), ctx2, (snap) => {
    if (snap.beat) lastBeat = snap.beat.t;
  });
  runner2.start();
  runner2.present('clue_a');
  if (lastBeat !== 'shown already') fail(`repeat present expected 'shown already', got '${lastBeat}'`);
  const runner3 = new DialogueRunner(makeGraph(), new MockCtx(), (snap) => {
    if (snap.beat) lastBeat = snap.beat.t;
  });
  runner3.start();
  runner3.present('clue_unknown');
  if (lastBeat !== 'nothing to say') fail(`unknown present expected miss node, got '${lastBeat}'`);
  ok('evidence presentation: hit/once flag, repeat -> again, unknown -> miss');
}

// 4. Condition evaluator unit checks
{
  const ctx = new MockCtx();
  ctx.clues.add('c1');
  ctx.flags.add('f1');
  ctx.vars.set('trust:x', 2);
  const cases: Array<[boolean, Parameters<typeof evalCondition>[0], string]> = [
    [true, { clue: 'c1' }, 'clue pass'],
    [false, { clue: 'nope' }, 'clue fail'],
    [true, { noClue: 'nope' }, 'noClue pass'],
    [false, { noClue: 'c1' }, 'noClue fail'],
    [true, { flag: 'f1' }, 'flag pass'],
    [false, { noFlag: 'f1' }, 'noFlag fail'],
    [true, { asked: 'f1' }, 'asked pass'],
    [false, { not: { flag: 'f1' } }, 'not fail'],
    [true, { not: { flag: 'zz' } }, 'not pass'],
    [true, { all: [{ clue: 'c1' }, { flag: 'f1' }] }, 'all pass'],
    [false, { any: [{ clue: 'zz' }, { flag: 'zz' }] }, 'any fail'],
    [true, { trust: 'trust:x', gte: 2 }, 'trust gte pass'],
    [false, { trust: 'trust:x', gte: 3 }, 'trust gte fail'],
    [true, { trust: 'trust:x', lte: 2 }, 'trust lte pass'],
  ];
  for (const [expected, cond, label] of cases) {
    const got = evalCondition(cond, ctx);
    if (got !== expected) fail(`condition '${label}' expected ${expected} got ${got}`);
  }
  ok('condition evaluator: leaves + combinators');
}

// 5. Locale hooks: @key indirection + interpolation, raw text passthrough
{
  setLocaleTable({ 'dlg.test.greet': 'Hello, {name}.' });
  if (resolveText('@dlg.test.greet', { name: 'Peggy' }) !== 'Hello, Peggy.') fail('locale interpolation broken');
  if (resolveText('raw text') !== 'raw text') fail('raw passthrough broken');
  if (resolveText('@dlg.missing.key') !== 'dlg.missing.key') fail('missing key should render as the bare key');
  ok('locale hooks: @key lookup, {param} interpolation, passthrough');
}

// 6. Legacy flat nodes convert and play (prologue briefing path)
{
  const legacy = [
    {
      id: 'a',
      speaker: 'Sgt',
      initial: 'S',
      lines: ['one', 'two'],
      choices: [{ text: 'go on', next: 'b' }],
    },
    { id: 'b', speaker: 'Sgt', initial: 'S', lines: ['three'], flag: 'met_sgt' },
  ];
  const g = graphFromLegacyNodes(legacy, 'a');
  const ctx = new MockCtx();
  let closed = false;
  let lastBeat: string | null = null;
  const runner = new DialogueRunner(g, ctx, (snap) => {
    closed = snap.closed;
    if (snap.beat) lastBeat = snap.beat.t;
  });
  runner.start();
  runner.advance();
  runner.advance(); // choices
  runner.choose(0); // -> b
  if (lastBeat !== 'three') fail(`legacy expected 'three', got '${lastBeat}'`);
  if (!ctx.hasFlag('met_sgt')) fail('legacy flag not applied on node enter');
  runner.advance(); // end
  if (!closed && !runner.isClosed()) fail('legacy chain should close after terminal node');
  ok('legacy conversion: flat briefing nodes play through the v2 runner');
}

console.log('\nAll dialogue runner tests passed.');
