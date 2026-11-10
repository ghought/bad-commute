/**
 * The level format. A level is plain data: no functions, no references to the
 * simulation. `validateLevel` rejects anything malformed or unknown, so a typo
 * cannot quietly change how a course plays.
 */
export const SCHEMA_VERSION = 1;

export type Vec = readonly [number, number];
export type SurfaceStyle = 'asphalt' | 'concrete' | 'steel' | 'brick' | 'roof' | 'plank';

export interface TerrainData {
  id: string;
  points: Vec[];
  style: SurfaceStyle;
}

export interface SolidData {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
  style: SurfaceStyle;
}

export interface KillRegion {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  style: 'pit' | 'void';
}

export interface CounterweightData {
  type: 'counterweight';
  id: string;
  x: number;
  y: number;
  w: number;
  travel: number;
  ramp?: { x: number; y: number; len: number; a0: number; a1: number; style?: 'ramp' | 'bridge' };
  down?: number;
  up?: number;
  hold?: number;
  targets?: string[];
  threshold?: number;
}

export interface TiltData {
  type: 'tilt';
  id: string;
  x: number;
  y: number;
  left: number;
  right: number;
  minA: number;
  maxA: number;
  initial: number;
  rate: number;
  /** Radians per second back to `initial` when unloaded. 0 stays put. */
  returnRate?: number;
  style?: 'girder' | 'container';
}

export interface LatchData {
  type: 'latch';
  id: string;
  x: number;
  y: number;
  targets: string[];
}

export interface BraceData {
  type: 'brace';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  angle?: number;
  minSpeed: number;
  targets: string[];
}

export interface BridgeData {
  type: 'bridge';
  id: string;
  x: number;
  y: number;
  /** Signed length. Negative hinges at the right end. */
  len: number;
  upAngle: number;
  downAngle: number;
  fall?: number;
}

export interface ConveyorData {
  type: 'conveyor';
  id: string;
  x: number;
  y: number;
  w: number;
  speed: number;
  onActivate?: 'reverse' | 'stop';
}

export interface LiftData {
  type: 'lift';
  id: string;
  ax: number;
  ay: number;
  bx: number;
  by: number;
  w: number;
  speed: number;
  waitA?: number;
  waitB?: number;
  phase?: number;
  /** cycle runs from the clock; activated waits for a release, then runs once. */
  mode: 'cycle' | 'activated';
  style?: 'lift' | 'fork' | 'cradle';
  /** Set when the platform comes down onto a road: below this height it is lethal. */
  crushFloor?: number;
}

export interface SwingData {
  type: 'swing';
  id: string;
  x: number;
  y: number;
  rod: number;
  w: number;
  amplitude: number;
  period: number;
  phase?: number;
}

export interface ShutterData {
  type: 'shutter';
  id: string;
  x: number;
  floor: number;
  height: number;
  opening: number;
  openTime: number;
  holdTime: number;
  closeTime: number;
  mode: 'triggered' | 'cycle';
  phase?: number;
}

export interface CutterData {
  type: 'cutter';
  id: string;
  x: number;
  y: number;
  r: number;
  bx?: number;
  by?: number;
  period?: number;
  phase?: number;
}

export interface CompactorData {
  type: 'compactor';
  id: string;
  x: number;
  w: number;
  top: number;
  floor: number;
  rest: number;
  warn: number;
  slam: number;
  hold: number;
  rise: number;
  phase?: number;
}

export interface CargoData {
  type: 'cargo';
  id: string;
  w: number;
  h: number;
  path: Array<readonly [number, number, number]>;
  duration: number;
  targets?: string[];
  style?: 'crate' | 'sign' | 'piano' | 'safe';
}

export type PropKind = 'box' | 'crate' | 'cone' | 'barrel' | 'tnt' | 'cooler' | 'cart' | 'chair' | 'bin' | 'ball';

/** A loose object. It can be shoved, broken, or in one case set off. */
export interface PropData {
  type: 'prop';
  id: string;
  kind: PropKind;
  x: number;
  y: number;
  angle?: number;
}

/** Explodes when anything solid touches it. */
export interface MineData {
  type: 'mine';
  id: string;
  x: number;
  y: number;
  radius?: number;
}

/** A sprung pad that throws whatever lands on it along its normal. */
export interface SpringData {
  type: 'spring';
  id: string;
  x: number;
  y: number;
  w: number;
  /** Launch speed in m/s. */
  power: number;
  /** Tilt of the pad, radians. 0 throws straight up, negative throws forward. */
  angle?: number;
}

/** A column of moving air. `accel` is in m/s², against a gravity of 16. */
export interface FanData {
  type: 'fan';
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
  accel: number;
  /** Direction of the draught, radians from straight up. Positive leans it forward. */
  angle?: number;
}

/** A wrecking ball on a fixed swing. */
export interface WreckerData {
  type: 'wrecker';
  id: string;
  x: number;
  y: number;
  rod: number;
  r: number;
  amplitude: number;
  period: number;
  phase?: number;
}

/** A strip of spikes. Wheels sink into it; bodies stay on it. */
export interface SpikesData {
  type: 'spikes';
  id: string;
  x: number;
  y: number;
  w: number;
}

/** A safety inspector, standing where the hazard assessment told them to. */
export interface NpcData {
  type: 'npc';
  id: string;
  x: number;
  y: number;
  /** 1 faces right, -1 faces left. */
  facing?: number;
  look?: 'inspector' | 'manager' | 'intern';
}

export type PrefabData =
  | PropData
  | MineData
  | SpringData
  | FanData
  | WreckerData
  | SpikesData
  | NpcData
  | CounterweightData
  | TiltData
  | LatchData
  | BraceData
  | BridgeData
  | ConveyorData
  | LiftData
  | SwingData
  | ShutterData
  | CutterData
  | CompactorData
  | CargoData;

export interface DecorData {
  kind: string;
  x: number;
  y: number;
  scale?: number;
  text?: string;
  layer?: 'back' | 'front';
}

/** A mechanism's authored state at a checkpoint. */
export interface MechanismRestore {
  released?: boolean;
  phase?: number;
}

export interface CheckpointData {
  x: number;
  y: number;
  h: number;
  spawn: { x: number; y: number; angle?: number };
  restore: Record<string, MechanismRestore>;
}

export interface CameraZone {
  x0: number;
  x1: number;
  /** Fixes the vertical centre of the view. */
  y?: number;
  /** Adds metres of view height. */
  zoom?: number;
  /** Extra forward look, in metres. */
  look?: number;
}

export interface HintData {
  x0: number;
  x1: number;
  keyboard: string;
  touch: string;
}

export interface LevelData {
  schemaVersion: number;
  levelId: string;
  levelVersion: number;
  districtId: DistrictId;
  order: number;
  title: string;
  brief: string;
  bounds: { x0: number; x1: number; y0: number; y1: number };
  spawn: { x: number; y: number; angle?: number };
  allowedVehicles: string[];
  clearance: { height: number; length: number };
  finish: { x: number; y: number; h: number };
  killRegions: KillRegion[];
  terrain: TerrainData[];
  solids: SolidData[];
  decor: DecorData[];
  prefabs: PrefabData[];
  tag: { x: number; y: number };
  checkpoint?: CheckpointData;
  cameraZones: CameraZone[];
  hints: HintData[];
  medals: { gold: number; silver: number; bronze: number };
  expectedSeconds: readonly [number, number];
  /** True when the course can only be finished off the bike. The verifier allows for it. */
  onFoot?: boolean;
  /** True when the course needs a route-changing mechanism, or rewards one. */
  routeChanging: boolean;
  background?: string;
}

export type DistrictId = 'road-closed' | 'loading-zone' | 'roof-access' | 'overtime';

const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string' && v.length > 0;

type FieldSpec = Record<string, 'num' | 'str' | 'strs' | 'obj' | 'path' | 'num?' | 'str?' | 'strs?' | 'obj?'>;

const PREFAB_FIELDS: Record<PrefabData['type'], FieldSpec> = {
  prop: { kind: 'str', x: 'num', y: 'num', angle: 'num?' },
  mine: { x: 'num', y: 'num', radius: 'num?' },
  spring: { x: 'num', y: 'num', w: 'num', power: 'num', angle: 'num?' },
  fan: { x: 'num', y: 'num', w: 'num', h: 'num', accel: 'num', angle: 'num?' },
  wrecker: { x: 'num', y: 'num', rod: 'num', r: 'num', amplitude: 'num', period: 'num', phase: 'num?' },
  spikes: { x: 'num', y: 'num', w: 'num' },
  npc: { x: 'num', y: 'num', facing: 'num?', look: 'str?' },
  counterweight: { x: 'num', y: 'num', w: 'num', travel: 'num', ramp: 'obj?', down: 'num?', up: 'num?', hold: 'num?', targets: 'strs?', threshold: 'num?' },
  tilt: { x: 'num', y: 'num', left: 'num', right: 'num', minA: 'num', maxA: 'num', initial: 'num', rate: 'num', returnRate: 'num?', style: 'str?' },
  latch: { x: 'num', y: 'num', targets: 'strs' },
  brace: { x: 'num', y: 'num', w: 'num', h: 'num', angle: 'num?', minSpeed: 'num', targets: 'strs' },
  bridge: { x: 'num', y: 'num', len: 'num', upAngle: 'num', downAngle: 'num', fall: 'num?' },
  conveyor: { x: 'num', y: 'num', w: 'num', speed: 'num', onActivate: 'str?' },
  lift: { ax: 'num', ay: 'num', bx: 'num', by: 'num', w: 'num', speed: 'num', waitA: 'num?', waitB: 'num?', phase: 'num?', mode: 'str', style: 'str?', crushFloor: 'num?' },
  swing: { x: 'num', y: 'num', rod: 'num', w: 'num', amplitude: 'num', period: 'num', phase: 'num?' },
  shutter: { x: 'num', floor: 'num', height: 'num', opening: 'num', openTime: 'num', holdTime: 'num', closeTime: 'num', mode: 'str', phase: 'num?' },
  cutter: { x: 'num', y: 'num', r: 'num', bx: 'num?', by: 'num?', period: 'num?', phase: 'num?' },
  compactor: { x: 'num', w: 'num', top: 'num', floor: 'num', rest: 'num', warn: 'num', slam: 'num', hold: 'num', rise: 'num', phase: 'num?' },
  cargo: { w: 'num', h: 'num', path: 'path', duration: 'num', targets: 'strs?', style: 'str?' },
};

const LEVEL_FIELDS = new Set([
  'schemaVersion', 'levelId', 'levelVersion', 'districtId', 'order', 'title', 'brief', 'bounds', 'spawn',
  'allowedVehicles', 'clearance', 'finish', 'killRegions', 'terrain', 'solids', 'decor', 'prefabs', 'tag',
  'checkpoint', 'cameraZones', 'hints', 'medals', 'expectedSeconds', 'routeChanging', 'background', 'onFoot',
]);

const DISTRICTS: DistrictId[] = ['road-closed', 'loading-zone', 'roof-access', 'overtime'];

/** Returns every problem found. An empty list means the level is sound. */
export function validateLevel(level: LevelData, knownVehicles: string[] = ['motorbike']): string[] {
  const errors: string[] = [];
  const fail = (message: string) => errors.push(`${level?.levelId ?? '(no id)'}: ${message}`);

  if (typeof level !== 'object' || level === null) return ['level is not an object'];
  for (const key of Object.keys(level)) if (!LEVEL_FIELDS.has(key)) fail(`unknown field "${key}"`);
  if (level.schemaVersion !== SCHEMA_VERSION) fail(`unsupported schemaVersion ${level.schemaVersion}`);
  if (!isStr(level.levelId)) fail('levelId missing');
  if (!isNum(level.levelVersion)) fail('levelVersion missing');
  if (!DISTRICTS.includes(level.districtId)) fail(`unknown district "${level.districtId}"`);
  if (!isNum(level.order)) fail('order missing');
  if (!isStr(level.title)) fail('title missing');

  const b = level.bounds;
  if (!b || ![b.x0, b.x1, b.y0, b.y1].every(isNum) || b.x0 >= b.x1 || b.y0 >= b.y1) fail('invalid bounds');
  if (!level.spawn || !isNum(level.spawn.x) || !isNum(level.spawn.y)) fail('invalid spawn');

  if (!Array.isArray(level.allowedVehicles) || level.allowedVehicles.length === 0) fail('allowedVehicles missing');
  else for (const v of level.allowedVehicles) if (!knownVehicles.includes(v)) fail(`unsupported vehicle "${v}"`);

  const f = level.finish;
  if (!f || !isNum(f.x) || !isNum(f.y) || !isNum(f.h)) fail('finish missing or invalid');
  else if (b && (f.x <= b.x0 || f.x >= b.x1)) fail('finish is outside bounds');

  if (!level.tag || !isNum(level.tag.x) || !isNum(level.tag.y)) fail('tag missing or invalid');

  const ids = new Set<string>();
  const claim = (id: unknown, what: string) => {
    if (!isStr(id)) return fail(`${what} has no id`);
    if (ids.has(id)) fail(`duplicate id "${id}"`);
    ids.add(id);
  };

  for (const t of level.terrain ?? []) {
    claim(t.id, 'terrain');
    if (!Array.isArray(t.points) || t.points.length < 2) {
      fail(`terrain "${t.id}" needs at least two points`);
      continue;
    }
    for (let i = 0; i < t.points.length; i++) {
      const [x, y] = t.points[i];
      if (!isNum(x) || !isNum(y)) fail(`terrain "${t.id}" point ${i} is not numeric`);
      if (i > 0) {
        const [px, py] = t.points[i - 1];
        if (Math.hypot(x - px, y - py) < 0.05) fail(`terrain "${t.id}" points ${i - 1}-${i} are degenerate`);
      }
    }
  }
  for (const s of level.solids ?? []) {
    claim(s.id, 'solid');
    if (![s.x, s.y, s.w, s.h].every(isNum) || s.w <= 0 || s.h <= 0) fail(`solid "${s.id}" has invalid geometry`);
  }
  for (const k of level.killRegions ?? []) {
    if (![k.x0, k.x1, k.y0, k.y1].every(isNum) || k.x0 >= k.x1 || k.y0 >= k.y1) fail('invalid kill region');
  }

  const targetsSeen: Array<[string, string]> = [];
  for (const p of level.prefabs ?? []) {
    claim(p.id, 'prefab');
    const spec = PREFAB_FIELDS[p.type];
    if (!spec) {
      fail(`prefab "${p.id}" has unknown type "${(p as { type: string }).type}"`);
      continue;
    }
    const record = p as unknown as Record<string, unknown>;
    for (const key of Object.keys(record)) {
      if (key !== 'type' && key !== 'id' && !(key in spec)) fail(`prefab "${p.id}" has unknown field "${key}"`);
    }
    for (const [key, kind] of Object.entries(spec)) {
      const v = record[key];
      const optional = kind.endsWith('?');
      if (v === undefined) {
        if (!optional) fail(`prefab "${p.id}" is missing "${key}"`);
        continue;
      }
      const base = kind.replace('?', '');
      const ok =
        base === 'num'
          ? isNum(v)
          : base === 'str'
            ? isStr(v)
            : base === 'strs'
              ? Array.isArray(v) && v.every(isStr)
              : base === 'path'
                ? Array.isArray(v) && v.length >= 2 && v.every((q) => Array.isArray(q) && q.length === 3 && q.every(isNum))
                : typeof v === 'object' && v !== null;
      if (!ok) fail(`prefab "${p.id}" field "${key}" is invalid`);
    }
    for (const t of (record.targets as string[] | undefined) ?? []) targetsSeen.push([p.id, t]);
  }
  for (const [from, to] of targetsSeen) if (!ids.has(to)) fail(`prefab "${from}" targets missing id "${to}"`);

  const cp = level.checkpoint;
  if (cp) {
    if (![cp.x, cp.y, cp.h].every(isNum)) fail('checkpoint gate is invalid');
    if (!cp.spawn || !isNum(cp.spawn.x) || !isNum(cp.spawn.y)) fail('checkpoint spawn is invalid');
    if (!cp.restore || typeof cp.restore !== 'object') fail('checkpoint restore is missing');
    else {
      for (const [id, state] of Object.entries(cp.restore)) {
        if (!(level.prefabs ?? []).some((p) => p.id === id)) fail(`checkpoint restores missing id "${id}"`);
        for (const key of Object.keys(state)) {
          if (key !== 'released' && key !== 'phase') fail(`checkpoint restore for "${id}" has unknown field "${key}"`);
        }
      }
    }
  }

  const m = level.medals;
  if (!m || ![m.gold, m.silver, m.bronze].every(isNum) || !(m.gold < m.silver && m.silver < m.bronze)) {
    fail('medal thresholds must rise from gold to bronze');
  }
  return errors;
}
