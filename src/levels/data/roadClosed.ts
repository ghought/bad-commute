import { level, pit } from '../authoring';
import type { LevelData } from '../schema';

const D = 'road-closed' as const;
const WALL = 12;

export const ROAD_CLOSED: LevelData[] = [
  level({
    levelId: 'rc-01', districtId: D, order: 1, title: 'Clock In',
    brief: 'Gentle ramps. Throttle, lean, brake, finish.',
    routeChanging: false,
    bounds: { x0: -8, x1: 96, y0: -8, y1: 22 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 78, y: -1, h: 12 },
    terrain: [{ id: 'road', style: 'asphalt', points: [[-6, WALL], [-6, 0], [16, 0], [22, 1.1], [27, 1.1], [33, 0], [44, 0], [50, 1.7], [51, 1.7], [56, 0], [90, 0], [90, WALL]] }],
    tag: { x: 54.2, y: 3.6 },
    decor: [
      { kind: 'sign', x: 8, y: 0, text: 'ROAD CLOSED', layer: 'back' },
      { kind: 'cone', x: 12, y: 0 }, { kind: 'cone', x: 14, y: 0 },
      { kind: 'lamp', x: 36, y: 0 }, { kind: 'barrier', x: 62, y: 0 },
      { kind: 'cone', x: 67, y: 0 }, { kind: 'terminal', x: 84, y: 0 },
    ],
    hints: [
      { x0: -6, x1: 13, keyboard: 'W or Up: throttle', touch: 'Hold GO to ride' },
      { x0: 13, x1: 36, keyboard: 'A or Left leans back. D or Right leans forward.', touch: 'BACK and FWD shift your weight' },
      { x0: 62, x1: 80, keyboard: 'S or Down: brake', touch: 'BRAKE slows you. Hold it at rest to reverse.' },
    ],
    medals: { gold: 6, silver: 8, bronze: 11.5 },
    expectedSeconds: [15, 30],
  }),

  level({
    levelId: 'rc-02', districtId: D, order: 2, title: 'Weight Transfer',
    brief: 'Low barriers. Get the front wheel up.',
    routeChanging: false,
    bounds: { x0: -8, x1: 100, y0: -8, y1: 22 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 86, y: -1, h: 12 },
    terrain: [{ id: 'road', style: 'asphalt', points: [
      [-6, WALL], [-6, 0], [20, 0], [20.15, 0.42], [21.05, 0.42], [21.2, 0], [38, 0], [38.15, 0.42], [39.05, 0.42], [39.2, 0],
      [54, 0], [54.15, 0.42], [55.05, 0.42], [55.2, 0], [66, 0], [70, 1.5], [70.4, 1.5], [70.9, 0], [96, 0], [96, WALL],
    ] }],
    tag: { x: 73.5, y: 3.5 },
    decor: [
      { kind: 'barrier', x: 12, y: 0, layer: 'back' }, { kind: 'cone', x: 17, y: 0 }, { kind: 'cone', x: 35, y: 0 },
      { kind: 'lamp', x: 46, y: 0 }, { kind: 'cone', x: 51, y: 0 }, { kind: 'terminal', x: 92, y: 0 },
    ],
    hints: [
      { x0: 8, x1: 21, keyboard: 'Hold A or Left with throttle to lift the front wheel', touch: 'Hold BACK with GO to lift the front wheel' },
    ],
    medals: { gold: 11.5, silver: 15, bronze: 22.5 },
    expectedSeconds: [15, 30],
  }),

  level({
    levelId: 'rc-03', districtId: D, order: 3, title: 'Load Limit',
    brief: 'Your weight raises the ramp. Time your exit.',
    routeChanging: true,
    bounds: { x0: -8, x1: 92, y0: -8, y1: 24 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 72, y: -1, h: 12 },
    terrain: [
      { id: 'near', style: 'concrete', points: [[-6, WALL], [-6, 0], [20, 0], [20, -8]] },
      { id: 'pit-floor', style: 'concrete', points: [[20, -1.2], [32, -1.2]] },
      { id: 'far', style: 'asphalt', points: [[43.5, -8], [43.5, 0], [84, 0], [84, WALL]] },
    ],
    killRegions: [pit(32.2, 43.4)],
    prefabs: [
      { type: 'counterweight', id: 'cw', x: 26, y: 0, w: 12, travel: 0.62, down: 0.8, up: 0.3, hold: 1.6,
        ramp: { x: 32, y: -0.62, len: 6, a0: -0.02, a1: 0.44 } },
    ],
    tag: { x: 41.6, y: 4.35 },
    decor: [
      { kind: 'danger', x: 18, y: 0, layer: 'back' }, { kind: 'sign', x: 10, y: 0, text: 'LOAD ZONE', layer: 'back' },
      { kind: 'lamp', x: 52, y: 0 }, { kind: 'cone', x: 60, y: 0 }, { kind: 'terminal', x: 78, y: 0 },
    ],
    hints: [
      { x0: 14, x1: 31, keyboard: 'Stop on the plate. Your weight raises the ramp ahead.', touch: 'Stop on the plate. Your weight raises the ramp ahead.' },
    ],
    cameraZones: [{ x0: 20, x1: 46, zoom: 2.5, look: 2 }],
    medals: { gold: 7, silver: 9, bronze: 13 },
    expectedSeconds: [15, 35],
  }),

  level({
    levelId: 'rc-04', districtId: D, order: 4, title: 'Temporary Fix',
    brief: 'Hit the amber latch. Hope the bridge comes down in time.',
    routeChanging: true,
    bounds: { x0: -8, x1: 96, y0: -8, y1: 24 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 76, y: -1, h: 12 },
    terrain: [
      { id: 'near', style: 'concrete', points: [[-6, WALL], [-6, 0], [25, 0], [28.2, 1.7], [29.8, 0], [36, 0], [36, -8]] },
      { id: 'far', style: 'asphalt', points: [[46, -8], [46, 0], [88, 0], [88, WALL]] },
    ],
    solids: [{ id: 'upper', style: 'steel', x: 39.5, y: 2.9, w: 13, h: 0.4 }],
    killRegions: [pit(36.1, 45.9)],
    prefabs: [
      { type: 'latch', id: 'latch', x: 20, y: 1.05, targets: ['bridge'] },
      { type: 'bridge', id: 'bridge', x: 46, y: 0, len: -10, upAngle: -1.15, downAngle: 0, fall: 8 },
    ],
    tag: { x: 43, y: 4.1 },
    decor: [
      { kind: 'arrow', x: 14, y: 0, layer: 'back' }, { kind: 'danger', x: 34, y: 0, layer: 'back' },
      { kind: 'lamp', x: 54, y: 0 }, { kind: 'barrier', x: 63, y: 0 }, { kind: 'terminal', x: 82, y: 0 },
    ],
    hints: [
      { x0: 10, x1: 22, keyboard: 'Ride into the amber latch', touch: 'Ride into the amber latch' },
    ],
    cameraZones: [{ x0: 24, x1: 50, zoom: 2 }],
    medals: { gold: 6, silver: 8, bronze: 12 },
    expectedSeconds: [15, 35],
  }),

  level({
    levelId: 'rc-05', districtId: D, order: 5, title: 'Public Works',
    brief: 'A slow service lift over a long way down.',
    routeChanging: true,
    bounds: { x0: -8, x1: 104, y0: -8, y1: 26 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 88, y: -1, h: 12 },
    terrain: [
      { id: 'near', style: 'concrete', points: [[-6, WALL], [-6, 0], [20, 0], [20, -8]] },
      { id: 'far', style: 'asphalt', points: [[44, -8], [44, 0], [98, 0], [98, WALL]] },
    ],
    killRegions: [pit(20.1, 43.9)],
    prefabs: [
      { type: 'lift', id: 'ferry', ax: 24, ay: 0, bx: 40, by: 0, w: 8, speed: 3.2, waitA: 2, waitB: 2, mode: 'cycle' },
      { type: 'lift', id: 'hoist', ax: 60, ay: 0, bx: 60, by: 6.4, w: 5, speed: 1.9, waitA: 2, waitB: 2, phase: 2, mode: 'cycle', crushFloor: 0 },
    ],
    tag: { x: 60.5, y: 7.8 },
    decor: [
      { kind: 'danger', x: 18, y: 0, layer: 'back' }, { kind: 'sign', x: 10, y: 0, text: 'NO FOOTING', layer: 'back' },
      { kind: 'lamp', x: 50, y: 0 }, { kind: 'cone', x: 70, y: 0 }, { kind: 'terminal', x: 94, y: 0 },
    ],
    hints: [
      { x0: 12, x1: 22, keyboard: 'Wait for the lift. The black and red edge means do not fall in.', touch: 'Wait for the lift. The black and red edge means do not fall in.' },
    ],
    cameraZones: [{ x0: 18, x1: 46, zoom: 3, look: 2 }, { x0: 54, x1: 68, zoom: 3 }],
    medals: { gold: 27, silver: 35.5, bronze: 52.5 },
    expectedSeconds: [20, 45],
  }),

  level({
    levelId: 'rc-06', districtId: D, order: 6, title: 'Lunch Break',
    brief: 'A girder on a pivot, and a beam just above where you land.',
    routeChanging: true,
    bounds: { x0: -8, x1: 104, y0: -8, y1: 26 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 86, y: -1, h: 12 },
    terrain: [
      { id: 'near', style: 'concrete', points: [[-6, WALL], [-6, 0], [14, 0], [14, -8]] },
      { id: 'far', style: 'asphalt', points: [[34, -8], [34, 0], [96, 0], [96, WALL]] },
    ],
    solids: [
      { id: 'beam', style: 'steel', x: 46, y: 2.7, w: 18, h: 0.65 },
    ],
    killRegions: [pit(14.1, 33.9)],
    prefabs: [{ type: 'tilt', id: 'girder', x: 24, y: 2.4, left: 10, right: 10, minA: -0.24, maxA: 0.24, initial: 0.24, rate: 0.5 }],
    tag: { x: 48, y: 4.25 },
    decor: [
      { kind: 'danger', x: 13, y: 0, layer: 'back' }, { kind: 'drum', x: 38, y: 0, layer: 'back' },
      { kind: 'cone', x: 66, y: 0 }, { kind: 'lamp', x: 74, y: 0 }, { kind: 'terminal', x: 92, y: 0 },
    ],
    hints: [
      { x0: 8, x1: 26, keyboard: 'The girder tips when you pass the pivot. Slow down.', touch: 'The girder tips when you pass the pivot. Slow down.' },
    ],
    cameraZones: [{ x0: 13, x1: 54, zoom: 3 }],
    medals: { gold: 6.5, silver: 8.5, bronze: 12.5 },
    expectedSeconds: [15, 40],
  }),

  level({
    levelId: 'rc-07', districtId: D, order: 7, title: 'Road Test',
    brief: 'Lift, latch, plate. In that order, ideally.',
    routeChanging: true,
    bounds: { x0: -8, x1: 158, y0: -8, y1: 28 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 142, y: -1, h: 14 },
    terrain: [
      { id: 'a', style: 'concrete', points: [[-6, WALL], [-6, 0], [14, 0], [14, -8]] },
      { id: 'b', style: 'asphalt', points: [[36, -8], [36, 0], [60, 0], [60, -8]] },
      { id: 'c', style: 'asphalt', points: [[70, -8], [70, 0], [86, 0], [86, -8]] },
      { id: 'c-floor', style: 'concrete', points: [[86, -1.2], [98, -1.2]] },
      { id: 'd', style: 'asphalt', points: [[109.5, -8], [109.5, 0], [152, 0], [152, WALL]] },
    ],
    killRegions: [pit(14.1, 35.9), pit(60.1, 69.9), pit(98.2, 109.4)],
    prefabs: [
      { type: 'lift', id: 'ferry', ax: 18, ay: 0, bx: 32, by: 0, w: 8, speed: 4, waitA: 1.4, waitB: 1.4, mode: 'cycle' },
      { type: 'latch', id: 'latch', x: 50, y: 1.05, targets: ['bridge'] },
      { type: 'bridge', id: 'bridge', x: 70, y: 0, len: -10, upAngle: -1.2, downAngle: 0, fall: 9 },
      { type: 'counterweight', id: 'cw', x: 92, y: 0, w: 12, travel: 0.62, down: 0.85, up: 0.3, hold: 1.6,
        ramp: { x: 98, y: -0.62, len: 6, a0: -0.02, a1: 0.44 } },
    ],
    checkpoint: { x: 78, y: 0, h: 5, spawn: { x: 80, y: 0.8 }, restore: { latch: { released: true }, bridge: { released: true } } },
    tag: { x: 106.8, y: 4.5 },
    decor: [
      { kind: 'danger', x: 12, y: 0, layer: 'back' }, { kind: 'arrow', x: 45, y: 0, layer: 'back' },
      { kind: 'danger', x: 58, y: 0, layer: 'back' }, { kind: 'lamp', x: 118, y: 0 }, { kind: 'terminal', x: 148, y: 0 },
    ],
    cameraZones: [{ x0: 12, x1: 38, zoom: 3 }, { x0: 58, x1: 72, zoom: 2 }, { x0: 86, x1: 112, zoom: 2.5, look: 2 }],
    medals: { gold: 24, silver: 31.5, bronze: 46 },
    expectedSeconds: [30, 70],
  }),
];
