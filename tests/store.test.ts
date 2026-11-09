import { describe, expect, it } from 'vitest';
import { GHOST, PHYSICS_VERSION } from '../src/config/tuning';
import { GhostPlayer, GhostRecorder, ghostCompatible } from '../src/store/ghost';
import { ProgressStore, SAVE_VERSION, freshSave, medalFor, migrate, recordKey, type StorageLike } from '../src/store/progress';
import { flat } from './helpers';

const memory = (): StorageLike & { map: Map<string, string> } => {
  const map = new Map<string, string>();
  return { map, getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
};
const unlocks: Array<{ name: string; unlockAt: number }> = [{ name: 'A', unlockAt: 1 }, { name: 'B', unlockAt: 2 }];
const L = flat();
const run = (timeMs: number, assisted = false, tag = false) => ({ timeMs, assisted, tag, vehicleId: 'motorbike' });

describe('progress', () => {
  it('awards medals from thresholds', () => {
    expect(medalFor(L, 9000)).toBe('gold');
    expect(medalFor(L, 15000)).toBe('silver');
    expect(medalFor(L, 25000)).toBe('bronze');
    expect(medalFor(L, 99000)).toBe(null);
  });

  it('persists across a reload', () => {
    const s = memory();
    new ProgressStore(s).applyRun(L, run(9000, false, true), unlocks);
    const again = new ProgressStore(s);
    expect(again.data.levels.test).toMatchObject({ completed: true, medal: 'gold', tag: true });
    expect(again.bestMs(L, 'motorbike')).toBe(9000);
  });

  it('completes an assisted run without a time or medal', () => {
    const p = new ProgressStore(memory());
    const out = p.applyRun(L, run(5000, true), unlocks);
    expect(out).toMatchObject({ medal: null, newBest: false, bestMs: null });
    expect(p.data.levels.test.completed).toBe(true);
    expect(p.data.levels.test.medal).toBe(null);
  });

  it('keeps the best time and the best medal', () => {
    const p = new ProgressStore(memory());
    p.applyRun(L, run(9000), unlocks);
    const out = p.applyRun(L, run(15000), unlocks);
    expect(out.newBest).toBe(false);
    expect(p.bestMs(L, 'motorbike')).toBe(9000);
    expect(p.data.levels.test.medal).toBe('gold');
  });

  it('banks a tag once and keeps it', () => {
    const p = new ProgressStore(memory());
    p.applyRun(L, run(9000, false, true), unlocks);
    p.applyRun(L, run(9000, false, false), unlocks);
    expect(p.data.levels.test.tag).toBe(true);
  });

  it('retires times when level or physics change, but not completion', () => {
    const p = new ProgressStore(memory());
    p.applyRun(L, run(9000), unlocks);
    expect(p.bestMs({ ...L, levelVersion: 2 }, 'motorbike')).toBe(null);
    expect(p.data.levels.test.completed).toBe(true);
    expect(recordKey(L, 'motorbike', PHYSICS_VERSION + 1)).not.toBe(recordKey(L, 'motorbike'));
  });

  it('reports unlocks only as they are crossed', () => {
    const p = new ProgressStore(memory());
    expect(p.applyRun(L, run(9000), unlocks).unlocks).toEqual(['A']);
    expect(p.applyRun(L, run(8000), unlocks).unlocks).toEqual([]);
    expect(p.applyRun({ ...L, levelId: 'other' }, run(8000), unlocks).unlocks).toEqual(['B']);
  });

  it('unlocks strictly in sequence', () => {
    const ordered = [{ order: 1, levelId: 'a' }, { order: 2, levelId: 'b' }];
    const p = new ProgressStore(memory());
    expect(p.isUnlocked(ordered[0], ordered)).toBe(true);
    expect(p.isUnlocked(ordered[1], ordered)).toBe(false);
    p.record('a').completed = true;
    expect(p.isUnlocked(ordered[1], ordered)).toBe(true);
  });

  it('migrates a version 0 save', () => {
    const out = migrate({ progress: { 'rc-01': { done: true, best: 3 } } });
    expect(out.version).toBe(SAVE_VERSION);
    expect(out.levels['rc-01'].completed).toBe(true);
    expect(out.settings.gore).toBe('full');
  });

  it('survives junk and future saves', () => {
    expect(migrate('nope')).toEqual(freshSave());
    expect(migrate(null)).toEqual(freshSave());
    expect(migrate({ version: 999, levels: { x: 1 } })).toEqual(freshSave());
  });

  it('fills in settings added since the save was written', () => {
    const out = migrate({ version: 1, noticeSeen: true, levels: {}, settings: { gore: 'off' } });
    expect(out.settings.gore).toBe('off');
    expect(out.settings.touchScale).toBe(1);
    expect(out.noticeSeen).toBe(true);
  });

  it('keeps playing when storage is denied', () => {
    const denied: StorageLike = {
      getItem() {
        throw new Error('denied');
      },
      setItem() {
        throw new Error('denied');
      },
    };
    const p = new ProgressStore(denied);
    expect(p.saveFailed).toBe(true);
    expect(() => p.applyRun(L, run(9000), unlocks)).not.toThrow();
    expect(p.data.levels.test.completed).toBe(true);
    expect(p.saveFailed).toBe(true);
  });

  it('copes with no storage at all', () => {
    const p = new ProgressStore(null);
    expect(() => p.save()).not.toThrow();
  });
});

describe('ghosts', () => {
  const pose = (t: number) => (out: Array<{ id: string; x: number; y: number; angle: number }>) => {
    out.push({ id: 'chassis', x: t * 10, y: 1, angle: 0 });
  };

  it('records at a bounded rate and plays back interpolated', () => {
    const r = new GhostRecorder();
    for (let i = 0; i < 240; i++) r.tick(i / 60, pose(i / 60));
    const g = r.finish(4000, L, 'motorbike')!;
    expect(g.samples.length).toBeLessThanOrEqual(3 * (GHOST.sampleHz * 4 + 2));
    const f = new GhostPlayer(g).at(1.025)!;
    expect(f.get('chassis')!.x).toBeCloseTo(10.25, 1);
  });

  it('stops recording at the cap', () => {
    const r = new GhostRecorder();
    for (let i = 0; i < 60 * (GHOST.maxSeconds + 30); i += 3) r.tick(i / 60, pose(i / 60));
    const g = r.finish(1, L, 'motorbike')!;
    expect(g.samples.length / 3).toBeLessThanOrEqual(GHOST.maxSeconds * GHOST.sampleHz);
  });

  it('ends cleanly', () => {
    const r = new GhostRecorder();
    for (let i = 0; i < 60; i++) r.tick(i / 60, pose(i / 60));
    expect(new GhostPlayer(r.finish(1000, L, 'motorbike')!).at(5)).toBe(null);
  });

  it('refuses to play on a changed course or physics', () => {
    const r = new GhostRecorder();
    for (let i = 0; i < 60; i++) r.tick(i / 60, pose(i / 60));
    const g = r.finish(1000, L, 'motorbike')!;
    expect(ghostCompatible(g, L, 'motorbike')).toBe(true);
    expect(ghostCompatible(g, { levelVersion: 2 }, 'motorbike')).toBe(false);
    expect(ghostCompatible(g, L, 'other')).toBe(false);
    expect(ghostCompatible(g, L, 'motorbike', PHYSICS_VERSION + 1)).toBe(false);
  });
});
