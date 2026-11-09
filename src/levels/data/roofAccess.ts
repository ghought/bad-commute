import { level, pit } from '../authoring';
import type { LevelData } from '../schema';

const D = 'roof-access' as const;
const WALL = 16;

export const ROOF_ACCESS: LevelData[] = [
  level({
    levelId: 'ra-15', districtId: D, order: 15, title: 'Service Entrance',
    brief: 'Release the cradle and ride it to the roof.',
    routeChanging: true,
    bounds: { x0: -8, x1: 100, y0: -8, y1: 36 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 84, y: 10, h: 12 },
    terrain: [{ id: 'building', style: 'brick', points: [[-6, 26], [-6, 0], [30, 0], [30, 11], [92, 11], [92, 30]] }],
    solids: [{ id: 'high-ledge', style: 'roof', x: 56, y: 15.1, w: 8, h: 0.3 }],
    prefabs: [
      { type: 'latch', id: 'latch', x: 25.5, y: 1.05, targets: ['cradle'] },
      { type: 'lift', id: 'cradle', ax: 26, ay: 0, bx: 26, by: 11, w: 7.8, speed: 3, mode: 'activated', style: 'cradle' },
      { type: 'lift', id: 'hoist', ax: 49, ay: 11, bx: 49, by: 15.2, w: 5.8, speed: 2.2, waitA: 2.2, waitB: 2.2, mode: 'cycle', crushFloor: 11 },
    ],
    tag: { x: 57, y: 16.4 },
    decor: [
      { kind: 'sign', x: 10, y: 0, text: 'ROOF ACCESS', layer: 'back' }, { kind: 'cone', x: 16, y: 0 },
      { kind: 'vent', x: 40, y: 11, layer: 'back' }, { kind: 'antenna', x: 70, y: 11, layer: 'back' }, { kind: 'terminal', x: 88, y: 11 },
    ],
    hints: [{ x0: 12, x1: 26, keyboard: 'Stop on the cradle. The latch starts it.', touch: 'Stop on the cradle. The latch starts it.' }],
    cameraZones: [{ x0: 18, x1: 31, zoom: 3 }],
    medals: { gold: 17, silver: 22, bronze: 32.5 },
    expectedSeconds: [20, 45],
  }),

  level({
    levelId: 'ra-16', districtId: D, order: 16, title: 'Ventilation',
    brief: 'Low ducts. Keep your head down, literally.',
    routeChanging: false,
    bounds: { x0: -34, x1: 106, y0: -8, y1: 28 },
    spawn: { x: -28, y: 0.8 },
    finish: { x: 90, y: -2, h: 12 },
    terrain: [
      { id: 'a', style: 'roof', points: [[-32, WALL], [-32, 0], [9, 0], [13, 2.2], [13.5, 2.2], [13.7, 0], [25, 0], [28, 0.5], [28, -8]] },
      { id: 'b', style: 'roof', points: [[31.4, -8], [31.4, -0.4], [47, -0.4], [50, 0.1], [50, -8]] },
      { id: 'c', style: 'roof', points: [[54, -8], [54, -0.8], [100, -0.8], [100, WALL]] },
    ],
    solids: [
      { id: 'duct1', style: 'steel', x: 32, y: 3.15, w: 30, h: 0.75 },
      { id: 'duct2', style: 'steel', x: 66, y: 2.7, w: 18, h: 0.7 },
    ],
    killRegions: [pit(28.1, 31.3), pit(50.1, 53.9)],
    tag: { x: 40, y: 4.75 },
    decor: [
      { kind: 'danger', x: 26.5, y: 0, layer: 'back' }, { kind: 'vent', x: 7, y: 0, layer: 'back' },
      { kind: 'antenna', x: 80, y: -0.8, layer: 'back' }, { kind: 'terminal', x: 96, y: -0.8 },
    ],
    hints: [{ x0: 14, x1: 30, keyboard: 'Headroom is limited. Do not pop the front wheel in here.', touch: 'Headroom is limited. Do not pop the front wheel in here.' }],
    medals: { gold: 11.5, silver: 14.5, bronze: 21.5 },
    expectedSeconds: [15, 40],
  }),

  level({
    levelId: 'ra-17', districtId: D, order: 17, title: 'Window Cleaning',
    brief: 'Two cradles on long arms. Both of them are late.',
    routeChanging: true,
    bounds: { x0: -8, x1: 112, y0: -10, y1: 28 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 96, y: -3, h: 12 },
    terrain: [
      { id: 'a', style: 'roof', points: [[-6, WALL], [-6, 0], [20.2, 0], [20.2, -8]] },
      { id: 'b', style: 'roof', points: [[59.6, -10], [59.6, -2.3], [106, -2.3], [106, WALL]] },
    ],
    killRegions: [{ x0: 20.3, x1: 59.5, y0: -30, y1: -7.5, style: 'pit' }],
    prefabs: [
      { type: 'swing', id: 'swing1', x: 29, y: 7.2, rod: 8, w: 10, amplitude: 0.45, period: 7, phase: -1.75 },
      { type: 'swing', id: 'swing2', x: 50, y: 5.2, rod: 8, w: 13, amplitude: 0.45, period: 7, phase: 1.75 },
    ],
    tag: { x: 38.8, y: 1.25 },
    decor: [
      { kind: 'danger', x: 18, y: 0, layer: 'back' }, { kind: 'stencil', x: 41, y: 9, text: 'WINDOWS', layer: 'back' },
      { kind: 'vent', x: 80, y: -2.3, layer: 'back' }, { kind: 'terminal', x: 102, y: -2.3 },
    ],
    hints: [{ x0: 8, x1: 21, keyboard: 'Ride on when the cradle reaches the roof edge', touch: 'Ride on when the cradle reaches the roof edge' }],
    cameraZones: [{ x0: 17, x1: 63, zoom: 4.5, y: 1.5 }],
    medals: { gold: 19, silver: 25, bronze: 37 },
    expectedSeconds: [25, 60],
  }),

  level({
    levelId: 'ra-18', districtId: D, order: 18, title: 'Counterbalance',
    brief: 'Your weight lifts the bridge. Then you have to leave.',
    routeChanging: true,
    bounds: { x0: -8, x1: 104, y0: -8, y1: 32 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 88, y: -1.5, h: 12 },
    terrain: [
      { id: 'a', style: 'roof', points: [[-6, WALL], [-6, 0], [14, 0], [14, -8]] },
      { id: 'a-floor', style: 'roof', points: [[14, -1.6], [26, -1.6], [26, -8]] },
      { id: 'b', style: 'roof', points: [[43, -8], [43, -0.5], [98, -0.5], [98, WALL]] },
    ],
    killRegions: [pit(26.1, 42.9)],
    prefabs: [
      { type: 'counterweight', id: 'cw', x: 20, y: 0, w: 12, travel: 0.5, down: 0.55, up: 0.28, hold: 1.8,
        ramp: { x: 26.05, y: -0.5, len: 15, a0: -1.05, a1: 0.2, style: 'bridge' } },
    ],
    tag: { x: 45, y: 4.15 },
    decor: [
      { kind: 'danger', x: 12, y: 0, layer: 'back' }, { kind: 'sign', x: 7, y: 0, text: 'LOAD ROOF', layer: 'back' },
      { kind: 'vent', x: 52, y: -0.5, layer: 'back' }, { kind: 'antenna', x: 72, y: -0.5, layer: 'back' }, { kind: 'terminal', x: 94, y: -0.5 },
    ],
    hints: [{ x0: 8, x1: 24, keyboard: 'Stay on the plate until the bridge is up. Then commit.', touch: 'Stay on the plate until the bridge is up. Then commit.' }],
    cameraZones: [{ x0: 12, x1: 48, zoom: 4, look: 3 }],
    medals: { gold: 10, silver: 13.5, bronze: 19.5 },
    expectedSeconds: [20, 45],
  }),

  level({
    levelId: 'ra-19', districtId: D, order: 19, title: 'Out of Service',
    brief: 'Drop the sign across the gap. It was not doing anything else.',
    routeChanging: true,
    bounds: { x0: -8, x1: 110, y0: -8, y1: 32 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 94, y: 5, h: 12 },
    terrain: [
      { id: 'a', style: 'roof', points: [[-6, WALL], [-6, 0], [17, 0], [21.8, 1.5], [21.8, -8]] },
      { id: 'b', style: 'roof', points: [[38.2, -8], [38.2, 0], [52.2, 0], [52.2, 6.5], [104, 6.5], [104, 26]] },
    ],
    killRegions: [pit(21.9, 38.1)],
    prefabs: [
      { type: 'latch', id: 'latch', x: 10, y: 1.05, targets: ['sign'] },
      { type: 'cargo', id: 'sign', w: 16.8, h: 0.8, path: [[30, 15, 1.15], [30, 8, 0.65], [30, -0.4, 0]], duration: 1.15, style: 'sign' },
      { type: 'lift', id: 'hoist', ax: 48, ay: 0, bx: 48, by: 6.5, w: 8, speed: 2.8, waitA: 2.4, waitB: 2.4, mode: 'cycle', crushFloor: 0 },
    ],
    tag: { x: 28.5, y: 3.05 },
    decor: [
      { kind: 'arrow', x: 5, y: 0, layer: 'back' }, { kind: 'danger', x: 16, y: 0, layer: 'back' },
      { kind: 'antenna', x: 66, y: 6.5, layer: 'back' }, { kind: 'vent', x: 80, y: 6.5, layer: 'back' }, { kind: 'terminal', x: 100, y: 6.5 },
    ],
    hints: [{ x0: 3, x1: 12, keyboard: 'Amber latch: ride through it', touch: 'Amber latch: ride through it' }],
    cameraZones: [{ x0: 14, x1: 52, zoom: 4.5, y: 4.5 }],
    medals: { gold: 20, silver: 26.5, bronze: 39 },
    expectedSeconds: [25, 55],
  }),

  level({
    levelId: 'ra-20', districtId: D, order: 20, title: 'End of Shift',
    brief: 'Everything, once more. Then clock out.',
    routeChanging: true,
    bounds: { x0: -8, x1: 188, y0: -8, y1: 34 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 170, y: -1, h: 14 },
    terrain: [
      { id: 'a', style: 'roof', points: [[-6, WALL], [-6, 0], [12, 0], [12, -8]] },
      { id: 'a-floor', style: 'roof', points: [[12, -1.2], [24, -1.2], [24, -8]] },
      { id: 'b', style: 'asphalt', points: [[35.5, -8], [35.5, 0], [68, 0], [68, -8]] },
      { id: 'c', style: 'concrete', points: [[78, -8], [78, 0], [120, 0], [124, 1.5], [124, -8]] },
      { id: 'd', style: 'asphalt', points: [[148, -8], [148, 0], [182, 0], [182, WALL]] },
    ],
    killRegions: [pit(24.2, 35.4), pit(68.1, 77.9), pit(124.1, 147.9)],
    prefabs: [
      { type: 'counterweight', id: 'cw', x: 18, y: 0, w: 12, travel: 0.62, down: 0.85, up: 0.3, hold: 1.6, ramp: { x: 24, y: -0.62, len: 6, a0: -0.02, a1: 0.44 } },
      { type: 'latch', id: 'latch', x: 56, y: 1.05, targets: ['bridge'] },
      { type: 'bridge', id: 'bridge', x: 78, y: 0, len: -10, upAngle: -1.2, downAngle: 0, fall: 9 },
      { type: 'compactor', id: 'press', x: 100, w: 5.4, top: 5.6, floor: 0, rest: 2.2, warn: 1.1, slam: 0.28, hold: 0.7, rise: 1.3 },
      { type: 'lift', id: 'ferry', ax: 129, ay: 0, bx: 143, by: 0, w: 9, speed: 3.8, waitA: 2, waitB: 1.4, mode: 'cycle' },
    ],
    checkpoint: { x: 86, y: 0, h: 5, spawn: { x: 84, y: 0.8 }, restore: { latch: { released: true }, bridge: { released: true }, press: { phase: 0 }, ferry: { phase: 0 } } },
    tag: { x: 127.6, y: 3.2 },
    decor: [
      { kind: 'sign', x: 6, y: 0, text: 'LAST ONE', layer: 'back' }, { kind: 'danger', x: 66, y: 0, layer: 'back' },
      { kind: 'antenna', x: 46, y: 0, layer: 'back' }, { kind: 'vent', x: 110, y: 0, layer: 'back' }, { kind: 'lamp', x: 155, y: 0 }, { kind: 'terminal', x: 176, y: 0 },
    ],
    cameraZones: [{ x0: 12, x1: 38, zoom: 2.5, look: 2 }, { x0: 122, x1: 150, zoom: 3.5 }],
    medals: { gold: 20, silver: 26.5, bronze: 39 },
    expectedSeconds: [45, 90],
  }),
];
