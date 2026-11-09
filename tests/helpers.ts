import { level } from '../src/levels/authoring';
import type { LevelData } from '../src/levels/schema';
import { Simulation, type SimOptions } from '../src/sim/Simulation';
import { createVehicle } from '../src/vehicles';
import type { MotorbikeController } from '../src/vehicles/motorbike/controller';

export const flat = (over: Partial<LevelData> = {}): LevelData =>
  level({
    levelId: 'test',
    districtId: 'road-closed',
    order: 1,
    title: 'Test',
    brief: '',
    routeChanging: false,
    bounds: { x0: -60, x1: 800, y0: -40, y1: 200 },
    spawn: { x: 0, y: 0.8 },
    finish: { x: 700, y: -5, h: 80 },
    terrain: [{ id: 'g', style: 'asphalt', points: [[-50, 0], [790, 0]] }],
    tag: { x: 650, y: 30 },
    medals: { gold: 10, silver: 20, bronze: 30 },
    expectedSeconds: [1, 2],
    ...over,
  });

export const makeSim = (l: LevelData, options?: SimOptions) => new Simulation(l, createVehicle('motorbike'), options);
export const bike = (s: Simulation) => s.vehicle as MotorbikeController;
export const GO = { throttle: 1, brake: 0, lean: 0 };
export const IDLE = { throttle: 0, brake: 0, lean: 0 };

export function run(s: Simulation, frames: number, cmd = GO) {
  for (let i = 0; i < frames; i++) s.step(cmd);
}

/** Rides until the condition holds, or fails the frame budget. */
export function until(s: Simulation, done: () => boolean, cmd = GO, max = 3000) {
  let n = 0;
  while (!done() && n < max) {
    s.step(cmd);
    n++;
  }
  return n < max;
}
