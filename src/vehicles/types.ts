import type { World } from 'planck';
import type { VehicleCommand } from '../input/actions';
import type { FixtureTag, RiderPartId } from '../sim/filters';

export interface Pose {
  x: number;
  y: number;
  angle: number;
}

export interface BodyPose {
  id: string;
  x: number;
  y: number;
  angle: number;
}

/**
 * Everything specific to one vehicle. Levels, records and damage events refer to
 * a vehicle only by id, so adding a class of vehicle starts here.
 */
export interface VehicleDefinition<P = unknown, R = unknown> {
  id: string;
  /** Which normalized actions this vehicle responds to. */
  actions: ReadonlyArray<'throttle' | 'brake' | 'leanBack' | 'leanForward'>;
  physics: P;
  rider: R;
  visual: string;
  damage: { lethalRegions: ReadonlyArray<'head' | 'torso'> };
  camera: { viewHeightScale: number };
  /** Size the vehicle needs. Levels declare what they were built around. */
  clearance: { height: number; length: number };
}

export interface VehicleTelemetry {
  x: number;
  y: number;
  angle: number;
  vx: number;
  vy: number;
  speed: number;
  angularVelocity: number;
  /** Wheels currently touching something. */
  grounded: number;
  throttle: number;
  brake: number;
  slip: number;
  wheelSpeed: number;
  suspension: number[];
}

/** The contract the simulation holds a vehicle to. */
export interface VehicleController {
  readonly def: VehicleDefinition;
  spawn(world: World, pose: Pose): void;
  fixedUpdate(dt: number, cmd: VehicleCommand): void;
  /** Called from contact handling as this vehicle's fixtures touch or leave a surface. */
  contactChanged(tag: FixtureTag, delta: 1 | -1): void;
  /** Called after world.step, once contacts are settled. */
  telemetry(): VehicleTelemetry;
  /** Poses of the parts a ghost needs. */
  ghostPose(out: BodyPose[]): void;
  isAlive(): boolean;
  /** Detaches a limb. Returns false if it is already gone. */
  sever(part: RiderPartId): boolean;
  decapitate(): boolean;
  /** Latches death and releases the rider from the machine. */
  kill(): void;
  /** Puts ragdolls and debris to sleep at the end of the aftermath. */
  settle(): void;
  dispose(): void;
}
