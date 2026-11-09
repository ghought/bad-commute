import { SCHEMA_VERSION, type DistrictId, type LevelData } from './schema';

type Required = Pick<LevelData, 'levelId' | 'districtId' | 'order' | 'title' | 'brief' | 'bounds' | 'spawn' | 'finish' | 'terrain' | 'tag' | 'medals' | 'expectedSeconds' | 'routeChanging'>;

/** Fills in the fields every level shares. The result is still plain data. */
export function level(data: Required & Partial<LevelData>): LevelData {
  return {
    schemaVersion: SCHEMA_VERSION,
    levelVersion: 1,
    allowedVehicles: ['motorbike'],
    clearance: { height: 2.2, length: 2 },
    killRegions: [],
    solids: [],
    decor: [],
    prefabs: [],
    cameraZones: [],
    hints: [],
    ...data,
  };
}

export const pit = (x0: number, x1: number) => ({ x0, x1, y0: -30, y1: -3, style: 'pit' as const });

export type { DistrictId };
