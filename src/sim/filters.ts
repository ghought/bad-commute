/** Collision categories. Gore touches scenery only, so it can never alter a course. */
export const CAT = {
  TERRAIN: 0x0001,
  MACHINE: 0x0002,
  BIKE: 0x0004,
  RIDER: 0x0008,
  GORE: 0x0010,
  TRIGGER: 0x0020,
  HAZARD: 0x0040,
  /** Loose objects and bystanders. They touch the world, the bike and the rider. */
  PROP: 0x0080,
  /** Tripwires for explosives. Anything solid sets them off. */
  FUSE: 0x0100,
} as const;

export const MASK = {
  TERRAIN: CAT.BIKE | CAT.RIDER | CAT.GORE | CAT.PROP,
  MACHINE: CAT.BIKE | CAT.RIDER | CAT.PROP,
  BIKE: CAT.TERRAIN | CAT.MACHINE | CAT.TRIGGER | CAT.HAZARD | CAT.PROP | CAT.FUSE,
  RIDER: CAT.TERRAIN | CAT.MACHINE | CAT.HAZARD | CAT.PROP | CAT.FUSE,
  GORE: CAT.TERRAIN,
  TRIGGER: CAT.BIKE,
  HAZARD: CAT.BIKE | CAT.RIDER,
  PROP: CAT.TERRAIN | CAT.MACHINE | CAT.BIKE | CAT.RIDER | CAT.PROP | CAT.FUSE,
  FUSE: CAT.BIKE | CAT.RIDER | CAT.PROP,
} as const;

export type BodyRegion = 'head' | 'torso' | 'limb';

export type RiderPartId =
  | 'torso'
  | 'head'
  | 'armUpperN'
  | 'armLowerN'
  | 'armUpperF'
  | 'armLowerF'
  | 'legUpperN'
  | 'legLowerN'
  | 'legUpperF'
  | 'legLowerF';

/** Stored on every fixture so contact handling never guesses what it touched. */
export type FixtureTag =
  | { k: 'terrain' }
  | { k: 'machine'; id: string; conveyor?: () => number; crush?: boolean; spring?: boolean }
  | { k: 'wheel'; index: number }
  | { k: 'chassis' }
  | { k: 'rider'; part: RiderPartId; region: BodyRegion }
  | { k: 'gore' }
  | { k: 'trigger'; id: string }
  | { k: 'hazard'; id: string; style: 'cutter' | 'spikes' }
  | { k: 'prop'; id: string; soft: number }
  | { k: 'fuse'; id: string };
