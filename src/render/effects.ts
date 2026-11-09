import { BUDGET } from '../config/tuning';
import { mulberry } from '../core/math';
import type { SurfaceMap } from '../levels/surface';
import { INK } from './palette';

export type GoreMode = 'full' | 'reduced' | 'off';
export type EffectsQuality = 'low' | 'high';

const STRIDE = 8;
const X = 0, Y = 1, VX = 2, VY = 3, LIFE = 4, MAX = 5, SIZE = 6, KIND = 7;
const BLOOD = 0, SPARK = 1, DUST = 2;

interface Decal {
  x: number;
  y: number;
  angle: number;
  w: number;
  h: number;
  alpha: number;
  shape: number;
}

/**
 * Blood, sparks, dust and stains. Purely visual: pooled, capped, and random in a
 * way the simulation can never see.
 */
export class Effects {
  private data: Float32Array;
  private capacity: number;
  private head = 0;
  active = 0;
  decals: Decal[] = [];
  private decalCap: number;
  private decalIndex = 0;
  private rand = mulberry(9001);
  gore: GoreMode = 'full';
  /** Stops new blood once the aftermath has settled. */
  frozen = false;

  constructor(private surface: SurfaceMap | null, quality: EffectsQuality = 'high') {
    this.capacity = BUDGET.particles.high;
    this.data = new Float32Array(this.capacity * STRIDE);
    this.decalCap = quality === 'high' ? BUDGET.decals.high : BUDGET.decals.low;
    this.setQuality(quality);
  }

  private limit = BUDGET.particles.high as number;

  setQuality(q: EffectsQuality) {
    this.limit = q === 'high' ? BUDGET.particles.high : BUDGET.particles.low;
    this.decalCap = q === 'high' ? BUDGET.decals.high : BUDGET.decals.low;
  }

  setSurface(surface: SurfaceMap) {
    this.surface = surface;
  }

  reset() {
    this.data.fill(0);
    this.active = 0;
    this.head = 0;
    this.decals.length = 0;
    this.decalIndex = 0;
    this.frozen = false;
  }

  private spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number) {
    if (this.active >= this.limit) {
      // Over budget: reuse the oldest slot rather than growing.
    } else {
      this.active++;
    }
    const i = this.head * STRIDE;
    this.head = (this.head + 1) % this.limit;
    const d = this.data;
    d[i + X] = x;
    d[i + Y] = y;
    d[i + VX] = vx;
    d[i + VY] = vy;
    d[i + LIFE] = life;
    d[i + MAX] = life;
    d[i + SIZE] = size;
    d[i + KIND] = kind;
  }

  blood(x: number, y: number, vx: number, vy: number, count: number, spread = 5) {
    if (this.frozen) return;
    const r = this.rand;
    if (this.gore === 'full') {
      for (let n = 0; n < count; n++) {
        this.spawn(BLOOD, x, y, vx + (r() - 0.5) * spread, vy + (r() - 0.3) * spread, 0.6 + r() * 0.9, 0.035 + r() * 0.07);
      }
    } else {
      this.dust(x, y, Math.ceil(count / 4));
    }
  }

  sparks(x: number, y: number, count = 8, power = 6) {
    const r = this.rand;
    for (let n = 0; n < count; n++) {
      const a = r() * Math.PI * 2;
      const s = power * (0.3 + r());
      this.spawn(SPARK, x, y, Math.cos(a) * s, Math.abs(Math.sin(a)) * s, 0.18 + r() * 0.3, 0.025 + r() * 0.03);
    }
  }

  dust(x: number, y: number, count = 3) {
    const r = this.rand;
    for (let n = 0; n < count; n++) {
      this.spawn(DUST, x + (r() - 0.5) * 0.3, y, (r() - 0.5) * 1.5, 0.4 + r() * 0.9, 0.4 + r() * 0.5, 0.12 + r() * 0.2);
    }
  }

  stain(x: number, y: number, slope: number, size: number) {
    if (this.gore !== 'full') return;
    if (this.decalCap <= 0) return;
    const decal: Decal = {
      x,
      y,
      angle: Math.atan(slope),
      w: size * (1.4 + this.rand() * 1.6),
      h: size * 0.22,
      alpha: 0.7 + this.rand() * 0.3,
      shape: Math.floor(this.rand() * 3),
    };
    if (this.decals.length < this.decalCap) this.decals.push(decal);
    else {
      this.decals[this.decalIndex] = decal;
      this.decalIndex = (this.decalIndex + 1) % this.decalCap;
    }
  }

  update(dt: number, gravity: number) {
    const d = this.data;
    let alive = 0;
    for (let n = 0; n < this.limit; n++) {
      const i = n * STRIDE;
      if (d[i + LIFE] <= 0) continue;
      d[i + LIFE] -= dt;
      const kind = d[i + KIND];
      if (d[i + LIFE] <= 0) continue;
      alive++;
      if (kind === DUST) {
        d[i + X] += d[i + VX] * dt;
        d[i + Y] += d[i + VY] * dt;
        d[i + VX] *= 0.96;
        d[i + SIZE] += dt * 0.5;
        continue;
      }
      const lastY = d[i + Y];
      d[i + VY] -= gravity * dt * (kind === SPARK ? 0.6 : 1);
      d[i + X] += d[i + VX] * dt;
      d[i + Y] += d[i + VY] * dt;
      if (kind === BLOOD && this.surface && d[i + VY] < 0) {
        // Looks from where the drop was last step, so a fast one cannot pass through.
        const s = this.surface.below(d[i + X], lastY);
        if (s && d[i + Y] <= s.y) {
          this.stain(d[i + X], s.y + 0.01, s.slope, d[i + SIZE] * 2.4 + 0.08);
          d[i + LIFE] = 0;
          alive--;
        }
      }
    }
    this.active = alive;
  }

  draw(g: CanvasRenderingContext2D) {
    const d = this.data;
    for (let n = 0; n < this.limit; n++) {
      const i = n * STRIDE;
      if (d[i + LIFE] <= 0) continue;
      const kind = d[i + KIND];
      const t = d[i + LIFE] / d[i + MAX];
      const s = d[i + SIZE];
      if (kind === BLOOD) {
        g.fillStyle = t > 0.5 ? INK.bloodBright : INK.blood;
        const stretch = Math.min(0.11, Math.hypot(d[i + VX], d[i + VY]) * 0.012);
        g.save();
        g.translate(d[i + X], d[i + Y]);
        g.rotate(Math.atan2(d[i + VY], d[i + VX]));
        g.fillRect(-s - stretch, -s / 2, (s + stretch) * 2, s);
        g.restore();
      } else if (kind === SPARK) {
        g.globalAlpha = t;
        g.strokeStyle = INK.amber;
        g.lineWidth = s;
        g.beginPath();
        g.moveTo(d[i + X], d[i + Y]);
        g.lineTo(d[i + X] - d[i + VX] * 0.03, d[i + Y] - d[i + VY] * 0.03);
        g.stroke();
        g.globalAlpha = 1;
      } else {
        g.globalAlpha = t * 0.35;
        g.fillStyle = '#a89a83';
        g.beginPath();
        g.arc(d[i + X], d[i + Y], s, 0, Math.PI * 2);
        g.fill();
        g.globalAlpha = 1;
      }
    }
  }

  drawDecals(g: CanvasRenderingContext2D) {
    g.fillStyle = INK.blood;
    for (const m of this.decals) {
      g.save();
      g.translate(m.x, m.y);
      g.rotate(m.angle);
      g.globalAlpha = m.alpha;
      g.beginPath();
      g.ellipse(0, 0.005, m.w, m.h, 0, 0, Math.PI * 2);
      if (m.shape > 0) g.ellipse(m.w * 0.6, 0.005, m.w * 0.3, m.h * 0.7, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
  }
}
