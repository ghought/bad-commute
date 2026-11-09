import { describe, expect, it } from 'vitest';
import { LEVELS, validateCampaign } from '../src/levels';
import { validateLevel, type LevelData, type PrefabData } from '../src/levels/schema';
import { flat } from './helpers';

const latch: PrefabData = { type: 'latch', id: 'l', x: 1, y: 1, targets: ['b'] };
const bridge: PrefabData = { type: 'bridge', id: 'b', x: 1, y: 1, len: 2, upAngle: 1, downAngle: 0 };

describe('level schema', () => {
  it('accepts a sound level', () => {
    expect(validateLevel(flat({ prefabs: [latch, bridge] }))).toEqual([]);
  });

  it('accepts the whole campaign', () => {
    expect(validateCampaign()).toEqual([]);
    expect(LEVELS).toHaveLength(20);
  });

  it('meets the route-changing quota', () => {
    expect(LEVELS.filter((l) => l.routeChanging).length).toBeGreaterThanOrEqual(12);
  });

  it('has three districts of the agreed sizes, in order', () => {
    const counts = LEVELS.reduce<Record<string, number>>((m, l) => ({ ...m, [l.districtId]: (m[l.districtId] ?? 0) + 1 }), {});
    expect(counts).toEqual({ 'road-closed': 7, 'loading-zone': 7, 'roof-access': 6 });
    expect(LEVELS.map((l) => l.order)).toEqual(Array.from({ length: 20 }, (_, i) => i + 1));
  });

  it('gives early courses no checkpoint and selected long ones one', () => {
    expect(LEVELS.slice(0, 6).every((l) => !l.checkpoint)).toBe(true);
    expect(LEVELS.filter((l) => l.checkpoint).map((l) => l.order)).toEqual([7, 14, 20]);
  });

  const broken: Array<[string, Partial<LevelData> | ((l: LevelData) => void), RegExp]> = [
    ['a missing target', { prefabs: [latch] }, /targets missing id "b"/],
    ['duplicate ids', { prefabs: [latch, bridge, { ...bridge }] }, /duplicate id "b"/],
    ['an unknown level field', (l) => ((l as unknown as Record<string, unknown>).gravity = 3), /unknown field "gravity"/],
    ['an unknown prefab field', { prefabs: [{ ...latch, targets: [], speed: 9 } as unknown as PrefabData] }, /unknown field "speed"/],
    ['an unknown prefab type', { prefabs: [{ type: 'trampoline', id: 'x' } as unknown as PrefabData] }, /unknown type/],
    ['a missing required field', { prefabs: [{ type: 'latch', id: 'q', x: 1, targets: [] } as unknown as PrefabData] }, /missing "y"/],
    ['degenerate terrain', { terrain: [{ id: 't', style: 'asphalt', points: [[0, 0], [0, 0.001]] }] }, /degenerate/],
    ['bad solid geometry', { solids: [{ id: 's', style: 'steel', x: 0, y: 0, w: -1, h: 1 }] }, /invalid geometry/],
    ['no finish', (l) => delete (l as Partial<LevelData>).finish, /finish missing/],
    ['a finish outside bounds', { finish: { x: 99999, y: 0, h: 5 } }, /outside bounds/],
    ['an unsupported vehicle', { allowedVehicles: ['unicycle'] }, /unsupported vehicle/],
    ['a checkpoint with a missing mechanism', { checkpoint: { x: 1, y: 0, h: 3, spawn: { x: 1, y: 1 }, restore: { nope: { released: true } } } }, /restores missing id/],
    ['malformed checkpoint state', { prefabs: [bridge], checkpoint: { x: 1, y: 0, h: 3, spawn: { x: 1, y: 1 }, restore: { b: { wibble: 1 } as never } } }, /unknown field "wibble"/],
    ['medals in the wrong order', { medals: { gold: 30, silver: 20, bronze: 10 } }, /medal thresholds/],
  ];

  it.each(broken)('rejects %s', (_name, change, pattern) => {
    const l = flat(typeof change === 'object' ? change : {});
    if (typeof change === 'function') change(l);
    expect(validateLevel(l).join('\n')).toMatch(pattern);
  });
});
