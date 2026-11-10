/**
 * Every global tuning value lives here or in a VehicleDefinition. Bump
 * PHYSICS_VERSION whenever a change alters how a run plays out: saved times and
 * ghosts from older versions retire from comparison, but completion is kept.
 */
export const PHYSICS_VERSION = 2;

export const SIM = {
  hz: 60,
  dt: 1 / 60,
  velocityIterations: 10,
  positionIterations: 4,
  gravity: 16,
  /** Most fixed steps one rendered frame may run before time is dropped. */
  maxCatchUpSteps: 4,
  /** Frames in a row at the catch-up limit before the game pauses itself. */
  overloadFrames: 90,
  /** Steps the bike settles for at spawn, with machinery frozen. */
  settleSteps: 45,
} as const;

/** Contact-speed thresholds in m/s, by body region. */
export const DAMAGE = {
  head: { knock: 5.2, lethal: 7.4, decapitate: 11 },
  torso: { knock: 6.4, lethal: 9.4 },
  limb: { bruise: 3.2, sever: 10.5 },
  /** A dead body with nowhere to go ends the attempt after this long at rest. */
  restSeconds: 1.5,
  restSpeed: 0.7,
  /** Longest a body is watched after death before the paperwork starts. */
  deadSeconds: 7,
  /** A living rider lying still off the bike, with no input, has given up after this long. */
  idleSeconds: 5,
  /** One body part cannot be hurt twice within this many seconds. */
  contactCooldown: 0.18,
  /** Seconds of aftermath that stay simulated before ragdolls are put to sleep. */
  aftermathSeconds: 4,
  /** Below this chassis speed, an upturned bike shows the restart hint. */
  stuckSpeed: 0.4,
  stuckSeconds: 2.5,
} as const;

export const BUDGET = {
  dynamicBodies: 140,
  goreBodies: 24,
  particles: { high: 520, low: 160 },
  decals: { high: 140, low: 40 },
} as const;

export const CAMERA = {
  viewHeight: 10.4,
  /** Extra metres of view height at top speed. */
  speedZoom: 2.2,
  lookAheadPerSpeed: 0.34,
  lookAheadMax: 5.5,
  followRate: 7,
  verticalRate: 3.2,
  verticalDeadZone: 0.9,
  zoomRate: 1.4,
  /** Fraction of the view width the rider sits at when travelling forward. */
  riderAnchor: 1 / 3,
} as const;

export const GHOST = {
  sampleHz: 20,
  maxSeconds: 150,
} as const;
