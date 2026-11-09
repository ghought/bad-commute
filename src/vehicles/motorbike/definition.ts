import { deg } from '../../core/math';
import type { VehicleDefinition } from '../types';

export interface MotorbikePhysics {
  chassisMass: number;
  chassisOutline: ReadonlyArray<readonly [number, number]>;
  wheel: {
    radius: number;
    mass: number;
    friction: number;
    restitution: number;
  };
  rearAxle: readonly [number, number];
  frontAxle: readonly [number, number];
  rearAxis: readonly [number, number];
  frontAxis: readonly [number, number];
  suspension: {
    rearHz: number;
    frontHz: number;
    damping: number;
    /** Travel limits in metres. Compression is positive. */
    maxCompress: number;
    maxDroop: number;
  };
  engine: {
    /** Rear wheel torque at low speed. */
    peakTorque: number;
    topSpeed: number;
    /** Share of peak torque still available at top speed. */
    torqueFloor: number;
    /** Light drag when coasting, so belts carry the bike and it does not roll forever. */
    coastDrag: number;
  };
  brake: {
    /** Split front and rear, so a full stop slows the bike without tipping it over. */
    rearTorque: number;
    frontTorque: number;
    /** Seconds near rest with brake held before reverse engages. */
    reverseDelay: number;
    reverseNearRest: number;
    reverseSpeed: number;
    reverseTorque: number;
  };
  lean: {
    /** Pitch torque by situation, in N·m. */
    groundTorque: number;
    wheelieTorque: number;
    airTorque: number;
    /** Lean stops adding spin past this rate, in rad/s. */
    maxPitchRate: number;
    /** Tighter limit while balancing on one wheel, so wheelies stay controllable. */
    wheelieRate: number;
    /** Seconds for the rider's pose to travel the full lean. */
    poseTransition: number;
  };
}

export interface MotorbikeRider {
  hip: readonly [number, number];
  grip: readonly [number, number];
  peg: readonly [number, number];
  torsoLength: number;
  torsoHalfWidth: number;
  torsoRest: number;
  leanForward: number;
  leanBack: number;
  hipMotorTorque: number;
  hipMotorGain: number;
  /** Fastest the torso moves relative to the bike, in rad/s. */
  hipMotorMaxRate: number;
  headRadius: number;
  headOffset: number;
  armUpper: number;
  armLower: number;
  legUpper: number;
  legLower: number;
  masses: {
    torso: number;
    head: number;
    armUpper: number;
    armLower: number;
    legUpper: number;
    legLower: number;
  };
}

export const MOTORBIKE: VehicleDefinition<MotorbikePhysics, MotorbikeRider> = {
  id: 'motorbike',
  actions: ['throttle', 'brake', 'leanBack', 'leanForward'],
  visual: 'motorbike',
  damage: { lethalRegions: ['head', 'torso'] },
  camera: { viewHeightScale: 1 },
  clearance: { height: 2.2, length: 2 },
  physics: {
    chassisMass: 55,
    chassisOutline: [
      [-0.55, -0.02],
      [-0.3, -0.16],
      [0.3, -0.16],
      [0.55, 0.0],
      [0.45, 0.22],
      [-0.45, 0.18],
    ],
    wheel: { radius: 0.31, mass: 7, friction: 1.5, restitution: 0.04 },
    rearAxle: [-0.62, -0.3],
    frontAxle: [0.64, -0.3],
    rearAxis: [0, 1],
    frontAxis: [-0.08, 1],
    suspension: { rearHz: 6.2, frontHz: 6.8, damping: 2.1, maxCompress: 0.2, maxDroop: 0.12 },
    engine: { peakTorque: 262, topSpeed: 22, torqueFloor: 0.22, coastDrag: 16 },
    brake: { rearTorque: 210, frontTorque: 105, reverseDelay: 0.25, reverseNearRest: 0.7, reverseSpeed: 3.6, reverseTorque: 150 },
    lean: {
      groundTorque: 380,
      wheelieTorque: 440,
      airTorque: 105,
      maxPitchRate: 3.4,
      wheelieRate: 1.15,
      poseTransition: 0.14,
    },
  },
  rider: {
    hip: [-0.22, 0.3],
    grip: [0.42, 0.5],
    peg: [-0.02, -0.12],
    torsoLength: 0.58,
    torsoHalfWidth: 0.15,
    torsoRest: deg(-12),
    leanForward: deg(24),
    leanBack: deg(17),
    hipMotorTorque: 900,
    hipMotorGain: 16,
    hipMotorMaxRate: 4.5,
    headRadius: 0.17,
    headOffset: 0.2,
    armUpper: 0.39,
    armLower: 0.41,
    legUpper: 0.38,
    legLower: 0.38,
    masses: { torso: 22, head: 4, armUpper: 1.2, armLower: 1, legUpper: 2.2, legLower: 1.4 },
  },
};
