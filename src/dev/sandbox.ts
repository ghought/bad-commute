import { level, pit } from '../levels/authoring';
import type { LevelData } from '../levels/schema';

/** The five greybox test courses from Milestone A. Dev server only. */
export interface SandboxLevel {
  data: LevelData;
  points: Record<string, readonly [number, number]>;
}

const base = (id: string, order: number) => ({
  levelId: `sandbox-${id}`,
  districtId: 'road-closed' as const,
  order: 100 + order,
  title: `Sandbox: ${id}`,
  brief: 'Developer test course.',
  routeChanging: false,
  bounds: { x0: -8, x1: 200, y0: -8, y1: 40 },
  spawn: { x: 2, y: 0.8 },
  tag: { x: 150, y: 6 },
  medals: { gold: 10, silver: 20, bronze: 30 },
  expectedSeconds: [10, 60] as const,
});

export const SANDBOX: SandboxLevel[] = [
  {
    data: level({ ...base('suspension', 1), finish: { x: 180, y: -1, h: 20 }, terrain: [{ id: 'r', style: 'asphalt', points: [[-6, 10], [-6, 0], [12, 0], [16, 0.5], [18, 0], [24, 0], [30, 2], [36, 2], [36.4, 0], [48, 0], [52, 0.3], [53, 0], [54, 0.3], [55, 0], [56, 0.3], [57, 0], [190, 0], [190, 10]] }] }),
    points: { start: [2, 0.8], washboard: [46, 0.8] },
  },
  {
    data: level({ ...base('air', 2), finish: { x: 180, y: -1, h: 20 }, terrain: [{ id: 'r', style: 'concrete', points: [[-6, 10], [-6, 0], [30, 0], [40, 3.6], [40.3, 0], [62, 0], [72, 5.5], [72.4, 0], [190, 0], [190, 10]] }] }),
    points: { start: [2, 0.8], second: [50, 0.8] },
  },
  {
    data: level({ ...base('counterweight', 3), finish: { x: 180, y: -1, h: 20 }, terrain: [{ id: 'n', style: 'concrete', points: [[-6, 10], [-6, 0], [20, 0], [20, -8]] }, { id: 'f', style: 'asphalt', points: [[43.5, -8], [43.5, 0], [190, 0], [190, 10]] }], killRegions: [pit(32.2, 43.4)], prefabs: [{ type: 'counterweight', id: 'cw', x: 26, y: 0, w: 12, travel: 0.62, ramp: { x: 32, y: -0.62, len: 6, a0: -0.02, a1: 0.44 } }] }),
    points: { start: [2, 0.8], plate: [24, 0.8] },
  },
  {
    data: level({ ...base('release', 4), finish: { x: 180, y: -1, h: 20 }, terrain: [{ id: 'n', style: 'concrete', points: [[-6, 10], [-6, 0], [30, 0], [30, -8]] }, { id: 'f', style: 'asphalt', points: [[40, -8], [40, 0], [190, 0], [190, 10]] }], killRegions: [pit(30.1, 39.9)], prefabs: [{ type: 'latch', id: 'l', x: 16, y: 1.05, targets: ['b'] }, { type: 'bridge', id: 'b', x: 40, y: 0, len: -10, upAngle: -1.2, downAngle: 0 }] }),
    points: { start: [2, 0.8], latch: [12, 0.8] },
  },
  {
    data: level({ ...base('machines', 5), finish: { x: 180, y: -1, h: 20 }, terrain: [{ id: 'r', style: 'steel', points: [[-6, 10], [-6, 0], [190, 0], [190, 10]] }], prefabs: [{ type: 'compactor', id: 'c', x: 24, w: 4, top: 6, floor: 0, rest: 2, warn: 1, slam: 0.25, hold: 0.6, rise: 1.2 }, { type: 'cutter', id: 's', x: 44, y: 1.6, r: 0.9 }, { type: 'cutter', id: 's2', x: 56, y: 0.5, r: 0.8 }, { type: 'lift', id: 'lift', ax: 70, ay: 0, bx: 70, by: 5, w: 5, speed: 2, mode: 'cycle' }] }),
    points: { start: [2, 0.8], press: [16, 0.8], saw: [36, 0.8] },
  },
];
