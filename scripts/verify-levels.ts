// Replays every solved route through the real simulation, and checks the things
// the campaign has to guarantee. `npm run verify`. Fails loudly.
import { readFileSync } from 'node:fs';
import { LEVELS, validateCampaign } from '../src/levels';
import type { LevelData } from '../src/levels/schema';
import { runRoute, type RouteStep } from '../src/sim/autopilot';
import { Simulation } from '../src/sim/Simulation';
import { createVehicle } from '../src/vehicles';

const solved = JSON.parse(readFileSync(new URL('./routes/solved.json', import.meta.url), 'utf8')) as Record<
  string,
  { main: RouteStep[]; tag: RouteStep[]; checkpoint?: RouteStep[] }
>;

let failures = 0;
const fail = (message: string) => {
  failures++;
  console.log(`  FAIL ${message}`);
};

const errors = validateCampaign();
for (const e of errors) fail(e);

if (LEVELS.length !== 24) fail(`expected 24 levels, found ${LEVELS.length}`);
const changing = LEVELS.filter((l) => l.routeChanging).length;
if (changing < 12) fail(`only ${changing} levels are route-changing, need 12`);

const play = (level: LevelData, steps: RouteStep[], fromCheckpoint = false) =>
  runRoute(new Simulation(level, createVehicle('motorbike'), { fromCheckpoint }), { steps }, 120);

const rows: string[] = [];
for (const level of LEVELS) {
  const routes = solved[level.levelId];
  if (!routes) {
    fail(`${level.levelId}: no solved routes`);
    continue;
  }
  const main = play(level, routes.main);
  const again = play(level, routes.main);
  const tag = play(level, routes.tag);
  const arrived = (r: typeof main) => r.status === 'finished' && (level.onFoot ? r.arrival !== 'dead' : r.arrival === 'riding');
  if (!arrived(main)) fail(`${level.levelId}: main route did not finish (${main.status} ${main.cause ?? ''} at x=${main.maxX.toFixed(1)})`);
  if (!arrived(tag) || !tag.tag) fail(`${level.levelId}: tag route failed (${tag.status} ${tag.cause ?? ''}, tag ${tag.tag})`);
  if (Math.abs(main.time - again.time) > 1 / 60) fail(`${level.levelId}: replay differs (${main.time} vs ${again.time})`);

  let cp = '';
  if (level.checkpoint) {
    const r = routes.checkpoint ? play(level, routes.checkpoint, true) : null;
    if (!r || !arrived(r)) fail(`${level.levelId}: checkpoint route failed`);
    cp = r ? `${r.time.toFixed(1)}s` : 'none';
  }
  const medal = level.medals;
  const best = Math.min(main.time, tag.time);
  if (best > medal.bronze) fail(`${level.levelId}: bot's best (${best.toFixed(1)}) misses bronze (${medal.bronze})`);
  rows.push(
    `${level.levelId}  ${level.title.padEnd(20)} main ${main.time.toFixed(1).padStart(5)}s  tag ${tag.time.toFixed(1).padStart(5)}s  ${cp ? `cp ${cp.padStart(6)}  ` : '             '}medals ${medal.gold}/${medal.silver}/${medal.bronze}`,
  );
}

console.log(rows.join('\n'));
console.log(`\n${LEVELS.length} levels, ${changing} route-changing.`);
if (failures) {
  console.log(`${failures} failure(s).`);
  process.exit(1);
}
console.log('All routes verified.');
