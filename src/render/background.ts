import { hashString, mulberry } from '../core/math';
import type { DistrictId } from '../levels/schema';
import { INK } from './palette';

interface Layer {
  canvas: HTMLCanvasElement;
  factor: number;
  /** Where the layer's base sits, as a fraction of view height from the top. */
  anchor: number;
}

export interface Backdrop {
  sky: HTMLCanvasElement;
  layers: Layer[];
}

const W = 1400;
const H = 560;

function layerCanvas() {
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  return [c, c.getContext('2d')!] as const;
}

/** Newsprint-style dot screen, the print texture behind every district. */
function halftone(g: CanvasRenderingContext2D, w: number, h: number, color: string, top: number) {
  g.fillStyle = color;
  const step = 9;
  for (let y = 0; y < h; y += step) {
    const t = Math.max(0, (y / h - top) / (1 - top));
    const r = 0.4 + t * 2.6;
    if (y / h < top) continue;
    for (let x = (y / step) % 2 ? step / 2 : 0; x < w; x += step) {
      g.beginPath();
      g.arc(x, y, r, 0, Math.PI * 2);
      g.fill();
    }
  }
}

function sky(top: string, bottom: string, dots: string) {
  const c = document.createElement('canvas');
  c.width = 480;
  c.height = 270;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 270);
  grad.addColorStop(0, top);
  grad.addColorStop(1, bottom);
  g.fillStyle = grad;
  g.fillRect(0, 0, 480, 270);
  g.globalAlpha = 0.16;
  halftone(g, 480, 270, dots, 0.3);
  g.globalAlpha = 1;
  return c;
}

function roadClosed(seed: number): Backdrop {
  const rand = mulberry(seed);
  const [far, gf] = layerCanvas();
  gf.fillStyle = '#c4b49a';
  let x = 0;
  while (x < W) {
    const w = 60 + rand() * 120;
    const h = 120 + rand() * 230;
    gf.fillRect(x, H - h, w, h);
    gf.save();
    gf.fillStyle = '#b3a288';
    for (let wy = H - h + 12; wy < H - 10; wy += 22) {
      for (let wx = x + 8; wx < x + w - 10; wx += 16) if (rand() > 0.4) gf.fillRect(wx, wy, 8, 11);
    }
    gf.restore();
    x += w + rand() * 18;
  }

  const [mid, gm] = layerCanvas();
  // An elevated expressway with nothing on it.
  gm.fillStyle = '#7f9a94';
  gm.fillRect(0, H - 250, W, 34);
  gm.fillStyle = '#6d8a84';
  gm.fillRect(0, H - 218, W, 12);
  for (let px = 70; px < W; px += 280) {
    gm.fillStyle = '#7f9a94';
    gm.beginPath();
    gm.moveTo(px - 30, H - 216);
    gm.lineTo(px + 30, H - 216);
    gm.lineTo(px + 18, H);
    gm.lineTo(px - 18, H);
    gm.closePath();
    gm.fill();
  }
  gm.strokeStyle = '#6d8a84';
  gm.lineWidth = 3;
  for (let px = 0; px < W; px += 34) {
    gm.beginPath();
    gm.moveTo(px, H - 250);
    gm.lineTo(px, H - 272);
    gm.stroke();
  }
  gm.fillRect(0, H - 274, W, 4);

  return {
    sky: sky('#dccdab', '#efe5cd', '#b89f79'),
    layers: [
      { canvas: far, factor: 0.08, anchor: 0.86 },
      { canvas: mid, factor: 0.2, anchor: 1 },
    ],
  };
}

function loadingZone(seed: number): Backdrop {
  const rand = mulberry(seed);
  const [far, gf] = layerCanvas();
  // Roof trusses and light shafts inside the shed.
  gf.fillStyle = '#34423f';
  gf.fillRect(0, 0, W, 40);
  gf.strokeStyle = '#34423f';
  gf.lineWidth = 7;
  for (let px = 0; px < W; px += 175) {
    gf.beginPath();
    gf.moveTo(px, 40);
    gf.lineTo(px + 87, 120);
    gf.lineTo(px + 175, 40);
    gf.moveTo(px + 87, 120);
    gf.lineTo(px + 87, 40);
    gf.stroke();
  }
  gf.fillStyle = 'rgba(233,223,198,0.07)';
  for (let px = 90; px < W; px += 350) {
    gf.beginPath();
    gf.moveTo(px, 40);
    gf.lineTo(px + 70, 40);
    gf.lineTo(px + 290, H);
    gf.lineTo(px + 110, H);
    gf.closePath();
    gf.fill();
  }

  const [mid, gm] = layerCanvas();
  // Pallet racking, mostly empty.
  for (let px = 0; px < W; px += 200) {
    gm.fillStyle = '#2d3a38';
    gm.fillRect(px, H - 420, 10, 420);
    gm.fillRect(px + 190, H - 420, 10, 420);
    for (let shelf = 0; shelf < 4; shelf++) {
      const y = H - 80 - shelf * 110;
      gm.fillStyle = '#2d3a38';
      gm.fillRect(px, y, 200, 8);
      for (let b = 0; b < 3; b++) {
        if (rand() > 0.55) {
          gm.fillStyle = rand() > 0.5 ? '#44504c' : '#4e4a3f';
          const h = 42 + rand() * 40;
          gm.fillRect(px + 14 + b * 60, y - h, 50, h);
        }
      }
    }
  }
  return {
    sky: sky('#22302f', '#3d4d49', '#101817'),
    layers: [
      { canvas: far, factor: 0.05, anchor: 0.8 },
      { canvas: mid, factor: 0.18, anchor: 1 },
    ],
  };
}

function roofAccess(seed: number): Backdrop {
  const rand = mulberry(seed);
  const [far, gf] = layerCanvas();
  gf.fillStyle = '#7d6a78';
  let x = 0;
  while (x < W) {
    const w = 50 + rand() * 90;
    const h = 90 + rand() * 330;
    gf.fillRect(x, H - h, w, h);
    gf.save();
    gf.fillStyle = '#efa21c';
    for (let wy = H - h + 10; wy < H - 10; wy += 18) {
      for (let wx = x + 7; wx < x + w - 7; wx += 13) {
        gf.globalAlpha = rand() > 0.86 ? 0.5 : 0;
        gf.fillRect(wx, wy, 6, 9);
      }
    }
    gf.restore();
    x += w + rand() * 12;
  }

  const [mid, gm] = layerCanvas();
  gm.fillStyle = '#433a48';
  x = -20;
  while (x < W) {
    const w = 130 + rand() * 170;
    const h = 90 + rand() * 120;
    gm.fillRect(x, H - h, w, h);
    const kind = rand();
    if (kind < 0.35) {
      // Water tank on legs.
      gm.fillRect(x + w / 2 - 30, H - h - 74, 60, 54);
      gm.beginPath();
      gm.moveTo(x + w / 2 - 34, H - h - 74);
      gm.lineTo(x + w / 2, H - h - 98);
      gm.lineTo(x + w / 2 + 34, H - h - 74);
      gm.fill();
      gm.fillRect(x + w / 2 - 28, H - h - 20, 5, 20);
      gm.fillRect(x + w / 2 + 23, H - h - 20, 5, 20);
    } else if (kind < 0.7) {
      gm.fillRect(x + 40, H - h - 120, 4, 120);
      gm.fillRect(x + 26, H - h - 100, 32, 3);
      gm.fillRect(x + 30, H - h - 84, 24, 3);
    }
    x += w + rand() * 36;
  }
  return {
    sky: sky('#50485f', '#e0a06b', '#2c2636'),
    layers: [
      { canvas: far, factor: 0.07, anchor: 0.94 },
      { canvas: mid, factor: 0.2, anchor: 1.02 },
    ],
  };
}

const cache = new Map<DistrictId, Backdrop>();

export function backdropFor(district: DistrictId): Backdrop {
  let b = cache.get(district);
  if (!b) {
    const seed = hashString(district);
    b = district === 'road-closed' ? roadClosed(seed) : district === 'loading-zone' ? loadingZone(seed) : roofAccess(seed);
    cache.set(district, b);
  }
  return b;
}

export const groundTint: Record<DistrictId, string> = {
  'road-closed': INK.concrete,
  'loading-zone': INK.steel,
  'roof-access': '#4b4550',
};
