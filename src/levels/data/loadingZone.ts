import { level, pit } from '../authoring';
import type { LevelData } from '../schema';

const D = 'loading-zone' as const;
const WALL = 14;

export const LOADING_ZONE: LevelData[] = [
  level({
    levelId: 'lz-08', districtId: D, order: 8, title: 'Receiving',
    brief: 'Belts carry you, or carry you backward.',
    routeChanging: false,
    bounds: { x0: -8, x1: 118, y0: -8, y1: 24 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 104, y: -1, h: 12 },
    terrain: [{ id: 'floor', style: 'concrete', points: [
      [-6, WALL], [-6, 0], [12, 0], [12, -0.8], [34, -0.8], [34, 0], [42, 0], [42, -0.8], [62, -0.8], [62, 0], [66, 1.7], [66.4, 1.7], [66.9, 0],
      [76, 0], [76, -0.8], [96, -0.8], [96, 0], [112, 0], [112, WALL],
    ] }],
    prefabs: [
      { type: 'conveyor', id: 'belt1', x: 23, y: 0, w: 22, speed: 3.5 },
      { type: 'conveyor', id: 'belt2', x: 52, y: 0, w: 20, speed: -3.5 },
      { type: 'conveyor', id: 'belt3', x: 86, y: 0, w: 20, speed: 5 },
    ],
    tag: { x: 70.5, y: 4 },
    decor: [
      { kind: 'crate', x: 8, y: 0, layer: 'back' }, { kind: 'stencil', x: 23, y: 3, text: 'RECEIVING', layer: 'back' },
      { kind: 'drum', x: 38, y: 0, layer: 'back' }, { kind: 'crate', x: 72, y: 0, layer: 'back' }, { kind: 'terminal', x: 108, y: 0 },
    ],
    hints: [
      { x0: 8, x1: 34, keyboard: 'Belts add their speed to yours', touch: 'Belts add their speed to yours' },
      { x0: 40, x1: 60, keyboard: 'This one is against you. Stay on the throttle.', touch: 'This one is against you. Stay on GO.' },
    ],
    medals: { gold: 9, silver: 11.5, bronze: 17.5 },
    expectedSeconds: [15, 40],
  }),

  level({
    levelId: 'lz-09', districtId: D, order: 9, title: 'Authorized Entry',
    brief: 'The plate opens the shutter. The shutter closes anyway.',
    routeChanging: true,
    bounds: { x0: -8, x1: 96, y0: -8, y1: 26 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 80, y: -1, h: 12 },
    terrain: [{ id: 'floor', style: 'concrete', points: [[-6, WALL], [-6, 0], [11, 0], [11, -1], [21, -1], [21, -0.22], [23, 0], [90, 0], [90, WALL]] }],
    solids: [
      { id: 'lintel', style: 'brick', x: 42, y: 3.45, w: 1, h: 2.1 },
      { id: 'upper-deck', style: 'steel', x: 40.75, y: 4.65, w: 19.5, h: 0.3 },
      { id: 'upper-wall', style: 'brick', x: 42, y: 10.4, w: 1, h: 7 },
    ],
    prefabs: [
      { type: 'counterweight', id: 'plate', x: 16, y: 0, w: 10, travel: 0.22, down: 1.1, up: 0.4, hold: 1.2, targets: ['door'], threshold: 0.8 },
      { type: 'shutter', id: 'door', x: 42, floor: 0, height: 2.4, opening: 2.25, openTime: 1.1, holdTime: 3.2, closeTime: 2.6, mode: 'triggered' },
      { type: 'lift', id: 'hoist', ax: 28, ay: 0, bx: 28, by: 4.8, w: 5, speed: 2.4, waitA: 2, waitB: 4, phase: 3, mode: 'cycle', crushFloor: 0 },
    ],
    tag: { x: 46, y: 6 },
    decor: [
      { kind: 'crate', x: 7, y: 0, layer: 'back' }, { kind: 'stencil', x: 16, y: 3.2, text: 'AUTHORIZED', layer: 'back' },
      { kind: 'crate', x: 62, y: 0, layer: 'back' }, { kind: 'drum', x: 68, y: 0, layer: 'back' }, { kind: 'terminal', x: 86, y: 0 },
    ],
    hints: [{ x0: 6, x1: 22, keyboard: 'Stop on the plate until the shutter is open', touch: 'Stop on the plate until the shutter is open' }],
    cameraZones: [{ x0: 22, x1: 54, zoom: 2 }],
    medals: { gold: 11, silver: 14, bronze: 21 },
    expectedSeconds: [20, 40],
  }),

  level({
    levelId: 'lz-10', districtId: D, order: 10, title: 'Forklift Certified',
    brief: 'The forks do not stop for you. You stop for the forks.',
    routeChanging: true,
    bounds: { x0: -8, x1: 116, y0: -8, y1: 28 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 100, y: -1, h: 12 },
    terrain: [
      { id: 'a', style: 'concrete', points: [[-6, WALL], [-6, 0], [18, 0], [18, -8]] },
      { id: 'b', style: 'steel', points: [[40, -8], [40, 2.6], [50.5, 2.6], [52, 3.6], [52, -8]] },
      { id: 'c', style: 'concrete', points: [[74, -8], [74, 0], [110, 0], [110, WALL]] },
    ],
    killRegions: [pit(18.1, 39.9), pit(52.1, 73.9)],
    prefabs: [
      { type: 'lift', id: 'fork1', ax: 22, ay: 0, bx: 36, by: 2.6, w: 8, speed: 3.4, waitA: 2, waitB: 2, mode: 'cycle', style: 'fork' },
      { type: 'lift', id: 'fork2', ax: 56, ay: 2.6, bx: 70, by: 0, w: 8, speed: 3.4, waitA: 2, waitB: 2, phase: 4.2, mode: 'cycle', style: 'fork' },
    ],
    tag: { x: 55.6, y: 5.5 },
    decor: [
      { kind: 'danger', x: 16, y: 0, layer: 'back' }, { kind: 'stencil', x: 46, y: 6.5, text: 'BAY 3', layer: 'back' },
      { kind: 'crate', x: 82, y: 0, layer: 'back' }, { kind: 'terminal', x: 106, y: 0 },
    ],
    hints: [{ x0: 10, x1: 20, keyboard: 'Ride on when the fork is level with the floor', touch: 'Ride on when the fork is level with the floor' }],
    cameraZones: [{ x0: 16, x1: 42, zoom: 3 }, { x0: 50, x1: 76, zoom: 3 }],
    medals: { gold: 30.5, silver: 39.5, bronze: 58.5 },
    expectedSeconds: [25, 60],
  }),

  level({
    levelId: 'lz-11', districtId: D, order: 11, title: 'Return to Sender',
    brief: 'Break the brace. The crate does the rest.',
    routeChanging: true,
    bounds: { x0: -8, x1: 104, y0: -8, y1: 28 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 88, y: -1, h: 12 },
    terrain: [
      { id: 'a', style: 'concrete', points: [[-6, WALL], [-6, 0], [46, 0], [46, -8]] },
      { id: 'b', style: 'asphalt', points: [[63.5, -8], [63.5, 0], [98, 0], [98, WALL]] },
    ],
    solids: [{ id: 'gantry', style: 'steel', x: 31.9, y: 9.5, w: 0.5, h: 10 }],
    killRegions: [pit(46.1, 63.4)],
    prefabs: [
      { type: 'brace', id: 'brace', x: 18, y: 0.65, w: 0.45, h: 1.3, minSpeed: 5, targets: ['crate'] },
      { type: 'cargo', id: 'crate', w: 2.4, h: 1.6, path: [[34, 13, 0], [34, 5.7, 0]], duration: 1.05, targets: ['plate'] },
      { type: 'counterweight', id: 'plate', x: 34, y: 4.9, w: 3.4, travel: 0.6, down: 0.95, up: 0, hold: 0, ramp: { x: 46, y: -0.02, len: 7, a0: -0.03, a1: 0.42 } },
    ],
    tag: { x: 60, y: 6.1 },
    decor: [
      { kind: 'arrow', x: 11, y: 0, layer: 'back' }, { kind: 'stencil', x: 34, y: 2.6, text: 'MARKED PLATE', layer: 'back' },
      { kind: 'danger', x: 44, y: 0, layer: 'back' }, { kind: 'crate', x: 72, y: 0, layer: 'back' }, { kind: 'terminal', x: 94, y: 0 },
    ],
    hints: [{ x0: 8, x1: 19, keyboard: 'Hit the brace at speed', touch: 'Hit the brace at speed' }],
    cameraZones: [{ x0: 14, x1: 40, zoom: 4, y: 5.5 }, { x0: 40, x1: 66, zoom: 3 }],
    medals: { gold: 7, silver: 9, bronze: 13 },
    expectedSeconds: [20, 40],
  }),

  level({
    levelId: 'lz-12', districtId: D, order: 12, title: 'Compaction',
    brief: 'The press runs on a schedule. Keep to it.',
    routeChanging: true,
    bounds: { x0: -8, x1: 112, y0: -8, y1: 26 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 94, y: -1, h: 12 },
    terrain: [
      { id: 'a', style: 'concrete', points: [[-6, WALL], [-6, 0], [40, 0], [40, -8]] },
      { id: 'b', style: 'asphalt', points: [[50, -8], [50, 0], [56, 0], [60, 1.4], [60.4, 1.4], [60.9, 0], [106, 0], [106, WALL]] },
    ],
    killRegions: [pit(40.1, 49.9)],
    prefabs: [
      { type: 'compactor', id: 'press', x: 20, w: 5.4, top: 5.5, floor: 0, rest: 2.4, warn: 1.2, slam: 0.28, hold: 0.7, rise: 1.4, phase: 1.2 },
      { type: 'latch', id: 'latch', x: 32, y: 1.05, targets: ['bridge'] },
      { type: 'bridge', id: 'bridge', x: 50, y: 0, len: -10, upAngle: -1.2, downAngle: 0, fall: 9 },
      { type: 'compactor', id: 'press2', x: 68, w: 5, top: 6.6, floor: 0, rest: 2, warn: 1, slam: 0.3, hold: 0.7, rise: 1.4, phase: 1 },
    ],
    tag: { x: 65.6, y: 2.9 },
    decor: [
      { kind: 'danger', x: 14, y: 0, layer: 'back' }, { kind: 'stencil', x: 30, y: 4.5, text: 'KEEP MOVING', layer: 'back' },
      { kind: 'danger', x: 38, y: 0, layer: 'back' }, { kind: 'terminal', x: 100, y: 0 },
    ],
    hints: [{ x0: 8, x1: 18, keyboard: 'Red lamp: it is coming down. Go when it lifts.', touch: 'Red lamp: it is coming down. Go when it lifts.' }],
    cameraZones: [{ x0: 12, x1: 30, zoom: 2 }],
    medals: { gold: 14.5, silver: 18.5, bronze: 27.5 },
    expectedSeconds: [20, 45],
  }),

  level({
    levelId: 'lz-13', districtId: D, order: 13, title: 'Heavy Freight',
    brief: 'Your weight tips the container. Mind what is under it.',
    routeChanging: true,
    bounds: { x0: -8, x1: 120, y0: -8, y1: 30 },
    spawn: { x: 2, y: 3.8 },
    finish: { x: 100, y: -1, h: 14 },
    terrain: [
      { id: 'shelf', style: 'steel', points: [[-6, WALL + 3], [-6, 3], [21.6, 3], [21.6, -2]] },
      { id: 'floor', style: 'concrete', points: [[21.6, 0.01], [22, 0], [24, 0], [24, -0.8], [72, -0.8], [72, 0], [112, 0], [112, WALL]] },
    ],
    prefabs: [
      { type: 'tilt', id: 'box', x: 32, y: 4.42, left: 10, right: 10, minA: -0.36, maxA: 0.15, initial: 0.15, rate: 0.85, style: 'container' },
      { type: 'conveyor', id: 'belt', x: 48, y: 0, w: 48, speed: -3 },
      { type: 'cutter', id: 'saw', x: 26, y: 0.75, r: 1.1 },
    ],
    tag: { x: 47.5, y: 4.7 },
    decor: [
      { kind: 'danger', x: 20, y: 3, layer: 'back' }, { kind: 'stencil', x: 58, y: 3, text: 'FREIGHT', layer: 'back' },
      { kind: 'crate', x: 80, y: 0, layer: 'back' }, { kind: 'terminal', x: 108, y: 0 },
    ],
    hints: [{ x0: 12, x1: 34, keyboard: 'It tips once you pass the middle. The belt below runs the wrong way.', touch: 'It tips once you pass the middle. The belt below runs the wrong way.' }],
    cameraZones: [{ x0: 14, x1: 60, zoom: 3.5 }],
    medals: { gold: 7, silver: 9, bronze: 13.5 },
    expectedSeconds: [20, 45],
  }),

  level({
    levelId: 'lz-14', districtId: D, order: 14, title: 'Night Shift',
    brief: 'Belt, cargo, forks. The whole department.',
    routeChanging: true,
    bounds: { x0: -8, x1: 142, y0: -8, y1: 30 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 126, y: -1, h: 12 },
    terrain: [
      { id: 'a', style: 'concrete', points: [[-6, WALL], [-6, 0], [8, 0], [8, -0.8], [30, -0.8], [30, 0], [41, 0], [41, -8]] },
      { id: 'b', style: 'steel', points: [[53, -8], [53, 0], [62, 0], [66, 1.5], [66, -8]] },
      { id: 'c', style: 'asphalt', points: [[94, -8], [94, 0], [136, 0], [136, WALL]] },
    ],
    killRegions: [pit(41.1, 52.9), pit(66.1, 93.9)],
    prefabs: [
      { type: 'conveyor', id: 'belt', x: 19, y: 0, w: 22, speed: 4 },
      { type: 'latch', id: 'latch', x: 36, y: 1.05, targets: ['load'] },
      { type: 'cargo', id: 'load', w: 12.2, h: 1.4, path: [[47, 14, 0.25], [47, -0.7, 0]], duration: 0.9 },
      { type: 'lift', id: 'fork', ax: 71, ay: 0, bx: 89, by: 0, w: 9, speed: 4.2, waitA: 2, waitB: 1.4, mode: 'cycle', style: 'fork' },
    ],
    checkpoint: { x: 57, y: 0, h: 5, spawn: { x: 55.5, y: 0.8 }, restore: { latch: { released: true }, load: { released: true }, fork: { phase: 0 } } },
    tag: { x: 70, y: 3.1 },
    decor: [
      { kind: 'stencil', x: 19, y: 3, text: 'NIGHT SHIFT', layer: 'back' }, { kind: 'danger', x: 39, y: 0, layer: 'back' },
      { kind: 'crate', x: 100, y: 0, layer: 'back' }, { kind: 'drum', x: 110, y: 0, layer: 'back' }, { kind: 'terminal', x: 132, y: 0 },
    ],
    cameraZones: [{ x0: 38, x1: 56, zoom: 3.5, y: 4 }, { x0: 60, x1: 96, zoom: 3.5 }],
    medals: { gold: 24.5, silver: 32, bronze: 47.5 },
    expectedSeconds: [30, 70],
  }),
];
