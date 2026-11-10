import { level, pit } from '../authoring';
import { npc, props, stack } from '../dressing';
import type { LevelData } from '../schema';

const D = 'overtime' as const;
const WALL = 14;

/**
 * The after-hours courses. Each is built around the things the day shift does
 * not have: springs, fans, wrecking balls, explosives and the ejector seat.
 */
export const OVERTIME: LevelData[] = [
  level({
    levelId: 'ot-21', districtId: D, order: 21, title: 'Team Building',
    brief: 'Punch pads throw you. The furniture is not load-bearing.',
    routeChanging: false,
    bounds: { x0: -8, x1: 104, y0: -10, y1: 30 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 86, y: 3.4, h: 14 },
    terrain: [
      { id: 'lobby', style: 'concrete', points: [[-6, WALL], [-6, 0], [20, 0], [20, -9]] },
      { id: 'floor', style: 'concrete', points: [[27, -9], [27, 0], [56, 0], [56, 4.2], [98, 4.2], [98, WALL + 4]] },
    ],
    killRegions: [pit(20.2, 26.8)],
    prefabs: [
      ...stack('box', 7.5, 0, 2, 2),
      { type: 'spring', id: 'pad1', x: 17.2, y: 0, w: 2.8, power: 8.6 },
      { type: 'spring', id: 'pad2', x: 48.6, y: 0, w: 3, power: 12.6 },
      ...props('chair', [[32, 0], [41.5, 0]]),
      ...props('cooler', [[34, 0]]),
      ...stack('box', 36, 0, 2, 2),
      npc(39.5, 0, 'intern'),
      npc(44, 0, 'manager'),
      ...props('ball', [[62, 4.2]]),
      ...stack('box', 66, 4.2, 3, 3),
      npc(71, 4.2, 'inspector'),
      ...props('cart', [[75, 4.2]]),
      npc(89.5, 4.2, 'manager'),
      ...stack('box', 91.5, 4.2, 3, 3, 1),
      ...props('cooler', [[94.6, 4.2]]),
    ],
    tag: { x: 24.5, y: 3.3 },
    decor: [
      { kind: 'sign', x: 12, y: 0, text: 'TRUST FALL', layer: 'back' },
      { kind: 'danger', x: 46, y: 0, layer: 'back' },
      { kind: 'terminal', x: 96.5, y: 4.2 },
    ],
    hints: [
      { x0: -6, x1: 14, keyboard: 'Yellow pads throw you. Hit them with some speed.', touch: 'Yellow pads throw you. Hit them with some speed.' },
      { x0: 40, x1: 47, keyboard: 'The next pad clears the wall. Keep the throttle on.', touch: 'The next pad clears the wall. Keep GO held.' },
    ],
    medals: { gold: 9, silver: 12, bronze: 18 },
    expectedSeconds: [12, 30],
  }),

  level({
    levelId: 'ot-22', districtId: D, order: 22, title: 'Air Conditioning',
    brief: 'The fan carries you over. The wrecking balls do not.',
    routeChanging: false,
    bounds: { x0: -8, x1: 108, y0: -10, y1: 30 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 92, y: -1, h: 14 },
    terrain: [
      { id: 'near', style: 'roof', points: [[-6, WALL], [-6, 0], [18, 0], [18, -9]] },
      { id: 'far', style: 'roof', points: [[34, -9], [34, 0], [102, 0], [102, WALL]] },
    ],
    killRegions: [pit(18.2, 33.8)],
    prefabs: [
      { type: 'fan', id: 'fan', x: 26, y: -2.4, w: 15.6, h: 7, accel: 23 },
      { type: 'wrecker', id: 'ball1', x: 50, y: 6.4, rod: 5.2, r: 0.95, amplitude: 1.3, period: 5.2 },
      { type: 'wrecker', id: 'ball2', x: 66, y: 6.4, rod: 5.2, r: 0.95, amplitude: 1.3, period: 5.2, phase: 1.7 },
      npc(38, 0, 'inspector'),
      ...stack('box', 76, 0, 2, 3),
      ...props('barrel', [[80, 0]]),
      npc(82.5, 0, 'intern'),
      ...props('bin', [[85, 0]]),
      npc(95.2, 0, 'manager'),
      ...stack('box', 97, 0, 3, 3, 1),
    ],
    tag: { x: 29.5, y: 3.0 },
    decor: [
      { kind: 'sign', x: 12, y: 0, text: 'MIND THE DRAUGHT', layer: 'back' },
      { kind: 'danger', x: 44, y: 0, layer: 'back' },
      { kind: 'lamp', x: 84, y: 0 },
      { kind: 'terminal', x: 100.5, y: 0 },
    ],
    hints: [
      { x0: 6, x1: 17, keyboard: 'Ride into the draught. Lean to stay level.', touch: 'Ride into the draught. Lean to stay level.' },
      { x0: 36, x1: 46, keyboard: 'Wait for the ball to swing away, then go.', touch: 'Wait for the ball to swing away, then go.' },
    ],
    medals: { gold: 16.5, silver: 22, bronze: 33 },
    expectedSeconds: [14, 35],
  }),

  level({
    levelId: 'ot-23', districtId: D, order: 23, title: 'Fire Drill',
    brief: 'Do not touch the red ones. Or the flat ones. Or the pointy ones.',
    routeChanging: false,
    bounds: { x0: -8, x1: 112, y0: -10, y1: 30 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 94, y: -1, h: 14 },
    terrain: [
      { id: 'road', style: 'asphalt', points: [
        [-6, WALL], [-6, 0], [13, 0], [18, 1.35], [18.4, 1.35], [18.7, 0],
        [38, 0], [43, 1.5], [43.4, 1.5], [43.6, -1.1], [49.6, -1.1], [49.6, 0],
        [64, 0], [69, 1.4], [69.4, 1.4], [69.7, 0], [106, 0], [106, WALL],
      ] },
    ],
    prefabs: [
      { type: 'mine', id: 'mine1', x: 21.5, y: 0 },
      { type: 'mine', id: 'mine2', x: 24, y: 0 },
      { type: 'spikes', id: 'spikes', x: 46.6, y: -1.1, w: 5.6 },
      { type: 'mine', id: 'mine3', x: 72, y: 0 },
      { type: 'mine', id: 'mine4', x: 74, y: 0 },
      ...props('tnt', [[75.6, 0]]),
      npc(29.5, 0, 'inspector'),
      npc(32.5, 0, 'intern'),
      ...stack('box', 57, 0, 2, 2),
      npc(97, 0, 'manager'),
      ...props('tnt', [[99, 0], [99.7, 0], [100.4, 0]]),
      ...stack('box', 101.4, 0, 2, 3),
    ],
    tag: { x: 22.7, y: 2.9 },
    decor: [
      { kind: 'danger', x: 12, y: 0, layer: 'back' },
      { kind: 'sign', x: 34, y: 0, text: 'ASSEMBLY POINT', layer: 'back' },
      { kind: 'danger', x: 63, y: 0, layer: 'back' },
      { kind: 'terminal', x: 104.6, y: 0 },
    ],
    hints: [
      { x0: 2, x1: 13, keyboard: 'Take the ramps fast. What is under them is armed.', touch: 'Take the ramps fast. What is under them is armed.' },
    ],
    medals: { gold: 8, silver: 11, bronze: 17 },
    expectedSeconds: [10, 30],
  }),

  level({
    levelId: 'ot-24', districtId: D, order: 24, title: 'Exit Interview',
    brief: 'No bikes in the building. Eject, and crawl in to clock out.',
    routeChanging: false,
    onFoot: true,
    bounds: { x0: -8, x1: 108, y0: -10, y1: 30 },
    spawn: { x: 2, y: 0.8 },
    finish: { x: 86, y: -1, h: 3 },
    terrain: [
      { id: 'near', style: 'concrete', points: [[-6, WALL], [-6, 0], [16, 0], [16, -9]] },
      { id: 'far', style: 'concrete', points: [[28, -9], [28, 0], [102, 0], [102, WALL]] },
    ],
    solids: [
      // The building: a wall with a gap at the bottom that a bike will not fit under.
      { id: 'lintel', x: 83, y: 7.7, w: 22, h: 12.6, style: 'brick' },
    ],
    killRegions: [pit(16.2, 27.8)],
    prefabs: [
      { type: 'fan', id: 'fan', x: 22, y: -2.4, w: 11.6, h: 7, accel: 23 },
      { type: 'wrecker', id: 'ball', x: 42, y: 6.4, rod: 5.2, r: 0.95, amplitude: 1.3, period: 5.2, phase: 0.6 },
      { type: 'spring', id: 'pad', x: 52, y: 0, w: 2.8, power: 7.5 },
      { type: 'mine', id: 'mine', x: 56.4, y: 0 },
      ...stack('box', 62, 0, 2, 2),
      npc(64.5, 0, 'inspector'),
      npc(67.5, 0, 'intern'),
      ...props('chair', [[78, 0], [81, 0]]),
      ...props('bin', [[84, 0]]),
      npc(89, 0, 'manager'),
      ...props('cooler', [[91, 0]]),
    ],
    tag: { x: 57.5, y: 3.1 },
    decor: [
      { kind: 'sign', x: 68, y: 0, text: 'NO BIKES', layer: 'back' },
      { kind: 'danger', x: 49, y: 0, layer: 'back' },
      { kind: 'terminal', x: 96, y: 0 },
    ],
    hints: [
      { x0: 60, x1: 73, keyboard: 'Stop, then Space to eject. Throttle heaves you along on foot.', touch: 'Stop, then BAIL to eject. GO heaves you along on foot.' },
    ],
    medals: { gold: 19, silver: 26, bronze: 40 },
    expectedSeconds: [25, 60],
  }),
];
