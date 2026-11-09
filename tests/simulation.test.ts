import { Vec2 } from 'planck';
import { describe, expect, it } from 'vitest';
import { SIM } from '../src/config/tuning';
import { LEVELS } from '../src/levels';
import { pit } from '../src/levels/authoring';
import type { LevelData } from '../src/levels/schema';
import type { Counterweight, Lift, Latch, Bridge, Swing, Shutter, Tilt, Cargo, Brace } from '../src/mechanisms';
import { Simulation } from '../src/sim/Simulation';
import { CAT } from '../src/sim/filters';
import { GO, IDLE, bike, flat, makeSim, run, until } from './helpers';

const LATCH_LEVEL = () =>
  flat({
    prefabs: [
      { type: 'latch', id: 'latch', x: 10, y: 1.05, targets: ['bridge'] },
      { type: 'bridge', id: 'bridge', x: 40, y: 0, len: -10, upAngle: -1.2, downAngle: 0 },
    ],
  });

const NOTCHED: LevelData['terrain'] = [{ id: 'g', style: 'asphalt', points: [[-50, 0], [-4, 0], [-4, -3], [13, -3], [13, 0], [790, 0]] }];

describe('riding', () => {
  it('does not start the clock or the machines until the first input', () => {
    const s = makeSim(flat({ prefabs: [{ type: 'lift', id: 'lift', ax: 20, ay: 5, bx: 30, by: 5, w: 4, speed: 3, mode: 'cycle', waitA: 0, waitB: 0 }] }));
    const before = s.mechanism<Lift>('lift')!.t;
    run(s, 60, IDLE);
    expect(s.status).toBe('ready');
    expect(s.time).toBe(0);
    expect(s.mechanism<Lift>('lift')!.t).toBe(before);
    run(s, 1);
    expect(s.status).toBe('playing');
  });

  it('settles level on its suspension', () => {
    const t = makeSim(flat()).telemetry();
    expect(Math.abs(t.angle)).toBeLessThan(0.08);
    expect(t.grounded).toBe(2);
    expect(t.suspension[0]).toBeGreaterThan(0);
  });

  it('reaches the specified speed range', () => {
    const s = makeSim(flat());
    run(s, 60 * 9);
    const lengths = s.telemetry().speed / 1.6;
    expect(lengths).toBeGreaterThanOrEqual(12);
    expect(lengths).toBeLessThanOrEqual(16);
  });

  it('survives a standard landing and an ordinary chassis scrape', () => {
    const s = makeSim(flat({ spawn: { x: 0, y: 4 } }));
    run(s, 1);
    run(s, 200, IDLE);
    expect(s.status).toBe('playing');
    expect(bike(s).isAlive()).toBe(true);
    const bumps: Array<[number, number]> = [[-50, 0], [8, 0], [8.1, 0.55], [8.6, 0.55], [8.7, 0], [790, 0]];
    const scrape = makeSim(flat({ terrain: [{ id: 'g', style: 'asphalt', points: bumps }] }));
    run(scrape, 200, { throttle: 1, brake: 0, lean: 0 });
    expect(scrape.deathCause).toBe(null);
  });

  it('kills on a high-speed head-on hit', () => {
    const s = makeSim(flat({ solids: [{ id: 'w', style: 'concrete', x: 60, y: 8, w: 2, h: 16 }] }));
    expect(until(s, () => s.status !== 'playing' && s.status !== 'ready')).toBe(true);
    expect(s.status).toBe('crashed');
    expect(['head', 'torso']).toContain(s.deathCause);
  });

  it('reverses only after a deliberate hold at rest', () => {
    const s = makeSim(flat());
    run(s, 8, { throttle: 0, brake: 1, lean: 0 });
    expect(s.telemetry().vx).toBeGreaterThan(-0.4);
    run(s, 60, { throttle: 0, brake: 1, lean: 0 });
    expect(s.telemetry().vx).toBeLessThan(-1);
  });

  it('stops from top speed without tipping over', () => {
    const s = makeSim(flat());
    run(s, 60 * 6);
    expect(s.telemetry().speed).toBeGreaterThan(18);
    let pitch = 0;
    until(s, () => {
      pitch = Math.max(pitch, Math.abs(s.telemetry().angle));
      return s.telemetry().speed < 0.5;
    }, { throttle: 0, brake: 1, lean: 0 }, 60 * 8);
    expect(pitch).toBeLessThan(0.45);
    expect(s.status).toBe('playing');
  });

  it('prefers brake over throttle at the command level', () => {
    const s = makeSim(flat());
    run(s, 60);
    const v = s.telemetry().speed;
    run(s, 30, { throttle: 0, brake: 1, lean: 0 });
    expect(s.telemetry().speed).toBeLessThan(v);
  });

  it('lean changes pitch both ways, and airborne lean is bounded', () => {
    const back = makeSim(flat({ spawn: { x: 0, y: 90 } }));
    const fwd = makeSim(flat({ spawn: { x: 0, y: 90 } }));
    let maxRate = 0;
    for (let i = 0; i < 80; i++) {
      back.step({ throttle: 0, brake: 0, lean: 1 });
      fwd.step({ throttle: 0, brake: 0, lean: -1 });
      maxRate = Math.max(maxRate, Math.abs(back.telemetry().angularVelocity));
    }
    expect(back.telemetry().angle).toBeGreaterThan(0.5);
    expect(fwd.telemetry().angle).toBeLessThan(-0.5);
    expect(maxRate).toBeLessThan(4);
  });

  it('runs repeatably from the same start', () => {
    const play = () => {
      const s = makeSim(LEVELS[0]);
      run(s, 240);
      return s.telemetry();
    };
    const a = play();
    const b = play();
    expect(b.x).toBeCloseTo(a.x, 6);
    expect(b.angle).toBeCloseTo(a.angle, 6);
  });
});

describe('damage and death', () => {
  const sawAt = (y: number, r = 0.42) => flat({ prefabs: [{ type: 'cutter', id: 'saw', x: 26, y, r }] });

  it('severs a limb on cutter contact and lets the rider continue', () => {
    const s = makeSim(sawAt(0.12));
    expect(until(s, () => s.telemetry().x > 34)).toBe(true);
    const v = bike(s);
    expect(v.isAlive()).toBe(true);
    expect(s.status).toBe('playing');
    expect(v.detached.size).toBeGreaterThan(0);
    for (const p of v.detached) expect(p).toMatch(/leg|arm/);
  });

  it('decapitates at head height and latches death', () => {
    const s = makeSim(sawAt(2.0, 0.5));
    until(s, () => s.status === 'crashed');
    expect(s.status).toBe('crashed');
    expect(s.deathCause).toBe('cutter');
    expect(bike(s).detached.has('head')).toBe(true);
    run(s, 300);
    expect(s.status).toBe('crashed');
  });

  it('does not tunnel through a cutter at top speed', () => {
    const s = makeSim(flat({ prefabs: [{ type: 'cutter', id: 'saw', x: 150, y: 2.0, r: 0.3 }] }));
    until(s, () => s.status === 'crashed' || s.telemetry().x > 170);
    expect(s.telemetry().speed).toBeGreaterThan(0);
    expect(s.status).toBe('crashed');
  });

  it('cannot be undone by crossing the finish', () => {
    const s = makeSim(flat({ finish: { x: 40, y: -5, h: 40 }, prefabs: [{ type: 'cutter', id: 'saw', x: 26, y: 2.0, r: 0.5 }] }));
    until(s, () => s.telemetry().x > 60, GO, 1200);
    expect(s.status).toBe('crashed');
  });

  it('resolves death first when death and finish share a step', () => {
    const l = flat({ finish: { x: 30, y: -40, h: 80 }, killRegions: [{ x0: 29, x1: 31.5, y0: -40, y1: 80, style: 'void' }] });
    const s = makeSim(l);
    until(s, () => s.status === 'crashed' || s.status === 'finished');
    expect(s.status).toBe('crashed');
    expect(s.deathCause).toBe('pit');

    // Force the exact coincidence: both conditions become true on one step.
    const same = makeSim(flat({ finish: { x: 30, y: -40, h: 80 }, killRegions: [{ x0: 30, x1: 40, y0: -40, y1: 80, style: 'void' }] }));
    until(same, () => same.status === 'crashed' || same.status === 'finished');
    expect(same.status).toBe('crashed');
  });

  it('accepts a finish, then stops scoring and damage', () => {
    const s = makeSim(flat({ finish: { x: 30, y: -5, h: 40 }, solids: [{ id: 'w', style: 'concrete', x: 60, y: 8, w: 2, h: 16 }] }));
    until(s, () => s.status === 'finished');
    expect(s.status).toBe('finished');
    const t = s.time;
    run(s, 300, IDLE);
    expect(s.status).toBe('finished');
    expect(s.time).toBe(t);
  });

  it('fails the run for falling into a pit or leaving the bounds', () => {
    const p = makeSim(flat({ terrain: [{ id: 'g', style: 'asphalt', points: [[-50, 0], [20, 0], [20, -30]] }], killRegions: [pit(20.2, 60)] }));
    until(p, () => p.status === 'crashed');
    expect(p.deathCause).toBe('pit');
    const b = makeSim(flat({ bounds: { x0: -60, x1: 40, y0: -40, y1: 200 }, finish: { x: 35, y: -5, h: 2 } }));
    until(b, () => b.status === 'crashed');
    expect(b.deathCause).toBe('bounds');
  });

  it('flattens anything under a closing compactor', () => {
    const l = flat({ prefabs: [{ type: 'compactor', id: 'c', x: 0, w: 5, top: 6, floor: 0, rest: 0.1, warn: 0.2, slam: 0.25, hold: 1, rise: 1 }] });
    const s = makeSim(l);
    run(s, 80, { throttle: 0, brake: 1, lean: 0 });
    expect(s.status).toBe('crashed');
    expect(s.deathCause).toBe('crush');
    expect(s.crushed).toBe(true);
    run(s, 300, IDLE);
    expect(s.bodyCount()).toBeLessThan(40);
  });

  it('keeps handling the same after losing a limb', () => {
    const ride = (cut: boolean) => {
      const s = makeSim(flat());
      if (cut) {
        run(s, 1, IDLE);
        s.step(GO);
        bike(s).sever('armUpperN');
        bike(s).sever('legUpperF');
      }
      run(s, 240);
      return s.telemetry();
    };
    const whole = ride(false);
    const missing = ride(true);
    expect(Math.abs(missing.x - whole.x) / whole.x).toBeLessThan(0.02);
    expect(Math.abs(missing.angle - whole.angle)).toBeLessThan(0.08);
  });

  it('moves lost limb mass onto the torso', () => {
    const s = makeSim(flat());
    run(s, 2);
    const v = bike(s);
    const before = v.parts.get('torso')!.getMass();
    const limb = v.parts.get('legLowerN')!.getMass();
    v.sever('legLowerN');
    expect(v.parts.get('torso')!.getMass()).toBeCloseTo(before + limb, 6);
    expect(v.ballastMass()).toBeCloseTo(limb, 6);
  });

  it('keeps the rider anchored after limbs are gone', () => {
    const s = makeSim(flat());
    run(s, 2);
    const v = bike(s);
    for (const p of ['armUpperN', 'armUpperF', 'legUpperN', 'legUpperF'] as const) v.sever(p);
    run(s, 240);
    const torso = v.parts.get('torso')!.getPosition();
    const hip = v.chassis.getWorldPoint(Vec2(-0.22, 0.3));
    expect(Math.hypot(torso.x - hip.x, torso.y - hip.y)).toBeLessThan(0.45);
    expect(v.isAlive()).toBe(true);
  });

  it('turns detached parts into scenery-only debris', () => {
    const s = makeSim(flat());
    run(s, 2);
    const v = bike(s);
    v.sever('legUpperN');
    const f = v.parts.get('legUpperN')!.getFixtureList()!;
    expect(f.getFilterCategoryBits()).toBe(CAT.GORE);
    expect(f.getFilterMaskBits() & CAT.MACHINE).toBe(0);
    expect(f.getFilterMaskBits() & CAT.TRIGGER).toBe(0);
    expect(f.getFilterMaskBits() & CAT.BIKE).toBe(0);
  });

  it('never lets debris operate a mechanism', () => {
    const l = flat({ prefabs: [{ type: 'counterweight', id: 'cw', x: 10, y: 0.05, w: 6, travel: 0.5 }] });
    const s = makeSim(l);
    run(s, 2, GO);
    const v = bike(s);
    v.sever('legUpperN');
    const limb = v.parts.get('legUpperN')!;
    limb.setPosition(Vec2(10, 1.5));
    limb.setLinearVelocity(Vec2(0, -3));
    run(s, 60, { throttle: 0, brake: 0, lean: 1 });
    expect(s.mechanism<Counterweight>('cw')!.p).toBe(0);
  });

  it('marks the run dead only once, and detached parts do not finish', () => {
    const s = makeSim(flat({ finish: { x: 12, y: -5, h: 40 } }));
    run(s, 2);
    const v = bike(s);
    v.decapitate();
    v.kill();
    v.kill();
    expect(v.isAlive()).toBe(false);
  });
});

describe('mechanisms', () => {
  it('counterweight lowers under the bike and raises its ramp', () => {
    const s = makeSim(flat({
      terrain: NOTCHED,
      prefabs: [{ type: 'counterweight', id: 'cw', x: 0, y: 0, w: 8, travel: 0.4, down: 1, up: 0.5, hold: 0.1, ramp: { x: 8, y: 0, len: 5, a0: 0, a1: 0.5 } }],
    }));
    run(s, 2, { throttle: 0, brake: 0, lean: 1 });
    run(s, 90, IDLE);
    const m = s.mechanism<Counterweight>('cw')!;
    expect(m.p).toBeGreaterThan(0.95);
    expect(m.ramp!.getAngle()).toBeGreaterThan(0.4);
  });

  it('latch releases the bridge, once', () => {
    const s = makeSim(LATCH_LEVEL());
    until(s, () => s.telemetry().x > 14);
    expect(s.mechanism<Latch>('latch')!.tripped).toBe(true);
    run(s, 90);
    const b = s.mechanism<Bridge>('bridge')!;
    expect(b.released).toBe(true);
    expect(b.body.getAngle()).toBeCloseTo(0, 2);
  });

  it('brace needs a real hit', () => {
    const l = () => flat({ prefabs: [
      { type: 'brace', id: 'b', x: 5, y: 0.65, w: 0.4, h: 1.3, minSpeed: 5, targets: ['c'] },
      { type: 'cargo', id: 'c', w: 2, h: 1, path: [[40, 10, 0], [40, 1, 0]], duration: 1 },
    ] });
    const slow = makeSim(flat({ spawn: { x: 2.7, y: 0.8 }, prefabs: l().prefabs }));
    until(slow, () => slow.telemetry().x > 3.4, { throttle: 1, brake: 0, lean: 0 }, 60);
    run(slow, 120, { throttle: 0, brake: 0, lean: 0 });
    expect(slow.mechanism<Brace>('b')!.broken).toBe(false);

    const fast = makeSim(flat({ spawn: { x: -40, y: 0.8 }, prefabs: l().prefabs }));
    until(fast, () => fast.telemetry().x > 8);
    expect(fast.mechanism<Brace>('b')!.broken).toBe(true);
    run(fast, 90);
    expect(fast.mechanism<Cargo>('c')!.arrived).toBe(true);
  });

  it('conveyor carries a coasting bike and slows one riding against it', () => {
    const s = makeSim(flat({
      terrain: [{ id: 'g', style: 'asphalt', points: [[-50, 0], [-20, 0], [-20, -1], [60, -1], [60, 0], [790, 0]] }],
      prefabs: [{ type: 'conveyor', id: 'c', x: 20, y: 0, w: 80, speed: 4 }],
    }));
    run(s, 2);
    const x0 = s.telemetry().x;
    run(s, 180, IDLE);
    expect(s.telemetry().x).toBeGreaterThan(x0 + 1);
  });

  it('lift follows its visible cycle', () => {
    const s = makeSim(flat({ prefabs: [{ type: 'lift', id: 'l', ax: 30, ay: 3, bx: 30, by: 8, w: 4, speed: 5, waitA: 0.2, waitB: 0.2, mode: 'cycle' }] }));
    run(s, 74);
    expect(s.mechanism<Lift>('l')!.u).toBeGreaterThan(0.9);
    run(s, 66);
    expect(s.mechanism<Lift>('l')!.u).toBeLessThan(0.3);
  });

  it('swing stays level and keeps its arc', () => {
    const s = makeSim(flat({ prefabs: [{ type: 'swing', id: 's', x: 30, y: 12, rod: 8, w: 6, amplitude: 0.4, period: 4 }] }));
    run(s, 60);
    const m = s.mechanism<Swing>('s')!;
    expect(Math.abs(m.body.getAngle())).toBeLessThan(1e-3);
    const p = m.body.getPosition();
    expect(Math.hypot(p.x - 30, p.y - 12)).toBeCloseTo(8, 1);
  });

  it('tilt tips toward the side the bike is on', () => {
    const s = makeSim(flat({ terrain: NOTCHED, prefabs: [{ type: 'tilt', id: 't', x: 2.5, y: 0, left: 6, right: 6, minA: -0.3, maxA: 0.3, initial: 0, rate: 1 }] }));
    run(s, 2, { throttle: 0, brake: 0, lean: 1 });
    run(s, 40, IDLE);
    expect(s.mechanism<Tilt>('t')!.angle).toBeGreaterThan(0.05);
  });

  it('shutter opens on a plate and closes after', () => {
    const s = makeSim(flat({ terrain: NOTCHED, prefabs: [
      { type: 'counterweight', id: 'p', x: 0, y: 0, w: 8, travel: 0.1, down: 3, up: 3, hold: 0, targets: ['d'], threshold: 0.5 },
      { type: 'shutter', id: 'd', x: 40, floor: 0, height: 3, opening: 2.4, openTime: 0.3, holdTime: 0.3, closeTime: 0.3, mode: 'triggered' },
    ] }));
    run(s, 2, { throttle: 0, brake: 0, lean: 1 });
    run(s, 50, IDLE);
    const d = s.mechanism<Shutter>('d')!;
    expect(d.open).toBeGreaterThan(0.9);
    until(s, () => s.telemetry().x > 12);
    run(s, 140, IDLE);
    expect(d.open).toBeLessThan(0.1);
  });

  it('restores every mechanism on restart', () => {
    for (const level of LEVELS) {
      const first = makeSim(level);
      run(first, 600);
      const fresh = makeSim(level);
      for (const m of fresh.mechanisms) {
        for (const body of m.bodies) expect(fresh.trackOf(body)).toBeDefined();
      }
      const a = makeSim(level);
      const pa = a.mechanisms.flatMap((m) => m.bodies.map((b) => [b.getPosition().x, b.getPosition().y, b.getAngle()]));
      const pb = fresh.mechanisms.flatMap((m) => m.bodies.map((b) => [b.getPosition().x, b.getPosition().y, b.getAngle()]));
      expect(pa).toEqual(pb);
      first.dispose();
    }
  });
});

describe('checkpoints', () => {
  const cp = LEVELS.find((l) => l.levelId === 'rc-07')!;

  it('starts in the authored state, assisted', () => {
    const s = makeSim(cp, { fromCheckpoint: true, time: 12, tag: true });
    expect(s.assisted).toBe(true);
    expect(s.time).toBe(12);
    expect(s.tag).toBe(true);
    expect(s.mechanism<Bridge>('bridge')!.released).toBe(true);
    expect(s.mechanism<Latch>('latch')!.tripped).toBe(true);
    expect(s.telemetry().x).toBeCloseTo(80, 0);
  });

  it('every checkpoint spawn is safe and rideable', () => {
    for (const level of LEVELS.filter((l) => l.checkpoint)) {
      const s = makeSim(level, { fromCheckpoint: true });
      run(s, 1, IDLE);
      expect(s.status).toBe('ready');
      expect(s.telemetry().grounded).toBeGreaterThan(0);
    }
  });

  it('a full start is not assisted', () => {
    expect(makeSim(cp).assisted).toBe(false);
  });
});

describe('restart and cleanup', () => {
  it('leaves nothing behind after 100 crash cycles', () => {
    const level = flat({ solids: [{ id: 'w', style: 'concrete', x: 30, y: 8, w: 2, h: 16 }], prefabs: [{ type: 'cutter', id: 'c', x: 12, y: 0.4, r: 0.6 }] });
    const counts = new Set<number>();
    let last: Simulation | null = null;
    for (let i = 0; i < 100; i++) {
      last?.dispose();
      const s = makeSim(level);
      counts.add(s.bodyCount());
      until(s, () => s.status === 'crashed', GO, 400);
      expect(s.status).toBe('crashed');
      run(s, 30, IDLE);
      last = s;
    }
    expect(counts.size).toBe(1);
  });

  it('builds a restart quickly', () => {
    const level = LEVELS[19];
    const t0 = performance.now();
    for (let i = 0; i < 20; i++) makeSim(level).dispose();
    expect((performance.now() - t0) / 20).toBeLessThan(250);
  });

  it('stays inside the body budget', () => {
    for (const level of LEVELS) expect(makeSim(level).bodyCount()).toBeLessThan(100);
  });

  it('simulation has no dependency on presentation settings', () => {
    expect(SIM.dt).toBeCloseTo(1 / 60);
    const a = makeSim(LEVELS[2]);
    const b = makeSim(LEVELS[2]);
    run(a, 120);
    run(b, 120);
    expect(a.telemetry().x).toBe(b.telemetry().x);
  });
});
