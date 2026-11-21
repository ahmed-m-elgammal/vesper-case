import { readFileSync } from 'fs';
import { validateWorld, validateCaseRegistry } from '/home/z/my-project/src/game/data/validate';

const world = JSON.parse(readFileSync('/home/z/my-project/public/content/world.json', 'utf8'));
const registry = JSON.parse(readFileSync('/home/z/my-project/public/content/cases.json', 'utf8'));
const locale = JSON.parse(readFileSync('/home/z/my-project/public/content/locales/en.json', 'utf8'));

const problems = [
  ...validateWorld({ ...world, locale }),
  ...validateCaseRegistry(registry),
];

// career + rankRequired cross-checks
if (world.career) {
  const titles = world.career.ranks.map((r: { title: string }) => r.title);
  for (const c of registry.cases) {
    if (c.rankRequired && !titles.includes(c.rankRequired)) problems.push(`cases: rankRequired "${c.rankRequired}" not a career rank`);
  }
}

// world people -> portrait files exist
import { existsSync } from 'fs';
for (const [pid, p] of Object.entries(world.people) as [string, { portrait?: string }][]) {
  if (p.portrait && !existsSync('public' + p.portrait)) problems.push(`people.${pid}: portrait missing ${p.portrait}`);
}
for (const scene of ['exterior', 'interior', 'upper'] as const) {
  const art = (world as Record<string, { art?: string }>)[scene]?.art;
  if (art && !existsSync('public' + art)) problems.push(`${scene}: art missing ${art}`);
}

if (problems.length) {
  console.log('PROBLEMS:\n- ' + problems.join('\n- '));
  process.exit(1);
}
console.log('World + registry content OK. Ranks:', world.career.ranks.map((r: { title: string; after: number }) => `${r.title}@${r.after}`).join(', '));
console.log('People:', Object.keys(world.people).join(', '));
console.log('Graphs:', Object.keys(world.graphs).join(', '));
