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

interface Theme {
  sky: [string, string, string];
  sun: { x: number; y: number; r: number; color: string; glow: string } | null;
  stars: boolean;
  cloud: string;
  far: string;
  farWindow: string;
  mid: string;
  midWindow: string;
  /** Share of windows with a light on. */
  lit: number;
  litColor: string;
  near: string;
  nearDark: string;
  accent: string[];
}

const SLOGANS = [
  'SAFETY FIRST*',
  'DAYS SINCE LAST INCIDENT: 0',
  'HAVE YOU TRIED NOT DYING?',
  'YOUR CALL IS IMPORTANT',
  'TEAMWORK MAKES THE SCREAM WORK',
  'LIMBS ARE A PRIVILEGE',
  'SYNERGY',
  'PLEASE DO NOT BLEED ON THE BIKE',
  'HANG IN THERE',
  'NOW HIRING. CONSTANTLY.',
  'MIND THE GAP. AND THE SAW.',
  'PAIN IS JUST FEEDBACK',
];

function skyCanvas(t: Theme, rand: () => number) {
  const c = document.createElement('canvas');
  c.width = 640;
  c.height = 360;
  const g = c.getContext('2d')!;
  const grad = g.createLinearGradient(0, 0, 0, 360);
  grad.addColorStop(0, t.sky[0]);
  grad.addColorStop(0.55, t.sky[1]);
  grad.addColorStop(1, t.sky[2]);
  g.fillStyle = grad;
  g.fillRect(0, 0, 640, 360);
  if (t.stars) {
    g.fillStyle = '#fff6d6';
    for (let i = 0; i < 90; i++) {
      g.globalAlpha = 0.3 + rand() * 0.7;
      const s = rand() < 0.15 ? 2 : 1;
      g.fillRect(rand() * 640, rand() * 220, s, s);
    }
    g.globalAlpha = 1;
  }
  if (t.sun) {
    const { x, y, r, color, glow } = t.sun;
    const halo = g.createRadialGradient(x, y, r * 0.6, x, y, r * 4.2);
    halo.addColorStop(0, glow);
    halo.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, 640, 360);
    g.fillStyle = color;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  return c;
}

function clouds(t: Theme, rand: () => number) {
  const [c, g] = layerCanvas();
  g.fillStyle = t.cloud;
  for (let i = 0; i < 9; i++) {
    const x = rand() * W;
    const y = 40 + rand() * 210;
    const s = 26 + rand() * 40;
    g.globalAlpha = 0.55 + rand() * 0.35;
    g.beginPath();
    g.ellipse(x, y, s * 2.4, s * 0.55, 0, 0, Math.PI * 2);
    g.ellipse(x - s * 0.9, y - s * 0.3, s * 1.1, s * 0.6, 0, 0, Math.PI * 2);
    g.ellipse(x + s * 0.7, y - s * 0.42, s * 1.3, s * 0.75, 0, 0, Math.PI * 2);
    g.fill();
  }
  g.globalAlpha = 1;
  return c;
}

function skyline(rand: () => number, body: string, win: string, lit: number, litColor: string, minH: number, maxH: number, roofs: boolean) {
  const [c, g] = layerCanvas();
  let x = -20;
  while (x < W) {
    const w = 70 + rand() * 130;
    const h = minH + rand() * (maxH - minH);
    g.fillStyle = body;
    g.fillRect(x, H - h, w, h);
    if (roofs) {
      const kind = rand();
      if (kind < 0.3) {
        // Water tower.
        g.fillRect(x + w * 0.3, H - h - 34, 4, 34);
        g.fillRect(x + w * 0.3 + 26, H - h - 34, 4, 34);
        g.fillRect(x + w * 0.3 - 6, H - h - 62, 42, 30);
        g.beginPath();
        g.moveTo(x + w * 0.3 - 9, H - h - 62);
        g.lineTo(x + w * 0.3 + 15, H - h - 78);
        g.lineTo(x + w * 0.3 + 39, H - h - 62);
        g.fill();
      } else if (kind < 0.55) {
        g.fillRect(x + w * 0.6, H - h - 60, 3, 60);
        g.fillRect(x + w * 0.6 - 9, H - h - 48, 21, 3);
        g.fillRect(x + w * 0.6 - 5, H - h - 36, 13, 3);
      } else if (kind < 0.8) {
        g.fillRect(x + w * 0.15, H - h - 16, w * 0.4, 16);
      }
    }
    for (let wy = H - h + 14; wy < H - 12; wy += 24) {
      for (let wx = x + 9; wx < x + w - 14; wx += 18) {
        if (rand() < 0.22) continue;
        g.fillStyle = rand() < lit ? litColor : win;
        g.fillRect(wx, wy, 9, 13);
      }
    }
    x += w + rand() * 22 - 4;
  }
  return c;
}

function billboard(g: CanvasRenderingContext2D, x: number, base: number, text: string, t: Theme, rand: () => number) {
  const w = 250 + rand() * 60;
  const h = 84;
  const y = base - 430 - rand() * 40;
  g.fillStyle = t.nearDark;
  g.fillRect(x + w * 0.2, y + h, 9, base - y - h);
  g.fillRect(x + w * 0.75, y + h, 9, base - y - h);
  g.fillStyle = t.nearDark;
  g.fillRect(x - 5, y - 5, w + 10, h + 10);
  g.fillStyle = t.accent[Math.floor(rand() * t.accent.length)];
  g.fillRect(x, y, w, h);
  g.fillStyle = '#1d1a18';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const words = text.split(' ');
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > 15 && line) {
      lines.push(line);
      line = word;
    } else line = (line + ' ' + word).trim();
  }
  if (line) lines.push(line);
  const size = lines.length > 2 ? 21 : lines.length > 1 ? 27 : 34;
  g.font = `900 ${size}px "Big Shoulders Display", Impact, sans-serif`;
  lines.forEach((l, i) => g.fillText(l, x + w / 2, y + h / 2 + (i - (lines.length - 1) / 2) * (size + 2) + 2, w - 16));
}

function nearLayer(district: DistrictId, t: Theme, rand: () => number) {
  const [c, g] = layerCanvas();
  const base = H;
  if (district === 'road-closed') {
    // An elevated expressway with nothing on it.
    g.fillStyle = t.near;
    g.fillRect(0, H - 250, W, 34);
    g.fillStyle = t.nearDark;
    g.fillRect(0, H - 218, W, 12);
    for (let px = 70; px < W; px += 280) {
      g.fillStyle = t.near;
      g.beginPath();
      g.moveTo(px - 30, H - 216);
      g.lineTo(px + 30, H - 216);
      g.lineTo(px + 18, H);
      g.lineTo(px - 18, H);
      g.closePath();
      g.fill();
    }
    g.strokeStyle = t.nearDark;
    g.lineWidth = 3;
    for (let px = 0; px < W; px += 34) {
      g.beginPath();
      g.moveTo(px, H - 250);
      g.lineTo(px, H - 272);
      g.stroke();
    }
    g.fillStyle = t.nearDark;
    g.fillRect(0, H - 274, W, 4);
  } else if (district === 'loading-zone') {
    // Container stacks and a gantry crane.
    let x = 0;
    while (x < W) {
      const rows = 1 + Math.floor(rand() * 4);
      for (let r = 0; r < rows; r++) {
        g.fillStyle = t.accent[Math.floor(rand() * t.accent.length)];
        g.fillRect(x, base - (r + 1) * 46, 118, 44);
        g.fillStyle = 'rgba(0,0,0,0.16)';
        for (let rx = x + 8; rx < x + 112; rx += 11) g.fillRect(rx, base - (r + 1) * 46 + 4, 4, 36);
      }
      x += 122 + (rand() < 0.3 ? 70 + rand() * 80 : 0);
    }
    g.strokeStyle = t.nearDark;
    g.lineWidth = 10;
    g.strokeRect(520, base - 330, 300, 330);
    g.fillStyle = t.nearDark;
    g.fillRect(430, base - 344, 520, 22);
    g.fillRect(700, base - 322, 5, 90);
    g.fillRect(684, base - 236, 38, 26);
  } else {
    // Rooftop clutter: vents, tanks, and a sign with letters missing.
    let x = 0;
    while (x < W) {
      const w = 60 + rand() * 120;
      const h = 30 + rand() * 90;
      g.fillStyle = rand() < 0.5 ? t.near : t.nearDark;
      g.fillRect(x, base - h, w, h);
      if (rand() < 0.5) {
        g.fillStyle = t.nearDark;
        g.fillRect(x + w * 0.4, base - h - 26, 12, 26);
        g.beginPath();
        g.ellipse(x + w * 0.4 + 6, base - h - 30, 16, 9, 0, 0, Math.PI * 2);
        g.fill();
      }
      x += w + 40 + rand() * 160;
    }
  }
  // Billboards. Head office has thoughts.
  const start = Math.floor(rand() * SLOGANS.length);
  let n = 0;
  for (let bx = 90 + rand() * 60; bx < W - 320; bx += 420 + rand() * 120) {
    billboard(g, bx, base, SLOGANS[(start + n * 5) % SLOGANS.length], t, rand);
    n++;
  }
  return c;
}

const THEMES: Record<DistrictId, Theme> = {
  'road-closed': {
    sky: ['#ffc98a', '#ffe1b0', '#fff2d4'],
    sun: { x: 470, y: 150, r: 34, color: '#fff7cf', glow: 'rgba(255,244,190,0.75)' },
    stars: false,
    cloud: '#fff6e4',
    far: '#f2b98f', farWindow: '#e9a57b',
    mid: '#dc8e6c', midWindow: '#c97858', lit: 0.12, litColor: '#ffe9a8',
    near: '#5f9c96', nearDark: '#3f7570',
    accent: ['#f7cf2e', '#fff6e6', '#f2761b'],
  },
  'loading-zone': {
    sky: ['#6fc3cf', '#a9dedb', '#e6f4dc'],
    sun: { x: 150, y: 80, r: 26, color: '#fffbe0', glow: 'rgba(255,255,230,0.6)' },
    stars: false,
    cloud: '#f4fbf4',
    far: '#8fc6bd', farWindow: '#7fb7ae',
    mid: '#5d9a96', midWindow: '#4c8884', lit: 0.1, litColor: '#fff0a8',
    near: '#3d6f6c', nearDark: '#27504e',
    accent: ['#d5552f', '#e8a13a', '#3f7fa6', '#7c8a86', '#f7cf2e'],
  },
  'roof-access': {
    sky: ['#3d2a66', '#c4527a', '#ffb37a'],
    sun: { x: 330, y: 300, r: 46, color: '#ffe08a', glow: 'rgba(255,190,110,0.8)' },
    stars: false,
    cloud: '#f08a8a',
    far: '#7a4680', farWindow: '#6a3b70',
    mid: '#4a2d5c', midWindow: '#3d244d', lit: 0.4, litColor: '#ffd27a',
    near: '#33203f', nearDark: '#22152b',
    accent: ['#ffb37a', '#f7cf2e', '#ff6f91'],
  },
  overtime: {
    sky: ['#0d1230', '#262c66', '#5d4a8f'],
    sun: { x: 500, y: 90, r: 30, color: '#f4f1ff', glow: 'rgba(210,205,255,0.5)' },
    stars: true,
    cloud: '#3a3f7a',
    far: '#2a3066', farWindow: '#232a5a',
    mid: '#171c40', midWindow: '#12173a', lit: 0.55, litColor: '#ffe27a',
    near: '#0f1330', nearDark: '#090c22',
    accent: ['#ff5d8f', '#4de1d2', '#f7cf2e'],
  },
};

function build(district: DistrictId, seed: number): Backdrop {
  const rand = mulberry(seed);
  const t = THEMES[district];
  const tall = district === 'roof-access' || district === 'overtime';
  return {
    sky: skyCanvas(t, rand),
    layers: [
      { canvas: clouds(t, rand), factor: 0.02, anchor: 0.62 },
      { canvas: skyline(rand, t.far, t.farWindow, 0, t.litColor, 140, tall ? 300 : 360, false), factor: 0.06, anchor: tall ? 0.98 : 0.86 },
      { canvas: skyline(rand, t.mid, t.midWindow, t.lit, t.litColor, 70, tall ? 200 : 250, true), factor: 0.12, anchor: tall ? 1.04 : 0.94 },
      { canvas: nearLayer(district, t, rand), factor: 0.22, anchor: tall ? 1.1 : 1 },
    ],
  };
}

const cache = new Map<DistrictId, Backdrop>();

export function backdropFor(district: DistrictId): Backdrop {
  let b = cache.get(district);
  if (!b) {
    b = build(district, hashString(district));
    cache.set(district, b);
  }
  return b;
}

export const groundTint: Record<DistrictId, string> = {
  'road-closed': INK.concrete,
  'loading-zone': INK.steel,
  'roof-access': '#4b4550',
  overtime: '#3a3558',
};
