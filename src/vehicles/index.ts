import { MotorbikeController } from './motorbike/controller';
import { MOTORBIKE } from './motorbike/definition';
import type { VehicleController } from './types';

/** The one place that maps a vehicle id to its implementation. */
export function createVehicle(id: string): VehicleController {
  if (id === MOTORBIKE.id) return new MotorbikeController(MOTORBIKE);
  throw new Error(`Unknown vehicle "${id}"`);
}

export const KNOWN_VEHICLES = [MOTORBIKE.id];
export const DEFAULT_VEHICLE = MOTORBIKE.id;
