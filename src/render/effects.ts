import { BUDGET } from '../config/tuning';
import { mulberry } from '../core/math';
import type { SurfaceMap } from '../levels/surface';
import { INK } from './palette';

export type GoreMode = 'full' | 'reduced' | 'off';
export type EffectsQuality = 'low' | 'high';

const STRIDE = 11;
const X = 0, Y = 1, VX = 2, VY = 3, LIFE = 4, MAX = 5, SIZE = 6, KIND = 7, ROT = 8, SPIN = 9, TINT = 10;
const BLOOD = 0, SPARK = 1, DUST = 2, PAPER = 3, FIRE = 4, SMOKE = 5, WATER = 6, CHUNK = 7, STAR = 8;

/** Colours for loose debris, by index. */
export const TINT_INDEX = { cardboard: 0, wood: 1, paper: 2, red: 3, steel: 4, dirt: 5, plastic: 6, yellow: 7, orange: 8 } as const;
const TINTS = ['#c9a36a', '#8a5a2e', '#f1ead8', '#c8321f', '#8b9391', '#3d3833', '#9fd3ea', '#f0c12c', '#ef7d1a'];
const BLOODS = ['#b3161a', '#8e1216', '#c92224', '#6f0d11'];
const FIRES = ['#fff3b0', '#ffd23f', '#ff9a1f', '#f2541b', '#b3201c'];

interface Decal {
  x: number;
  y: number;
  angle: number;
  w: number;
  h: number;
  alpha: number;
  shape: number;
  color: string;
}

interface Popup {
  text: string;
  x: number;
  y: number;
  age: number;
  life: number;
  tilt: number;
  fill: string;
  size: number;
}

interface Ring {
  x: number;
  y: number;
  r: number;
  age: number;
}

/**
 * Blood, fire, paperwork and everything else that flies. Purely visual: pooled,
 * capped, and random in a way the simulation can never see.
 */
export class Effects {
  private data: Float32Array;
  private head = 0;
  active = 0;
  decals: Decal[] = [];
  private decalCap: number;
  private decalIndex = 0;
  private rand = mulberry(9001);
  private popups: Popup[] = [];
  private rings: Ring[] = [];
  /** Whole-screen flash, 0 to 1. The renderer draws it and it fades here. */
  flash = 0;
  gore: GoreMode = 'full';
  reducedMotion = false;
  /** Stops new blood once the aftermath has settled. */
  frozen = false;

  constructor(private surface: SurfaceMap | null, quality: EffectsQuality = 'high') {
    this.data = new Float32Array(BUDGET.particles.high * STRIDE);
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
    this.popups.length = 0;
    this.rings.length = 0;
    this.flash = 0;
    this.frozen = false;
  }

  private spawn(kind: number, x: number, y: number, vx: number, vy: number, life: number, size: number, tint = 0, spin = 0) {
    if (this.active < this.limit) this.active++;
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
    d[i + ROT] = this.rand() * 6.28;
    d[i + SPIN] = spin;
    d[i + TINT] = tint;
  }

  blood(x: number, y: number, vx: number, vy: number, count: number, spread = 5) {
    if (this.frozen) return;
    const r = this.rand;
    if (this.gore === 'full') {
      for (let n = 0; n < count; n++) {
        const big = r() < 0.18;
        this.spawn(BLOOD, x, y, vx + (r() - 0.5) * spread, vy + (r() - 0.25) * spread, 0.7 + r() * 1.1, (big ? 0.09 : 0.04) + r() * 0.06, Math.floor(r() * BLOODS.length));
      }
    } else if (this.gore === 'reduced') {
      this.dust(x, y, Math.ceil(count / 4));
    } else {
      this.stars(x, y, Math.min(4, Math.ceil(count / 10)));
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

  /** Loose paperwork. It takes its time coming down. */
  paper(x: number, y: number, vx: number, vy: number, count: number) {
    const r = this.rand;
    for (let n = 0; n < count; n++) {
      this.spawn(PAPER, x, y, vx * 0.5 + (r() - 0.5) * 7, vy * 0.4 + 2 + r() * 6, 2.2 + r() * 2.2, 0.11 + r() * 0.05, r() < 0.2 ? TINT_INDEX.yellow : TINT_INDEX.paper, (r() - 0.5) * 12);
    }
  }

  water(x: number, y: number, vx: number, vy: number, count: number) {
    const r = this.rand;
    for (let n = 0; n < count; n++) {
      this.spawn(WATER, x, y, vx * 0.4 + (r() - 0.5) * 7, vy * 0.3 + r() * 8, 0.6 + r() * 0.7, 0.04 + r() * 0.06);
    }
  }

  /** Broken bits of whatever that was. */
  chunks(x: number, y: number, vx: number, vy: number, count: number, tint: number, size = 0.12, power = 6) {
    const r = this.rand;
    for (let n = 0; n < count; n++) {
      this.spawn(CHUNK, x + (r() - 0.5) * 0.4, y + (r() - 0.5) * 0.4, vx * 0.6 + (r() - 0.5) * power, vy * 0.4 + r() * power, 1.2 + r() * 1.4, size * (0.5 + r()), tint, (r() - 0.5) * 18);
    }
  }

  stars(x: number, y: number, count = 4) {
    const r = this.rand;
    for (let n = 0; n < count; n++) {
      const a = r() * Math.PI * 2;
      this.spawn(STAR, x, y, Math.cos(a) * (2 + r() * 3), 2 + Math.sin(a) * 2 + r() * 3, 0.5 + r() * 0.4, 0.1 + r() * 0.07, 0, (r() - 0.5) * 10);
    }
  }

  explosion(x: number, y: number, radius: number) {
    const r = this.rand;
    const s = radius / 4.4;
    for (let n = 0; n < 34; n++) {
      const a = r() * Math.PI * 2;
      const v = (2 + r() * 11) * s;
      this.spawn(FIRE, x, y, Math.cos(a) * v, Math.abs(Math.sin(a)) * v * 0.9 + 1, 0.25 + r() * 0.5, (0.35 + r() * 0.6) * s);
    }
    for (let n = 0; n < 16; n++) {
      const a = r() * Math.PI * 2;
      const v = (1 + r() * 5) * s;
      this.spawn(SMOKE, x + Math.cos(a) * 0.5, y + 0.3, Math.cos(a) * v, 1.5 + r() * 3.5, 1.2 + r() * 1.3, (0.5 + r() * 0.7) * s);
    }
    this.chunks(x, y, 0, 6, 14, TINT_INDEX.dirt, 0.1, 16);
    this.sparks(x, y, 18, 16);
    this.rings.push({ x, y, r: radius, age: 0 });
    if (!this.reducedMotion) this.flash = Math.max(this.flash, 0.55);
    this.scorch(x, y, radius * 0.32);
  }

  /** A burn mark on the nearest floor below. */
  private scorch(x: number, y: number, size: number) {
    const s = this.surface?.below(x, y + 0.5);
    if (!s || y - s.y > 2.5) return;
    this.addDecal({ x, y: s.y + 0.012, angle: Math.atan(s.slope), w: size, h: size * 0.14, alpha: 0.75, shape: 2, color: '#1b1816' });
  }

  /** A stamp of HR language at a point in the world. */
  popup(text: string, x: number, y: number, tone: 'bad' | 'good' | 'note' = 'bad') {
    if (this.popups.length >= 5) this.popups.shift();
    for (const p of this.popups) if (Math.abs(p.x - x) < 3 && Math.abs(p.y - y) < 0.9) y += 0.85;
    this.popups.push({
      text,
      x,
      y,
      age: 0,
      life: 1.7,
      tilt: (this.rand() - 0.5) * 0.24,
      fill: tone === 'bad' ? '#d62b20' : tone === 'good' ? '#f0b21a' : '#f1ead8',
      // Long stamps shrink, so they stay on the screen.
      size: (tone === 'note' ? 0.5 : 0.62) * Math.max(0.6, Math.min(1, 13 / text.length)),
    });
  }

  private addDecal(decal: Decal) {
    if (this.decalCap <= 0) return;
    if (this.decals.length < this.decalCap) this.decals.push(decal);
    else {
      this.decals[this.decalIndex] = decal;
      this.decalIndex = (this.decalIndex + 1) % this.decalCap;
    }
  }

  stain(x: number, y: number, slope: number, size: number, color: string = INK.blood) {
    if (this.gore !== 'full' && color === INK.blood) return;
    this.addDecal({
      x,
      y,
      angle: Math.atan(slope),
      w: size * (1.4 + this.rand() * 1.8),
      h: size * 0.24,
      alpha: 0.72 + this.rand() * 0.28,
      shape: Math.floor(this.rand() * 3),
      color,
    });
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
      d[i + ROT] += d[i + SPIN] * dt;
      if (kind === DUST || kind === SMOKE || kind === FIRE) {
        d[i + X] += d[i + VX] * dt;
        d[i + Y] += d[i + VY] * dt;
        const drag = kind === FIRE ? 0.9 : 0.96;
        d[i + VX] *= drag;
        if (kind === FIRE) d[i + VY] = d[i + VY] * drag + 3 * dt;
        d[i + SIZE] += dt * (kind === SMOKE ? 0.7 : kind === DUST ? 0.5 : 0.2);
        continue;
      }
      if (kind === PAPER) {
        // Flutter: fall slowly and slide from side to side.
        d[i + VY] = Math.max(d[i + VY] - gravity * dt * 0.5, -1.6);
        d[i + VX] = d[i + VX] * 0.97 + Math.sin(d[i + ROT] * 0.7) * 3.5 * dt;
        d[i + X] += d[i + VX] * dt;
        const lastPaperY = d[i + Y];
        d[i + Y] += d[i + VY] * dt;
        if (this.surface && d[i + VY] < 0) {
          const s = this.surface.below(d[i + X], lastPaperY);
          if (s && d[i + Y] <= s.y + 0.03) {
            d[i + Y] = s.y + 0.03;
            d[i + VX] = 0;
            d[i + VY] = 0;
            d[i + SPIN] = 0;
            d[i + ROT] = Math.atan(s.slope);
          }
        }
        continue;
      }
      const lastY = d[i + Y];
      d[i + VY] -= gravity * dt * (kind === SPARK ? 0.6 : 1);
      d[i + X] += d[i + VX] * dt;
      d[i + Y] += d[i + VY] * dt;
      if ((kind === BLOOD || kind === WATER || kind === CHUNK) && this.surface && d[i + VY] < 0) {
        // Looks from where the drop was last step, so a fast one cannot pass through.
        const s = this.surface.below(d[i + X], lastY);
        if (s && d[i + Y] <= s.y) {
          if (kind === CHUNK) {
            d[i + Y] = s.y + d[i + SIZE] * 0.4;
            if (Math.abs(d[i + VY]) > 2.5) {
              d[i + VY] *= -0.35;
              d[i + VX] *= 0.6;
              d[i + SPIN] *= 0.5;
            } else {
              d[i + VY] = 0;
              d[i + VX] = 0;
              d[i + SPIN] = 0;
            }
            continue;
          }
          if (kind === BLOOD) this.stain(d[i + X], s.y + 0.01, s.slope, d[i + SIZE] * 2.6 + 0.08);
          else this.stain(d[i + X], s.y + 0.01, s.slope, d[i + SIZE] * 2, '#5d7f8c');
          d[i + LIFE] = 0;
          alive--;
        }
      }
    }
    this.active = alive;

    for (let n = this.popups.length - 1; n >= 0; n--) {
      const p = this.popups[n];
      p.age += dt;
      p.y += dt * 0.55;
      if (p.age >= p.life) this.popups.splice(n, 1);
    }
    for (let n = this.rings.length - 1; n >= 0; n--) {
      this.rings[n].age += dt;
      if (this.rings[n].age > 0.4) this.rings.splice(n, 1);
    }
    this.flash = Math.max(0, this.flash - dt * 2.6);
  }

  draw(g: CanvasRenderingContext2D) {
    const d = this.data;
    for (const ring of this.rings) {
      const u = ring.age / 0.4;
      g.globalAlpha = (1 - u) * 0.7;
      g.strokeStyle = '#fff6d6';
      g.lineWidth = 0.35 * (1 - u) + 0.04;
      g.beginPath();
      g.arc(ring.x, ring.y, ring.r * (0.2 + u * 0.95), 0, Math.PI * 2);
      g.stroke();
    }
    g.globalAlpha = 1;
    for (let n = 0; n < this.limit; n++) {
      const i = n * STRIDE;
      if (d[i + LIFE] <= 0) continue;
      const kind = d[i + KIND];
      const t = d[i + LIFE] / d[i + MAX];
      const s = d[i + SIZE];
      const x = d[i + X];
      const y = d[i + Y];
      switch (kind) {
        case BLOOD: {
          g.fillStyle = BLOODS[d[i + TINT] | 0];
          const speed = Math.hypot(d[i + VX], d[i + VY]);
          const stretch = Math.min(0.2, speed * 0.016);
          g.save();
          g.translate(x, y);
          g.rotate(Math.atan2(d[i + VY], d[i + VX]));
          g.beginPath();
          g.ellipse(-stretch * 0.5, 0, s + stretch, s * 0.72, 0, 0, Math.PI * 2);
          g.fill();
          g.restore();
          break;
        }
        case SPARK:
          g.globalAlpha = t;
          g.strokeStyle = INK.amber;
          g.lineWidth = s;
          g.beginPath();
          g.moveTo(x, y);
          g.lineTo(x - d[i + VX] * 0.03, y - d[i + VY] * 0.03);
          g.stroke();
          g.globalAlpha = 1;
          break;
        case DUST:
          g.globalAlpha = t * 0.35;
          g.fillStyle = '#a89a83';
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
          break;
        case SMOKE:
          g.globalAlpha = t * 0.5;
          g.fillStyle = '#2b2725';
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
          break;
        case FIRE:
          g.globalAlpha = Math.min(1, t * 1.6);
          g.fillStyle = FIRES[Math.min(FIRES.length - 1, Math.floor((1 - t) * FIRES.length))];
          g.beginPath();
          g.arc(x, y, s * (0.4 + t * 0.6), 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
          break;
        case WATER:
          g.globalAlpha = 0.85;
          g.fillStyle = '#a9dcf0';
          g.beginPath();
          g.arc(x, y, s, 0, Math.PI * 2);
          g.fill();
          g.globalAlpha = 1;
          break;
        case PAPER: {
          g.save();
          g.translate(x, y);
          g.rotate(d[i + ROT]);
          // Seen edge-on half the time, which is what makes it read as paper.
          const flat = d[i + SPIN] === 0 ? 0.25 : 0.25 + 0.75 * Math.abs(Math.cos(d[i + ROT] * 1.7));
          g.globalAlpha = Math.min(1, t * 4);
          g.fillStyle = TINTS[d[i + TINT] | 0];
          g.fillRect(-s, -s * 0.7 * flat, s * 2, s * 1.4 * flat);
          g.strokeStyle = INK.charcoal;
          g.lineWidth = 0.012;
          g.strokeRect(-s, -s * 0.7 * flat, s * 2, s * 1.4 * flat);
          g.restore();
          g.globalAlpha = 1;
          break;
        }
        case CHUNK:
          g.save();
          g.translate(x, y);
          g.rotate(d[i + ROT]);
          g.globalAlpha = Math.min(1, t * 3);
          g.fillStyle = TINTS[d[i + TINT] | 0];
          g.fillRect(-s, -s * 0.6, s * 2, s * 1.2);
          g.strokeStyle = INK.charcoal;
          g.lineWidth = 0.016;
          g.strokeRect(-s, -s * 0.6, s * 2, s * 1.2);
          g.restore();
          g.globalAlpha = 1;
          break;
        default: {
          // A cartoon star, for when blood is switched off.
          g.save();
          g.translate(x, y);
          g.rotate(d[i + ROT]);
          g.globalAlpha = t;
          g.fillStyle = '#f0c12c';
          g.beginPath();
          for (let k = 0; k < 10; k++) {
            const rr = k % 2 ? s * 0.45 : s;
            const a = (k / 10) * Math.PI * 2;
            g.lineTo(Math.cos(a) * rr, Math.sin(a) * rr);
          }
          g.closePath();
          g.fill();
          g.strokeStyle = INK.charcoal;
          g.lineWidth = 0.014;
          g.stroke();
          g.restore();
          g.globalAlpha = 1;
        }
      }
    }
  }

  /** Stamps. Drawn last, over everything in the world. */
  drawPopups(g: CanvasRenderingContext2D) {
    for (const p of this.popups) {
      const pop = p.age < 0.12 ? 1.7 - (p.age / 0.12) * 0.7 : 1;
      const fade = p.age > p.life - 0.35 ? (p.life - p.age) / 0.35 : 1;
      g.save();
      g.translate(p.x, p.y);
      g.rotate(p.tilt);
      const k = (p.size * pop) / 24;
      g.scale(k, -k);
      g.globalAlpha = Math.max(0, fade);
      g.font = '900 24px "Big Shoulders Display", Impact, sans-serif';
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      const w = g.measureText(p.text).width + 18;
      g.fillStyle = INK.charcoal;
      g.fillRect(-w / 2 + 2.5, -15 + 2.5, w, 32);
      g.fillStyle = p.fill;
      g.fillRect(-w / 2, -15, w, 32);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 2.5;
      g.strokeRect(-w / 2, -15, w, 32);
      g.fillStyle = p.fill === '#d62b20' ? '#fff6e6' : INK.charcoal;
      g.fillText(p.text, 0, 2);
      g.restore();
    }
    g.globalAlpha = 1;
  }

  drawDecals(g: CanvasRenderingContext2D) {
    for (const m of this.decals) {
      g.save();
      g.translate(m.x, m.y);
      g.rotate(m.angle);
      g.globalAlpha = m.alpha;
      g.fillStyle = m.color;
      g.beginPath();
      g.ellipse(0, 0.005, m.w, m.h, 0, 0, Math.PI * 2);
      if (m.shape > 0) g.ellipse(m.w * 0.7, 0.005, m.w * 0.34, m.h * 0.7, 0, 0, Math.PI * 2);
      if (m.shape > 1) g.ellipse(-m.w * 0.8, 0.005, m.w * 0.22, m.h * 0.6, 0, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
    g.globalAlpha = 1;
  }
}
