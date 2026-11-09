import { GHOST, PHYSICS_VERSION } from '../config/tuning';
import { wrapAngle } from '../core/math';
import type { LevelData } from '../levels/schema';
import type { BodyPose } from '../vehicles/types';

export type GhostFrame = Map<string, { x: number; y: number; a: number }>;

export interface GhostData {
  ids: string[];
  hz: number;
  /** x, y, angle for every id, for every sample. */
  samples: Float32Array;
  durationMs: number;
  levelVersion: number;
  physicsVersion: number;
  vehicleId: string;
}

export const ghostKey = (levelId: string, vehicleId: string) => `${levelId}|${vehicleId}`;

/** A ghost only plays on the exact layout and physics it was recorded on. */
export function ghostCompatible(g: GhostData, level: Pick<LevelData, 'levelVersion'>, vehicleId: string, physics = PHYSICS_VERSION) {
  return g.levelVersion === level.levelVersion && g.physicsVersion === physics && g.vehicleId === vehicleId;
}

export class GhostRecorder {
  private ids: string[] | null = null;
  private values: number[] = [];
  private nextAt = 0;
  private count = 0;
  private readonly interval = 1 / GHOST.sampleHz;
  private readonly maxSamples = GHOST.maxSeconds * GHOST.sampleHz;
  private scratch: BodyPose[] = [];

  /** Records the pose if a sample is due. `collect` is only called when it is. */
  tick(time: number, collect: (out: BodyPose[]) => void) {
    if (time + 1e-6 < this.nextAt || this.count >= this.maxSamples) return;
    this.nextAt += this.interval;
    this.scratch.length = 0;
    collect(this.scratch);
    if (!this.ids) this.ids = this.scratch.map((p) => p.id);
    for (const p of this.scratch) this.values.push(p.x, p.y, p.angle);
    this.count++;
  }

  finish(durationMs: number, level: LevelData, vehicleId: string): GhostData | null {
    if (!this.ids || this.count < 2) return null;
    return {
      ids: this.ids,
      hz: GHOST.sampleHz,
      samples: new Float32Array(this.values),
      durationMs,
      levelVersion: level.levelVersion,
      physicsVersion: PHYSICS_VERSION,
      vehicleId,
    };
  }
}

export class GhostPlayer {
  private frame: GhostFrame = new Map();
  private readonly stride: number;
  private readonly count: number;

  constructor(private data: GhostData) {
    this.stride = data.ids.length * 3;
    this.count = Math.floor(data.samples.length / this.stride);
    for (const id of data.ids) this.frame.set(id, { x: 0, y: 0, a: 0 });
  }

  /** The interpolated pose at `time` seconds, or null once the ghost has ended. */
  at(time: number): GhostFrame | null {
    if (this.count < 2 || time < 0) return null;
    const exact = time * this.data.hz;
    const i = Math.floor(exact);
    if (i >= this.count - 1) return null;
    const f = exact - i;
    const s = this.data.samples;
    this.data.ids.forEach((id, n) => {
      const a = i * this.stride + n * 3;
      const b = a + this.stride;
      const out = this.frame.get(id)!;
      out.x = s[a] + (s[b] - s[a]) * f;
      out.y = s[a + 1] + (s[b + 1] - s[a + 1]) * f;
      out.a = s[a + 2] + wrapAngle(s[b + 2] - s[a + 2]) * f;
    });
    return this.frame;
  }
}

const DB = 'bad-commute-ghosts';
const STORE = 'ghosts';

function open(): Promise<IDBDatabase | null> {
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/** Ghost storage. A failure here never reaches gameplay. */
export const GhostStore = {
  async load(key: string): Promise<GhostData | null> {
    const db = await open();
    if (!db) return null;
    return new Promise((resolve) => {
      try {
        const req = db.transaction(STORE).objectStore(STORE).get(key);
        req.onsuccess = () => resolve((req.result as GhostData) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
  },
  async save(key: string, data: GhostData): Promise<boolean> {
    const db = await open();
    if (!db) return false;
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(data, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
        tx.onabort = () => resolve(false);
      } catch {
        resolve(false);
      }
    });
  },
};
