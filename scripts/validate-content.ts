/**
 * Content validation harness -- runs the engine's own runtime validators
 * against the on-disk JSON, without a browser.
 *
 *   npx tsx scripts/validate-content.ts
 */

import { readFileSync, existsSync } from 'node:fs';
import { validateBundle, validateWorld, validateCaseRegistry } from '../src/game/data/validate';

function loadJson(path: string): Record<string, unknown> {
  return JSON.parse(readFileSync(path, 'utf8')) as Record<string, unknown>;
}

const vesperDir = 'public/content/cases/vesper';
const files = ['case', 'suspects', 'rooms', 'clues', 'gates', 'timeline', 'prologue', 'dialogue', 'chains'] as const;

const raw: Record<string, unknown> = {};
for (const f of files) {
  raw[f] = loadJson(`${vesperDir}/${f}.json`);
}

// Accept both bare arrays and { key: [...] } wrapper shapes (as the engine does).
const ARRAY_KEYS = ['suspects', 'rooms', 'clues', 'gates', 'timeline', 'prologue', 'dialogue', 'chains'] as const;
for (const key of ARRAY_KEYS) {
  const v = raw[key];
  if (v && !Array.isArray(v) && Array.isArray((v as Record<string, unknown>)[key])) {
    raw[key] = (v as Record<string, unknown>)[key];
  }
}

// dialogue.json may be v2 shape { nodes, graphs }
const d = raw.dialogue as Record<string, unknown>;
if (d && !Array.isArray(d)) {
  raw.dialogue = Array.isArray(d.nodes) ? d.nodes : [];
  raw.graphs = d.graphs ?? {};
}

// endCards (optional file, bare map or wrapper)
let endCards: Record<string, unknown> = {};
const ecPath = `${vesperDir}/endCards.json`;
if (existsSync(ecPath)) {
  const ec = loadJson(ecPath) as Record<string, unknown>;
  endCards = ((ec.endCards && typeof ec.endCards === 'object' ? ec.endCards : ec) ?? {}) as Record<string, unknown>;
}
raw.endCards = endCards;

// locale: global table (+ optional per-case override)
const locale = loadJson('public/content/locales/en.json') as Record<string, string>;
raw.locale = locale;

const problems = validateBundle(raw);
if (problems.length > 0) {
  console.error('BUNDLE ERRORS:');
  for (const p of problems) console.error(' - ' + p);
  process.exitCode = 1;
} else {
  console.log(`bundle OK: ${(raw.clues as unknown[]).length} clues, ${(raw.gates as unknown[]).length} gates, ${(raw.rooms as unknown[]).length} rooms, graphs=${Object.keys(raw.graphs ?? {}).length}, endCards=${Object.keys(endCards).length}`);
}

// world + registry too (they validate graphs against the global locale)
const worldRaw = { ...loadJson('public/content/world.json'), locale };
const worldProblems = [...validateWorld(worldRaw), ...validateCaseRegistry(loadJson('public/content/cases.json'))];
if (worldProblems.length > 0) {
  console.error('WORLD ERRORS:');
  for (const p of worldProblems) console.error(' - ' + p);
  process.exitCode = 1;
} else {
  console.log('world OK');
}

if (process.exitCode !== 1) console.log('ALL CONTENT VALID');
