import { PHYSICS_VERSION } from '../config/tuning';
import { DEFAULT_KEYS, type KeyMap } from '../input/adapter';
import type { LevelData } from '../levels/schema';

export type Medal = 'gold' | 'silver' | 'bronze';
export type GoreSetting = 'full' | 'reduced' | 'off';
export type QualitySetting = 'auto' | 'low' | 'high';

export const SAVE_VERSION = 1;
const SAVE_KEY = 'bad-commute.save';

export interface TimeRecord {
  bestMs: number;
}

export interface LevelRecord {
  completed: boolean;
  medal: Medal | null;
  tag: boolean;
  /** Best full-run times, one per level version, vehicle and physics version. */
  times: Record<string, TimeRecord>;
}

export interface Settings {
  gore: GoreSetting;
  quality: QualitySetting;
  reducedMotion: boolean;
  master: number;
  sfx: number;
  music: number;
  muted: boolean;
  touchScale: number;
  touchOpacity: number;
  ghost: boolean;
  palette: string;
  keys: KeyMap;
}

export interface SaveData {
  version: number;
  noticeSeen: boolean;
  lastLevel: string | null;
  levels: Record<string, LevelRecord>;
  settings: Settings;
}

export const defaultSettings = (): Settings => ({
  gore: 'full',
  quality: 'auto',
  reducedMotion: false,
  master: 0.85,
  sfx: 0.9,
  music: 0.5,
  muted: false,
  touchScale: 1,
  touchOpacity: 0.72,
  ghost: true,
  palette: 'municipal',
  keys: structuredClone(DEFAULT_KEYS),
});

export const freshSave = (): SaveData => ({
  version: SAVE_VERSION,
  noticeSeen: false,
  lastLevel: null,
  levels: {},
  settings: defaultSettings(),
});

/** Brings any older save up to the current shape. Unknown input yields a fresh save. */
export function migrate(raw: unknown): SaveData {
  if (typeof raw !== 'object' || raw === null) return freshSave();
  const data = raw as Partial<SaveData> & { progress?: Record<string, { done?: boolean; best?: number }> };
  const out = freshSave();

  if (data.version === undefined && data.progress) {
    // Version 0 kept a flat map of completions and had no settings.
    for (const [id, entry] of Object.entries(data.progress)) {
      out.levels[id] = { completed: !!entry.done, medal: null, tag: false, times: {} };
    }
    return out;
  }
  if (typeof data.version !== 'number' || data.version > SAVE_VERSION) return out;

  out.noticeSeen = !!data.noticeSeen;
  out.lastLevel = typeof data.lastLevel === 'string' ? data.lastLevel : null;
  if (data.levels && typeof data.levels === 'object') out.levels = data.levels;
  if (data.settings && typeof data.settings === 'object') out.settings = { ...out.settings, ...data.settings };
  return out;
}

export interface StorageLike {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

function browserStorage(): StorageLike | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

export const recordKey = (level: Pick<LevelData, 'levelVersion'>, vehicleId: string, physics = PHYSICS_VERSION) =>
  `${vehicleId}|l${level.levelVersion}|p${physics}`;

export interface RunResult {
  timeMs: number;
  assisted: boolean;
  tag: boolean;
  vehicleId: string;
}

export interface RunOutcome {
  medal: Medal | null;
  newBest: boolean;
  bestMs: number | null;
  /** Newly earned cosmetic names. */
  unlocks: string[];
}

/** The medal a time earns. Thresholds are in seconds. */
export function medalFor(level: Pick<LevelData, 'medals'>, timeMs: number): Medal | null {
  const s = timeMs / 1000;
  if (s <= level.medals.gold) return 'gold';
  if (s <= level.medals.silver) return 'silver';
  if (s <= level.medals.bronze) return 'bronze';
  return null;
}

const MEDAL_RANK: Record<Medal, number> = { bronze: 1, silver: 2, gold: 3 };

/** The local save. Every failure is soft: the game keeps running and says so once. */
export class ProgressStore {
  data: SaveData;
  private storage: StorageLike | null;
  /** True when the last load or save did not reach storage. */
  saveFailed = false;

  constructor(storage: StorageLike | null = browserStorage()) {
    this.storage = storage;
    this.data = this.load();
  }

  private load(): SaveData {
    if (!this.storage) {
      this.saveFailed = true;
      return freshSave();
    }
    try {
      const text = this.storage.getItem(SAVE_KEY);
      return text ? migrate(JSON.parse(text)) : freshSave();
    } catch {
      this.saveFailed = true;
      return freshSave();
    }
  }

  save() {
    if (!this.storage) {
      this.saveFailed = true;
      return;
    }
    try {
      this.storage.setItem(SAVE_KEY, JSON.stringify(this.data));
      this.saveFailed = false;
    } catch {
      this.saveFailed = true;
    }
  }

  record(id: string): LevelRecord {
    let r = this.data.levels[id];
    if (!r) {
      r = { completed: false, medal: null, tag: false, times: {} };
      this.data.levels[id] = r;
    }
    return r;
  }

  completedCount() {
    return Object.values(this.data.levels).filter((r) => r.completed).length;
  }

  isUnlocked(level: Pick<LevelData, 'order'>, ordered: Array<Pick<LevelData, 'order' | 'levelId'>>) {
    if (level.order <= 1) return true;
    const prev = ordered.find((l) => l.order === level.order - 1);
    return !prev || !!this.data.levels[prev.levelId]?.completed;
  }

  bestMs(level: LevelData, vehicleId: string) {
    return this.data.levels[level.levelId]?.times[recordKey(level, vehicleId)]?.bestMs ?? null;
  }

  /** Banks a valid finish. Assisted runs complete the level but set no time or medal. */
  applyRun(level: LevelData, run: RunResult, unlockTable: Array<{ name: string; unlockAt: number }>): RunOutcome {
    const before = this.completedCount();
    const rec = this.record(level.levelId);
    rec.completed = true;
    if (run.tag) rec.tag = true;

    let medal: Medal | null = null;
    let newBest = false;
    const key = recordKey(level, run.vehicleId);
    if (!run.assisted) {
      medal = medalFor(level, run.timeMs);
      if (medal && (!rec.medal || MEDAL_RANK[medal] > MEDAL_RANK[rec.medal])) rec.medal = medal;
      const prior = rec.times[key]?.bestMs;
      if (prior === undefined || run.timeMs < prior) {
        rec.times[key] = { bestMs: run.timeMs };
        newBest = true;
      }
    }
    const after = this.completedCount();
    const unlocks = unlockTable.filter((u) => u.unlockAt > before && u.unlockAt <= after).map((u) => u.name);
    this.save();
    return { medal, newBest, bestMs: rec.times[key]?.bestMs ?? null, unlocks };
  }
}
