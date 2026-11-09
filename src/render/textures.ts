import { hashString, mulberry } from '../core/math';
import { INK } from './palette';
import type { SurfaceStyle } from '../levels/schema';

/** Pixels per metre in the generated tiles. */
export const TEX_SCALE = 72;
const SIZE = 288;

function makeCanvas(w: number, h: number) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function speckle(g: CanvasRenderingContext2D, rand: () => number, count: number, colors: string[], maxR: number) {
  for (let i = 0; i < count; i++) {
    g.fillStyle = colors[Math.floor(rand() * colors.length)];
    g.globalAlpha = 0.12 + rand() * 0.3;
    const r = 0.5 + rand() * maxR;
    g.fillRect(rand() * SIZE, rand() * SIZE, r, r);
  }
  g.globalAlpha = 1;
}

function crack(g: CanvasRenderingContext2D, rand: () => number, color: string) {
  g.strokeStyle = color;
  g.lineWidth = 1;
  g.globalAlpha = 0.45;
  g.beginPath();
  let x = rand() * SIZE;
  let y = rand() * SIZE;
  g.moveTo(x, y);
  for (let i = 0; i < 7; i++) {
    x += (rand() - 0.5) * 42;
    y += rand() * 28;
    g.lineTo(x, y);
  }
  g.stroke();
  g.globalAlpha = 1;
}

function drawSurface(style: SurfaceStyle) {
  const c = makeCanvas(SIZE, SIZE);
  const g = c.getContext('2d')!;
  const rand = mulberry(hashString(style));
  switch (style) {
    case 'asphalt':
      g.fillStyle = '#4a4540';
      g.fillRect(0, 0, SIZE, SIZE);
      speckle(g, rand, 2600, ['#6a635a', '#2f2b27', '#837a6c'], 2.4);
      for (let i = 0; i < 3; i++) crack(g, rand, '#1d1a18');
      break;
    case 'concrete':
      g.fillStyle = INK.concrete;
      g.fillRect(0, 0, SIZE, SIZE);
      speckle(g, rand, 1800, ['#cdbaa0', '#9a8872', '#7d6d59'], 2.6);
      g.strokeStyle = '#7f6f5a';
      g.globalAlpha = 0.5;
      g.lineWidth = 1.4;
      g.strokeRect(0, 0, SIZE, SIZE / 2);
      g.globalAlpha = 1;
      for (let i = 0; i < 4; i++) crack(g, rand, '#655744');
      for (let i = 0; i < 2; i++) {
        g.fillStyle = INK.teal;
        g.globalAlpha = 0.08;
        g.fillRect(rand() * SIZE, 0, 16 + rand() * 30, SIZE);
        g.globalAlpha = 1;
      }
      break;
    case 'steel': {
      g.fillStyle = INK.steelDark;
      g.fillRect(0, 0, SIZE, SIZE);
      speckle(g, rand, 900, ['#62686a', '#3c4142', '#8c4f2d'], 3);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 2;
      g.globalAlpha = 0.5;
      for (let x = 0; x <= SIZE; x += SIZE / 2) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, SIZE);
        g.stroke();
      }
      g.globalAlpha = 0.75;
      g.fillStyle = '#23201d';
      for (let x = 12; x < SIZE; x += SIZE / 6) for (let y = 12; y < SIZE; y += SIZE / 3) g.fillRect(x, y, 3, 3);
      g.globalAlpha = 1;
      break;
    }
    case 'brick': {
      g.fillStyle = '#5b3a2a';
      g.fillRect(0, 0, SIZE, SIZE);
      const bh = 24;
      const bw = 72;
      for (let row = 0; row < SIZE / bh; row++) {
        const off = row % 2 ? bw / 2 : 0;
        for (let col = -1; col < SIZE / bw + 1; col++) {
          const shade = rand();
          g.fillStyle = shade < 0.34 ? '#83492f' : shade < 0.7 ? '#73402a' : '#94563a';
          g.fillRect(col * bw + off + 1.5, row * bh + 1.5, bw - 3, bh - 3);
        }
      }
      speckle(g, rand, 900, ['#3a2519', '#a8704f'], 2.2);
      break;
    }
    case 'roof':
      g.fillStyle = '#3b3a3b';
      g.fillRect(0, 0, SIZE, SIZE);
      speckle(g, rand, 2200, ['#555354', '#272627', '#6d675e'], 2.2);
      g.strokeStyle = '#242324';
      g.globalAlpha = 0.6;
      g.lineWidth = 2;
      for (let y = 36; y < SIZE; y += 72) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(SIZE, y);
        g.stroke();
      }
      g.globalAlpha = 1;
      break;
    case 'plank':
      g.fillStyle = '#7a5a3a';
      g.fillRect(0, 0, SIZE, SIZE);
      g.strokeStyle = '#3f2c1c';
      g.lineWidth = 2;
      for (let y = 0; y < SIZE; y += 36) {
        g.beginPath();
        g.moveTo(0, y);
        g.lineTo(SIZE, y);
        g.stroke();
      }
      speckle(g, rand, 900, ['#94704b', '#54402a'], 3);
      break;
  }
  return c;
}

export class TextureBank {
  private surfaces = new Map<SurfaceStyle, CanvasPattern>();
  hazard: CanvasPattern | null = null;

  constructor(private g: CanvasRenderingContext2D) {}

  surface(style: SurfaceStyle) {
    let p = this.surfaces.get(style);
    if (!p) {
      p = this.g.createPattern(drawSurface(style), 'repeat')!;
      const m = new DOMMatrix();
      m.scaleSelf(1 / TEX_SCALE, 1 / TEX_SCALE);
      p.setTransform(m);
      this.surfaces.set(style, p);
    }
    return p;
  }

  /** The red and black diagonal used on everything dangerous. */
  stripes() {
    if (!this.hazard) {
      const c = makeCanvas(64, 64);
      const g = c.getContext('2d')!;
      g.fillStyle = INK.charcoal;
      g.fillRect(0, 0, 64, 64);
      g.strokeStyle = INK.hazard;
      g.lineWidth = 22;
      g.lineCap = 'square';
      for (let i = -64; i < 128; i += 64) {
        g.beginPath();
        g.moveTo(i, 64);
        g.lineTo(i + 64, 0);
        g.stroke();
      }
      this.hazard = this.g.createPattern(c, 'repeat')!;
      const m = new DOMMatrix();
      m.scaleSelf(1 / 80, 1 / 80);
      this.hazard.setTransform(m);
    }
    return this.hazard;
  }
}
