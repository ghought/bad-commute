import type { BodyRegion, RiderPartId } from './filters';
import type { DamageOutcome } from './damage';

export type DeathCause = 'head' | 'torso' | 'cutter' | 'crush' | 'pit' | 'bounds';

export type SimEvent =
  | { t: 'start' }
  | { t: 'impact'; part: RiderPartId; region: BodyRegion; speed: number; x: number; y: number; nx: number; ny: number; outcome: DamageOutcome; live: boolean }
  | { t: 'sever'; part: RiderPartId; x: number; y: number; vx: number; vy: number }
  | { t: 'decapitate'; x: number; y: number; vx: number; vy: number }
  | { t: 'death'; cause: DeathCause; x: number; y: number }
  | { t: 'bike'; speed: number; x: number; y: number; what: 'wheel' | 'chassis' }
  | { t: 'sparks'; x: number; y: number }
  | { t: 'mech'; id: string; what: 'clunk' | 'release' | 'break' | 'slam' | 'warn' | 'shutter' | 'arrive'; x: number; y: number }
  | { t: 'tag'; x: number; y: number }
  | { t: 'checkpoint'; x: number; y: number }
  | { t: 'finish' };
