import type { BodyRegion, RiderPartId } from './filters';
import type { DamageOutcome } from './damage';

export type DeathCause = 'head' | 'torso' | 'cutter' | 'crush' | 'pit' | 'bounds' | 'blast' | 'spikes';

/** How the employee reached the finish line. */
export type Arrival = 'riding' | 'loose' | 'dead';

export type SimEvent =
  | { t: 'start' }
  | { t: 'impact'; part: RiderPartId; region: BodyRegion; speed: number; x: number; y: number; nx: number; ny: number; outcome: DamageOutcome; live: boolean }
  | { t: 'sever'; part: RiderPartId; x: number; y: number; vx: number; vy: number }
  | { t: 'decapitate'; x: number; y: number; vx: number; vy: number }
  | { t: 'death'; cause: DeathCause; x: number; y: number }
  /** The rider left the bike alive: on purpose, or because something insisted. */
  | { t: 'eject'; x: number; y: number; chosen: boolean }
  | { t: 'flop'; x: number; y: number }
  /** Nothing more can happen on this attempt. */
  | { t: 'over' }
  | { t: 'bike'; speed: number; x: number; y: number; what: 'wheel' | 'chassis' }
  | { t: 'sparks'; x: number; y: number }
  | { t: 'mech'; id: string; what: 'clunk' | 'release' | 'break' | 'slam' | 'warn' | 'shutter' | 'arrive'; x: number; y: number }
  | { t: 'prop'; kind: string; what: 'hit' | 'burst'; speed: number; x: number; y: number; vx: number; vy: number }
  | { t: 'npc'; what: 'hit' | 'head'; x: number; y: number; vx: number; vy: number }
  | { t: 'explosion'; x: number; y: number; r: number }
  | { t: 'boing'; x: number; y: number }
  | { t: 'impale'; x: number; y: number }
  | { t: 'tag'; x: number; y: number }
  | { t: 'checkpoint'; x: number; y: number }
  | { t: 'finish'; arrival: Arrival };
