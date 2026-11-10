import { hashString } from '../core/math';
import type { LevelData, NpcData, PrefabData, PropKind } from './schema';
import { SurfaceMap } from './surface';

let serial = 0;
const nextId = (what: string) => `$${what}${serial++}`;

/** Loose objects of one kind at a list of spots. `y` is the floor they stand on. */
export function props(kind: PropKind, spots: Array<readonly [number, number]>): PrefabData[] {
  return spots.map(([x, y]) => ({ type: 'prop', id: nextId(kind), kind, x, y }));
}

/** A wall or pyramid of one kind of prop. Rows shrink by `taper` each layer. */
export function stack(kind: PropKind, x: number, y: number, cols: number, rows: number, taper = 0, size: readonly [number, number] = [0.74, 0.6]): PrefabData[] {
  const out: PrefabData[] = [];
  for (let r = 0; r < rows; r++) {
    const n = cols - r * taper;
    for (let c = 0; c < n; c++) {
      out.push({ type: 'prop', id: nextId(kind), kind, x: x + (c + (r * taper) / 2) * size[0], y: y + r * size[1] });
    }
  }
  return out;
}

export function npc(x: number, y: number, look: NpcData['look'] = 'inspector', facing = -1): PrefabData {
  return { type: 'npc', id: nextId('npc'), x, y, look, facing };
}

/** Levels the roadside scenery is left off, where it got in the way of the course. */
const PLAIN = new Set<string>(['lz-11']);
/** Levels with nothing waiting past the finish line. */
const NO_PARTY = new Set<string>([]);

interface Flat {
  x0: number;
  x1: number;
  y: number;
}

function prefabSpan(p: PrefabData): [number, number] {
  const r = p as unknown as Record<string, number> & { path?: number[][]; ramp?: { x: number; len: number } };
  const xs: number[] = [];
  for (const key of ['x', 'ax', 'bx']) if (typeof r[key] === 'number') xs.push(r[key]);
  if (r.path) for (const q of r.path) xs.push(q[0]);
  if (r.ramp) xs.push(r.ramp.x, r.ramp.x + r.ramp.len);
  const reach = Math.max(r.w ?? 0, r.rod ?? 0, r.r ?? 0, Math.abs(r.len ?? 0), r.left ?? 0, r.right ?? 0) + 1;
  return [Math.min(...xs) - reach, Math.max(...xs) + reach];
}

function flats(level: LevelData): Flat[] {
  const out: Flat[] = [];
  for (const t of level.terrain) {
    for (let i = 1; i < t.points.length; i++) {
      const [x0, y0] = t.points[i - 1];
      const [x1, y1] = t.points[i];
      if (Math.abs(y1 - y0) < 0.01 && x1 - x0 >= 9) out.push({ x0, x1, y: y0 });
    }
  }
  return out;
}

const SETS = ['boxes', 'cones', 'office', 'inspector', 'cart', 'ball'] as const;

function setPiece(kind: (typeof SETS)[number], x: number, y: number): PrefabData[] {
  switch (kind) {
    case 'boxes':
      return stack('box', x - 0.4, y, 2, 2);
    case 'cones':
      return props('cone', [[x - 1.3, y], [x, y], [x + 1.3, y]]);
    case 'office':
      return [...props('cooler', [[x - 0.6, y]]), ...props('chair', [[x + 0.5, y]])];
    case 'inspector':
      return [npc(x, y, 'inspector')];
    case 'cart':
      return [...props('cart', [[x - 0.5, y]]), ...props('bin', [[x + 0.8, y]])];
    default:
      return [...props('ball', [[x - 0.7, y]]), npc(x + 0.6, y, 'intern')];
  }
}

/**
 * Adds the scenery every course shares: things to plough through on the flat
 * stretches, and a welcome party past the finish. The result is still plain data.
 */
export function dress(level: LevelData): LevelData {
  if (level.districtId === 'overtime') return level;
  serial = hashString(level.levelId) % 1000 * 1000;
  const surface = new SurfaceMap(level);
  const added: PrefabData[] = [];
  const f = level.finish;

  if (!NO_PARTY.has(level.levelId)) {
    const floor = (x: number) => surface.below(x, f.y + f.h)?.y;
    const base = floor(f.x + 1);
    const clear = base !== undefined && [2, 3.2, 5, 6.5, 8].every((dx) => f.x + dx < level.bounds.x1 - 1 && Math.abs((floor(f.x + dx) ?? 99) - base) < 0.01);
    if (clear && base !== undefined) {
      // Whoever is waiting at the time clock, and whatever they were standing next to.
      const variant = level.order === 1 ? 1 : hashString(level.levelId) % 4;
      added.push(npc(f.x + 3.2, base, variant === 2 ? 'intern' : 'manager'));
      if (variant === 0) {
        added.push(...stack('box', f.x + 5, base, 3, 3, 1), ...props('cooler', [[f.x + 7.9, base]]));
      } else if (variant === 1) {
        added.push(...stack('box', f.x + 4.8, base, 2, 2), ...props('tnt', [[f.x + 6.7, base]]), ...props('cooler', [[f.x + 7.8, base]]));
      } else if (variant === 2) {
        added.push(npc(f.x + 4.4, base, 'intern', 1), ...props('ball', [[f.x + 5.6, base], [f.x + 6.8, base]]), ...props('cart', [[f.x + 8, base]]));
      } else {
        added.push(...props('cooler', [[f.x + 4.6, base], [f.x + 5.3, base]]), ...props('chair', [[f.x + 6.3, base]]), ...stack('box', f.x + 7.2, base, 2, 2));
      }
    }
  }

  if (!PLAIN.has(level.levelId)) {
    const blocked: Array<[number, number]> = level.prefabs.map(prefabSpan);
    blocked.push([level.spawn.x - 4, level.spawn.x + 9]);
    blocked.push([f.x - 6, f.x + 12]);
    blocked.push([level.tag.x - 3.5, level.tag.x + 3.5]);
    if (level.checkpoint) blocked.push([level.checkpoint.x - 3, level.checkpoint.spawn.x + 9]);
    for (const k of level.killRegions) blocked.push([k.x0 - 3, k.x1 + 3]);
    const free = (x: number) => blocked.every(([a, b]) => x < a - 2.5 || x > b + 2.5);
    const spots = flats(level)
      .filter((s) => s.x1 - s.x0 >= 9)
      .map((s) => ({ x: s.x0 + (s.x1 - s.x0) * 0.62, y: s.y, len: s.x1 - s.x0 }))
      // Only where that stretch really is the top surface, with headroom.
      .filter((s) => free(s.x) && Math.abs((surface.below(s.x, s.y + 3.5)?.y ?? 99) - s.y) < 0.01 && s.x > level.spawn.x + 9 && s.x < f.x)
      .sort((a, b) => b.len - a.len)
      .slice(0, 3);
    spots.forEach((s, i) => {
      const kind = SETS[(hashString(level.levelId) + i * 5) % SETS.length];
      added.push(...setPiece(kind, s.x, s.y));
    });
  }

  return added.length ? { ...level, prefabs: [...level.prefabs, ...added] } : level;
}
