// Finds a working route for every level and tag, starting from the hand templates.
// Usage: npm run solve            all levels, keeping routes that still pass
//        npm run solve -- rc-03   one level
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { LEVELS, validateCampaign } from '../src/levels';
import type { LevelData } from '../src/levels/schema';
import { mulberry } from '../src/core/math';
import { runRoute, type RouteResult, type RouteStep } from '../src/sim/autopilot';
import { Simulation } from '../src/sim/Simulation';
import { createVehicle } from '../src/vehicles';
import { TEMPLATES } from './routes/templates';

const OUT = new URL('./routes/solved.json', import.meta.url);
const TRIES = Number(process.env.TRIES ?? 500);
type Solved = Record<string, { main: RouteStep[]; tag: RouteStep[]; checkpoint?: RouteStep[] }>;

function attempt(level: LevelData, steps: RouteStep[], fromCheckpoint: boolean): RouteResult {
  return runRoute(new Simulation(level, createVehicle('motorbike'), { fromCheckpoint }), { steps }, 120);
}

const passes = (r: RouteResult, wantTag: boolean, level: LevelData) =>
  r.status === 'finished' && (level.onFoot ? r.arrival !== 'dead' : r.arrival === 'riding') && (!wantTag || r.tag);

function perturb(steps: RouteStep[], rand: () => number, scale: number): RouteStep[] {
  return steps.map((s) => {
    const q: RouteStep = { ...s };
    if (rand() < 0.65) q.v = Math.max(1.5, Math.min(22, s.v * (1 + (rand() - 0.5) * scale)));
    if (rand() < 0.3) q.air = (s.air ?? 0) + (rand() - 0.5) * 0.5 * scale;
    if (rand() < 0.3 && !s.hold) q.x = s.x + (rand() - 0.5) * 3 * scale;
    return q;
  });
}

function solve(level: LevelData, template: RouteStep[], wantTag: boolean, fromCheckpoint: boolean, known?: RouteStep[]) {
  for (const candidate of [known, template]) {
    if (!candidate) continue;
    const r = attempt(level, candidate, fromCheckpoint);
    if (passes(r, wantTag, level)) return { steps: candidate, result: r, tries: 1 };
  }
  const rand = mulberry(level.order * 991 + (wantTag ? 7 : 3));
  let best = template;
  const fitness = (r: RouteResult) =>
    (r.status === 'finished' ? 2000 - r.time : r.maxX) + (wantTag ? (r.tag ? 3000 : 400 - r.tagDistance * 100) : 0);
  let bestFit = fitness(attempt(level, template, fromCheckpoint));
  for (let i = 1; i <= TRIES; i++) {
    const scale = 0.25 + (i % 5) * 0.2;
    const trial = perturb(rand() < 0.25 ? template : best, rand, scale);
    const r = attempt(level, trial, fromCheckpoint);
    if (passes(r, wantTag, level)) return { steps: trial, result: r, tries: i + 1 };
    const f = fitness(r);
    if (f > bestFit) {
      bestFit = f;
      best = trial;
    }
  }
  const r = attempt(level, best, fromCheckpoint);
  console.log(`  best ${wantTag ? 'tag' : 'main'} try on ${level.levelId}: ${r.status} ${r.cause ?? ''} maxX ${r.maxX.toFixed(1)} tag dist ${r.tagDistance.toFixed(2)} at (${r.tagNear[0].toFixed(1)}, ${r.tagNear[1].toFixed(1)}) ${JSON.stringify(best.map((q) => +q.v.toFixed(1)))}`);
  return null;
}

const errors = validateCampaign();
if (errors.length) {
  console.error(errors.join('\n'));
  process.exit(1);
}

const only = process.argv.slice(2);
const solved: Solved = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf8')) : {};
let failed = 0;

for (const level of LEVELS) {
  if (only.length && !only.includes(level.levelId)) continue;
  const t = TEMPLATES[level.levelId];
  if (!t) {
    console.log(`${level.levelId}: no template`);
    failed++;
    continue;
  }
  const prior = solved[level.levelId] as Solved[string] | undefined;
  const main = solve(level, t.main, false, false, prior?.main);
  const tag = solve(level, t.tag, true, false, prior?.tag);
  const cp = t.checkpoint ? solve(level, t.checkpoint, false, true, prior?.checkpoint) : null;
  const say = (name: string, s: ReturnType<typeof solve>) =>
    `${name}: ${s ? `ok ${s.result.time.toFixed(1)}s (${s.tries} tries)` : 'FAILED'}`;
  console.log(`${level.levelId} ${say('main', main)} | ${say('tag', tag)}${t.checkpoint ? ` | ${say('cp', cp)}` : ''}`);
  if (!main || !tag || (t.checkpoint && !cp)) failed++;
  solved[level.levelId] = {
    main: main?.steps ?? prior?.main ?? t.main,
    tag: tag?.steps ?? prior?.tag ?? t.tag,
    ...(t.checkpoint ? { checkpoint: cp?.steps ?? prior?.checkpoint ?? t.checkpoint } : {}),
  };
  writeFileSync(OUT, JSON.stringify(solved, null, 1));
}
console.log(failed ? `${failed} level(s) unsolved` : 'All routes solved');
process.exit(failed ? 1 : 0);
