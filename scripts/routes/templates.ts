import type { RouteStep } from '../../src/sim/autopilot';

export interface RouteSet {
  main: RouteStep[];
  tag: RouteStep[];
  /** Riding from the checkpoint, on levels that have one. */
  checkpoint?: RouteStep[];
}

const G = 22;

/** Hand-written starting points. The solver tunes the speeds from here. */
export const TEMPLATES: Record<string, RouteSet> = {
  'rc-01': { main: [{ x: 100, v: 10 }], tag: [{ x: 100, v: G }] },
  'rc-02': {
    main: [{ x: 17, v: 8 }, { x: 22, v: 8, lean: 1 }, { x: 35, v: 8 }, { x: 40, v: 8, lean: 1 }, { x: 51, v: 8 }, { x: 56, v: 8, lean: 1 }, { x: 100, v: 9 }],
    tag: [{ x: 17, v: 8 }, { x: 22, v: 8, lean: 1 }, { x: 35, v: 8 }, { x: 40, v: 8, lean: 1 }, { x: 51, v: 8 }, { x: 56, v: 8, lean: 1 }, { x: 100, v: G, air: -0.1 }],
  },
  'rc-03': {
    main: [{ x: 23, v: 5, hold: { id: 'cw', gte: 0.97 } }, { x: 100, v: G, air: -0.1 }],
    tag: [{ x: 21, v: 5, hold: { id: 'cw', gte: 0.97 } }, { x: 100, v: G, air: 0.1 }],
  },
  'rc-04': { main: [{ x: 100, v: 9 }], tag: [{ x: 100, v: G, air: 0 }] },
  'rc-05': {
    main: [
      { x: 17.5, v: 6, hold: { id: 'ferry', lte: 0.01, after: 0.1 } },
      { x: 24, v: 4, hold: { id: 'ferry', gte: 0.99 } },
      { x: 100, v: 10 },
    ],
    tag: [
      { x: 17.5, v: 6, hold: { id: 'ferry', lte: 0.01, after: 0.1 } },
      { x: 24, v: 4, hold: { id: 'ferry', gte: 0.99 } },
      { x: 52, v: 8, hold: { id: 'hoist', lte: 0.01, after: 0.1 } },
      { x: 60, v: 4, hold: { id: 'hoist', gte: 0.99 } },
      { x: 100, v: 10 },
    ],
  },
  'rc-06': {
    main: [{ x: 23, v: 4 }, { x: 30, v: 3, hold: { id: 'girder', lte: -0.2 } }, { x: 100, v: 9 }],
    tag: [{ x: 100, v: G, air: 0 }],
  },
  'rc-07': {
    main: [
      { x: 11.5, v: 6, hold: { id: 'ferry', lte: 0.01, after: 0.1 } },
      { x: 18, v: 4, hold: { id: 'ferry', gte: 0.99 } },
      { x: 84, v: 9 },
      { x: 90, v: 5, hold: { id: 'cw', gte: 0.97 } },
      { x: 200, v: G, air: -0.1 },
    ],
    tag: [
      { x: 11.5, v: 6, hold: { id: 'ferry', lte: 0.01, after: 0.1 } },
      { x: 18, v: 4, hold: { id: 'ferry', gte: 0.99 } },
      { x: 84, v: 9 },
      { x: 88, v: 5, hold: { id: 'cw', gte: 0.97 } },
      { x: 200, v: G, air: 0.1 },
    ],
    checkpoint: [{ x: 90, v: 5, hold: { id: 'cw', gte: 0.97 } }, { x: 200, v: G, air: -0.1 }],
  },
  'lz-08': { main: [{ x: 100, v: 11 }], tag: [{ x: 42, v: 11 }, { x: 100, v: G, air: -0.1 }] },
  'lz-09': {
    main: [{ x: 13, v: 5, hold: { id: 'door', gte: 0.98, after: 0.2 } }, { x: 100, v: 12 }],
    tag: [
      { x: 13, v: 5, hold: { id: 'door', gte: 0.5 } },
      { x: 23.5, v: 6, hold: { id: 'hoist', lte: 0.01, after: 0.1 } },
      { x: 27.5, v: 3, hold: { id: 'hoist', gte: 0.99 } },
      { x: 100, v: 8 },
    ],
  },
  'lz-10': {
    main: [
      { x: 15.5, v: 6, hold: { id: 'fork1', lte: 0.01, after: 0.1 } },
      { x: 22, v: 4, hold: { id: 'fork1', gte: 0.99 } },
      { x: 44, v: 7, hold: { id: 'fork2', lte: 0.01 } },
      { x: 56, v: 8, hold: { id: 'fork2', gte: 0.99 } },
      { x: 200, v: 9 },
    ],
    tag: [
      { x: 15.5, v: 6, hold: { id: 'fork1', lte: 0.01, after: 0.1 } },
      { x: 22, v: 4, hold: { id: 'fork1', gte: 0.99 } },
      { x: 41.5, v: 7, hold: { id: 'fork2', lte: 0.01 } },
      { x: 52.5, v: 13, air: 0 },
      { x: 57, v: 3, hold: { id: 'fork2', gte: 0.99 } },
      { x: 200, v: 9 },
    ],
  },
  'lz-11': {
    main: [{ x: 16, v: 8 }, { x: 42, v: 8, hold: { id: 'plate', gte: 0.97 } }, { x: 100, v: G, air: -0.1 }],
    tag: [{ x: 16, v: 11 }, { x: 100, v: G, air: 0.15 }],
  },
  'lz-12': {
    main: [
      { x: 12, v: 6, hold: { id: 'press', lte: 0.01 } },
      { x: 14, v: 12 },
      { x: 58, v: 12 },
      { x: 62, v: 6, hold: { id: 'press2', lte: 0.01 } },
      { x: 200, v: 12 },
    ],
    tag: [
      { x: 12, v: 6, hold: { id: 'press', lte: 0.01 } },
      { x: 14, v: 12 },
      { x: 42, v: 8, hold: { id: 'press2', lte: 0.01 } },
      { x: 200, v: 16, air: 0 },
    ],
  },
  'lz-13': {
    main: [{ x: 31, v: 4 }, { x: 39, v: 3, hold: { id: 'box', lte: -0.3 } }, { x: 200, v: 10 }],
    tag: [{ x: 200, v: G, air: 0 }],
  },
  'lz-14': {
    main: [
      { x: 34, v: 9 },
      { x: 51, v: 7, hold: { id: 'load', gte: 1 } },
      { x: 62, v: 6, hold: { id: 'fork', lte: 0.01, after: 0.1 } },
      { x: 71, v: 5, hold: { id: 'fork', gte: 0.99 } },
      { x: 200, v: 10 },
    ],
    tag: [
      { x: 34, v: 9 },
      { x: 40.5, v: 4, hold: { id: 'load', gte: 1 } },
      { x: 53.6, v: 6, hold: { id: 'fork', lte: 0.01 } },
      { x: 67, v: 13, air: 0 },
      { x: 72, v: 3, hold: { id: 'fork', gte: 0.99 } },
      { x: 200, v: 10 },
    ],
    checkpoint: [
      { x: 58, v: 5, hold: { id: 'fork', lte: 0.01, after: 0.1 } },
      { x: 71, v: 5, hold: { id: 'fork', gte: 0.99 } },
      { x: 200, v: 10 },
    ],
  },
  'ra-15': {
    main: [{ x: 26, v: 4, hold: { id: 'cradle', gte: 0.995 } }, { x: 200, v: 10 }],
    tag: [
      { x: 26, v: 4, hold: { id: 'cradle', gte: 0.995 } },
      { x: 43, v: 6, hold: { id: 'hoist', lte: 0.01, after: 0.1 } },
      { x: 49, v: 3, hold: { id: 'hoist', gte: 0.99 } },
      { x: 200, v: 7 },
    ],
  },
  'ra-16': {
    main: [{ x: 8, v: 5 }, { x: 15, v: 3 }, { x: 100, v: 12, air: -0.05 }],
    tag: [{ x: 14, v: 18, air: 0 }, { x: 46, v: 9 }, { x: 100, v: 12 }],
  },
  'ra-17': {
    main: [
      { x: 17, v: 5, hold: { id: 'swing1', lte: -0.4 } },
      { x: 28, v: 4, hold: { id: 'swing1', gte: 0.25 } },
      { x: 41, v: 9 },
      { x: 56, v: 3 },
      { x: 200, v: 10 },
    ],
    tag: [
      { x: 17, v: 5, hold: { id: 'swing1', lte: -0.4 } },
      { x: 26, v: 4, hold: { id: 'swing1', gte: 0.36 } },
      { x: 41, v: 12, air: 0 },
      { x: 56, v: 3 },
      { x: 200, v: 10 },
    ],
  },
  'ra-18': {
    main: [{ x: 18, v: 5, hold: { id: 'cw', gte: 0.97 } }, { x: 200, v: G, air: -0.1 }],
    tag: [{ x: 16, v: 5, hold: { id: 'cw', gte: 0.97 } }, { x: 200, v: G, air: 0.15 }],
  },
  'ra-19': {
    main: [{ x: 16, v: 5, hold: { id: 'sign', gte: 1 } }, { x: 37, v: 8 }, { x: 43.5, v: 4, hold: { id: 'hoist', gte: 0.5 } }, { x: 43.5, v: 0, hold: { id: 'hoist', lte: 0.01 } }, { x: 49, v: 4, hold: { id: 'hoist', gte: 0.99 } }, { x: 200, v: 10 }],
    tag: [{ x: 22.5, v: 22, air: 0 }, { x: 29, v: 3, air: 0 }, { x: 41.8, v: 3, hold: { id: 'hoist', gte: 0.5 } }, { x: 41.8, v: 0, hold: { id: 'hoist', lte: 0.01 } }, { x: 47, v: 5, hold: { id: 'hoist', gte: 0.99 } }, { x: 200, v: 10 }],
  },
  'ra-20': {
    main: [
      { x: 15, v: 5, hold: { id: 'cw', gte: 0.97 } },
      { x: 40, v: G, air: -0.1 },
      { x: 92, v: 9, hold: { id: 'press', lte: 0.01 } },
      { x: 96, v: 12 },
      { x: 120, v: 12 },
      { x: 121, v: 5, hold: { id: 'ferry', lte: 0.01, after: 0.1 } },
      { x: 129, v: 4, hold: { id: 'ferry', gte: 0.99 } },
      { x: 300, v: 10 },
    ],
    tag: [
      { x: 15, v: 5, hold: { id: 'cw', gte: 0.97 } },
      { x: 40, v: G, air: -0.1 },
      { x: 92, v: 9, hold: { id: 'press', lte: 0.01 } },
      { x: 96, v: 14 },
      { x: 112, v: 8, hold: { id: 'ferry', lte: 0.01 } },
      { x: 126, v: 15, air: 0 },
      { x: 131, v: 3, hold: { id: 'ferry', gte: 0.99 } },
      { x: 300, v: 10 },
    ],
    checkpoint: [
      { x: 92, v: 9, hold: { id: 'press', lte: 0.01 } },
      { x: 96, v: 12 },
      { x: 120, v: 12 },
      { x: 121, v: 5, hold: { id: 'ferry', lte: 0.01, after: 0.1 } },
      { x: 129, v: 4, hold: { id: 'ferry', gte: 0.99 } },
      { x: 300, v: 10 },
    ],
  },
  'ot-21': { main: [{ x: 200, v: 11 }], tag: [{ x: 30, v: 12 }, { x: 200, v: 11 }] },
  'ot-22': {
    main: [
      { x: 41, v: 9 },
      { x: 44, v: 3, hold: { id: 'ball1', gte: 0.63, lte: 0.72 } },
      { x: 57, v: 16 },
      { x: 60, v: 3, hold: { id: 'ball2', gte: 0.63, lte: 0.72 } },
      { x: 200, v: 16 },
    ],
    tag: [
      { x: 38, v: 5 },
      { x: 44, v: 3, hold: { id: 'ball1', gte: 0.63, lte: 0.72 } },
      { x: 57, v: 16 },
      { x: 60, v: 3, hold: { id: 'ball2', gte: 0.63, lte: 0.72 } },
      { x: 200, v: 16 },
    ],
  },
  'ot-23': { main: [{ x: 200, v: 15 }], tag: [{ x: 200, v: G }] },
  'ot-24': {
    main: [
      { x: 33, v: 9 },
      { x: 36, v: 3, hold: { id: 'ball', gte: 0.63, lte: 0.72 } },
      { x: 60, v: 16 },
      { x: 68.6, v: 4 },
      { x: 200, v: 2, eject: true },
    ],
    tag: [
      { x: 33, v: 9 },
      { x: 36, v: 3, hold: { id: 'ball', gte: 0.63, lte: 0.72 } },
      { x: 60, v: 16 },
      { x: 68.6, v: 4 },
      { x: 200, v: 2, eject: true },
    ],
  },
};
