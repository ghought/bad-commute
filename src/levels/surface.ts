import type { LevelData } from './schema';

interface Segment {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

/** Answers "what static surface is under this point?" for blood and dust only. */
export class SurfaceMap {
  private bins = new Map<number, Segment[]>();

  constructor(level: LevelData) {
    const add = (s: Segment) => {
      if (s.x1 < s.x0) return;
      for (let b = Math.floor(s.x0); b <= Math.floor(s.x1); b++) {
        const list = this.bins.get(b);
        if (list) list.push(s);
        else this.bins.set(b, [s]);
      }
    };
    for (const t of level.terrain) {
      for (let i = 1; i < t.points.length; i++) {
        const [x0, y0] = t.points[i - 1];
        const [x1, y1] = t.points[i];
        add({ x0, y0, x1, y1 });
      }
    }
    for (const s of level.solids) {
      if (s.angle) {
        const c = Math.cos(s.angle);
        const hs = Math.sin(s.angle);
        const lx = -s.w / 2;
        const ly = s.h / 2;
        add({ x0: s.x + lx * c - ly * hs, y0: s.y + lx * hs + ly * c, x1: s.x - lx * c - ly * hs, y1: s.y - lx * hs + ly * c });
      } else {
        add({ x0: s.x - s.w / 2, y0: s.y + s.h / 2, x1: s.x + s.w / 2, y1: s.y + s.h / 2 });
      }
    }
  }

  /** Highest surface at or below `y`, with its slope, or null. */
  below(x: number, y: number) {
    const list = this.bins.get(Math.floor(x));
    if (!list) return null;
    let best: { y: number; slope: number } | null = null;
    for (const s of list) {
      if (x < s.x0 || x > s.x1) continue;
      const span = s.x1 - s.x0;
      const t = span > 1e-6 ? (x - s.x0) / span : 0;
      const sy = s.y0 + (s.y1 - s.y0) * t;
      if (sy <= y + 0.05 && (!best || sy > best.y)) {
        best = { y: sy, slope: span > 1e-6 ? (s.y1 - s.y0) / span : 0 };
      }
    }
    return best;
  }
}
