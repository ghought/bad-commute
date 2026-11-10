import { describe, expect, it } from 'vitest';
import { LEVELS } from '../src/levels';
import { dress } from '../src/levels/dressing';
import type { PrefabData } from '../src/levels/schema';
import type { Npc, Prop, Spring } from '../src/mechanisms/toys';
import { evaluateImpact } from '../src/sim/damage';
import type { SimEvent } from '../src/sim/events';
import type { Simulation } from '../src/sim/Simulation';
import { GO, IDLE, bike, flat, makeSim, run, until } from './helpers';

/** Steps until done, collecting every event on the way. */
function watch(s: Simulation, done: () => boolean, cmd = GO, max = 1500) {
  const seen: SimEvent[] = [];
  let n = 0;
  while (!done() && n < max) {
    s.step(cmd);
    seen.push(...s.events);
    s.events.length = 0;
    n++;
  }
  return seen;
}
const over = (s: Simulation) => s.status === 'crashed' || s.status === 'finished';
const has = (events: SimEvent[], t: SimEvent['t']) => events.some((e) => e.t === t);

describe('leaving the bike', () => {
  it('knocks a rider off before it kills them', () => {
    expect(evaluateImpact('torso', 5)).toBe('bruise');
    expect(evaluateImpact('torso', 7)).toBe('knock');
    expect(evaluateImpact('torso', 10)).toBe('lethal');
    expect(evaluateImpact('head', 6)).toBe('knock');
    expect(evaluateImpact('head', 8)).toBe('lethal');
  });

  it('fires the ejector seat once per press and leaves the rider alive', () => {
    const s = makeSim(flat());
    run(s, 90);
    const events = watch(s, () => s.riderState() !== 'riding', { ...GO, eject: 1 }, 5);
    expect(s.riderState()).toBe('loose');
    expect(events.filter((e) => e.t === 'eject')).toHaveLength(1);
    expect(s.status).toBe('playing');
    expect(bike(s).riderPose().vy).toBeGreaterThan(4);
    // Holding the button does nothing more.
    expect(has(watch(s, () => false, { ...GO, eject: 1 }, 30), 'eject')).toBe(false);
  });

  it('does not start the clock or fire from the eject button alone', () => {
    const s = makeSim(flat());
    run(s, 30, { ...IDLE, eject: 1 });
    expect(s.status).toBe('ready');
    expect(s.riderState()).toBe('riding');
  });

  it('counts a loose rider crossing the line as arriving on foot', () => {
    const s = makeSim(flat({ finish: { x: 22, y: -5, h: 40 } }));
    until(s, () => s.telemetry().x > 14);
    s.step({ ...GO, eject: 1 });
    until(s, () => over(s));
    expect(s.status).toBe('finished');
    expect(s.arrival).toBe('loose');
  });

  it('lets a loose rider heave themselves along the ground', () => {
    const s = makeSim(flat());
    run(s, 5);
    s.step({ ...IDLE, eject: 1 });
    run(s, 240, IDLE);
    const x0 = bike(s).riderPose().x;
    const events = watch(s, () => false, GO, 360);
    expect(has(events, 'flop')).toBe(true);
    expect(bike(s).riderPose().x).toBeGreaterThan(x0 + 3);
    expect(s.riderState()).toBe('loose');
  });

  it('keeps the attempt open after death, then closes it when the body stops', () => {
    const s = makeSim(flat({ prefabs: [{ type: 'cutter', id: 'saw', x: 26, y: 2.0, r: 0.5 }] }));
    const events = watch(s, () => s.riderState() === 'dead');
    expect(has(events, 'death')).toBe(true);
    expect(s.status).toBe('playing');
    const after = watch(s, () => s.status === 'crashed', GO, 600);
    expect(s.status).toBe('crashed');
    expect(has(after, 'over')).toBe(true);
  });

  it('ends the attempt when a living rider off the bike stops trying', () => {
    const s = makeSim(flat());
    run(s, 5);
    s.step({ ...IDLE, eject: 1 });
    const events = watch(s, () => s.status === 'crashed', IDLE, 900);
    expect(s.status).toBe('crashed');
    expect(s.riderState()).toBe('loose');
    expect(s.deathCause).toBeNull();
    expect(has(events, 'over')).toBe(true);
  });

  it('reports how much of the rider is left', () => {
    const s = makeSim(flat());
    const v = bike(s);
    expect(v.integrity()).toBe(1);
    v.sever('armLowerN');
    expect(v.integrity()).toBeCloseTo(0.95);
    v.decapitate();
    expect(v.integrity()).toBeCloseTo(0.75);
  });
});

describe('loose objects', () => {
  const boxes: PrefabData[] = [0, 1, 2].map((i) => ({ type: 'prop', id: `b${i}`, kind: 'box', x: 30 + i * 0.75, y: 0 }));

  it('bursts cardboard at speed and removes the bodies', () => {
    const s = makeSim(flat({ prefabs: boxes }));
    const before = s.bodyCount();
    const events = watch(s, () => s.telemetry().x > 45);
    expect(events.filter((e) => e.t === 'prop' && e.what === 'burst').length).toBeGreaterThan(0);
    expect(s.bodyCount()).toBeLessThan(before);
    expect(s.riderState()).toBe('riding');
  });

  it('does not leave a wheel thinking it is on the ground after a prop is destroyed', () => {
    const s = makeSim(flat({ prefabs: [...boxes, { type: 'spring', id: 'pad', x: 50, y: 0, w: 2.6, power: 9 }] }));
    let airborne = 9;
    watch(s, () => {
      const t = s.telemetry();
      if (t.y > 2) airborne = Math.min(airborne, t.grounded);
      return t.x > 70;
    });
    expect(airborne).toBe(0);
  });

  it('retires a knocked prop so it cannot jam the road', () => {
    const s = makeSim(flat({ prefabs: [{ type: 'prop', id: 'drum', kind: 'barrel', x: 30, y: 0 }] }));
    const drum = s.mechanism<Prop>('drum')!;
    until(s, () => s.telemetry().x > 30);
    expect(drum.spent).toBe(false);
    run(s, 120);
    expect(drum.spent).toBe(true);
    expect(s.riderState()).toBe('riding');
  });

  it('plays out the same way every time', () => {
    const play = () => {
      const s = makeSim(flat({ finish: { x: 90, y: -5, h: 40 }, prefabs: [...boxes, { type: 'npc', id: 'n', x: 40, y: 0 }, { type: 'prop', id: 'c', kind: 'cart', x: 50, y: 0 }] }));
      until(s, () => over(s));
      return [s.status, s.time, s.telemetry().x];
    };
    expect(play()).toEqual(play());
  });
});

describe('explosives', () => {
  it('kills a rider who rides over a mine, and takes limbs with it', () => {
    const s = makeSim(flat({ prefabs: [{ type: 'mine', id: 'm', x: 30, y: 0 }] }));
    const events = watch(s, () => s.riderState() === 'dead');
    expect(has(events, 'explosion')).toBe(true);
    expect(s.deathCause).toBe('blast');
    expect(bike(s).detached.size).toBeGreaterThan(0);
  });

  it('sets off its neighbours a moment later', () => {
    const s = makeSim(flat({ prefabs: [{ type: 'mine', id: 'a', x: 30, y: 0 }, { type: 'prop', id: 'b', kind: 'tnt', x: 32.5, y: 0 }, { type: 'mine', id: 'c', x: 35, y: 0 }] }));
    const events = watch(s, () => over(s), GO, 900);
    expect(events.filter((e) => e.t === 'explosion')).toHaveLength(3);
  });

  it('leaves a rider outside the blast alone', () => {
    const s = makeSim(flat({ prefabs: [{ type: 'mine', id: 'a', x: 30, y: 0 }, { type: 'prop', id: 'p', kind: 'ball', x: 29.4, y: 0.4 }] }));
    // The ball rolls onto the mine by itself while the bike waits well back.
    const events = watch(s, () => false, { throttle: 0, brake: 1, lean: 0 }, 240);
    if (has(events, 'explosion')) expect(s.riderState()).toBe('riding');
  });
});

describe('springs, fans, wrecking balls and spikes', () => {
  it('throws the bike off a punch pad and lets it land', () => {
    const s = makeSim(flat({ finish: { x: 90, y: -5, h: 40 }, prefabs: [{ type: 'spring', id: 'pad', x: 30, y: 0, w: 2.6, power: 8 }] }));
    let top = 0;
    const events = watch(s, () => {
      top = Math.max(top, s.telemetry().y);
      return s.telemetry().x > 45;
    });
    expect(has(events, 'boing')).toBe(true);
    expect(top).toBeGreaterThan(1.8);
    expect(s.mechanism<Spring>('pad')!.since).toBeLessThan(5);
  });

  it('lifts the bike in a fan draught', () => {
    const still = makeSim(flat());
    const blown = makeSim(flat({ prefabs: [{ type: 'fan', id: 'f', x: 30, y: 0, w: 16, h: 8, accel: 30 }] }));
    let a = 0;
    let b = 0;
    watch(still, () => ((a = Math.max(a, still.telemetry().y)), still.telemetry().x > 40));
    watch(blown, () => ((b = Math.max(b, blown.telemetry().y)), blown.telemetry().x > 40));
    expect(b).toBeGreaterThan(a + 1);
  });

  it('swings a wrecking ball on schedule, the same every restart', () => {
    const at = () => {
      const s = makeSim(flat({ prefabs: [{ type: 'wrecker', id: 'w', x: 60, y: 6.4, rod: 5.2, r: 0.95, amplitude: 1.3, period: 5.2 }] }));
      run(s, 100);
      return s.mechanism('w')!.bodies[0].getPosition().x;
    };
    expect(at()).toBeCloseTo(at(), 9);
    expect(Math.abs(at() - 60)).toBeGreaterThan(0.5);
  });

  it('kills on spikes and holds the body there', () => {
    const s = makeSim(flat({ prefabs: [{ type: 'spikes', id: 'sp', x: 30, y: 0, w: 4 }] }));
    const events = watch(s, () => over(s), GO, 900);
    expect(s.deathCause).toBe('spikes');
    expect(has(events, 'impale')).toBe(true);
    expect(s.status).toBe('crashed');
    expect(bike(s).riderPose().x).toBeLessThan(40);
  });
});

describe('bystanders', () => {
  it('stand until the bike arrives, then get out of the way for good', () => {
    const s = makeSim(flat({ finish: { x: 90, y: -5, h: 40 }, prefabs: [{ type: 'npc', id: 'n', x: 30, y: 0 }] }));
    const n = s.mechanism<Npc>('n')!;
    run(s, 60);
    expect(n.parts.get('head')!.getPosition().y).toBeGreaterThan(1.4);
    expect(n.disturbed).toBe(false);
    const events = watch(s, () => over(s));
    expect(events.some((e) => e.t === 'npc' && e.what === 'hit')).toBe(true);
    expect(s.status).toBe('finished');
    expect(s.arrival).toBe('riding');
  });
});

describe('dressing', () => {
  it('is deterministic and never touches Overtime', () => {
    const raw = LEVELS.find((l) => l.levelId === 'rc-02')!;
    const bare = { ...raw, prefabs: raw.prefabs.filter((p) => !p.id.startsWith('$')) };
    expect(dress(bare)).toEqual(dress(bare));
    const ot = LEVELS.find((l) => l.levelId === 'ot-21')!;
    expect(dress(ot)).toBe(ot);
  });

  it('puts someone past the finish line on the first course', () => {
    const first = LEVELS[0];
    expect(first.prefabs.some((p) => p.type === 'npc' && p.x > first.finish.x)).toBe(true);
    expect(first.prefabs.some((p) => p.type === 'prop' && p.kind === 'tnt' && p.x > first.finish.x)).toBe(true);
  });
});
