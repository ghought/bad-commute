import type { DistrictId, LevelData } from './schema';
import { validateLevel } from './schema';
import { KNOWN_VEHICLES } from '../vehicles';
import { ROAD_CLOSED } from './data/roadClosed';
import { LOADING_ZONE } from './data/loadingZone';
import { ROOF_ACCESS } from './data/roofAccess';

export const LEVELS: LevelData[] = [...ROAD_CLOSED, ...LOADING_ZONE, ...ROOF_ACCESS].sort((a, b) => a.order - b.order);

export const DISTRICTS: Array<{ id: DistrictId; number: string; name: string; note: string }> = [
  { id: 'road-closed', number: '01', name: 'Road Closed', note: 'Roadworks. No one is working.' },
  { id: 'loading-zone', number: '02', name: 'Loading Zone', note: 'Everything here moves. Mostly downward.' },
  { id: 'roof-access', number: '03', name: 'Roof Access', note: 'Authorized personnel only. So, you.' },
];

export const levelById = (id: string) => LEVELS.find((l) => l.levelId === id) ?? null;
export const levelByOrder = (order: number) => LEVELS.find((l) => l.order === order) ?? null;

/** Every problem across the campaign. Empty means it is safe to ship. */
export function validateCampaign(levels: LevelData[] = LEVELS) {
  const errors = levels.flatMap((l) => validateLevel(l, KNOWN_VEHICLES));
  const orders = new Set<number>();
  const ids = new Set<string>();
  for (const l of levels) {
    if (orders.has(l.order)) errors.push(`${l.levelId}: duplicate order ${l.order}`);
    if (ids.has(l.levelId)) errors.push(`${l.levelId}: duplicate levelId`);
    orders.add(l.order);
    ids.add(l.levelId);
  }
  return errors;
}
