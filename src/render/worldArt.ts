import type { DecorData, KillRegion, LevelData, SolidData, SurfaceStyle, TerrainData } from '../levels/schema';
import { INK } from './palette';
import type { TextureBank } from './textures';

export interface View {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

interface Strip {
  fill: Path2D;
  edge: Path2D;
  style: SurfaceStyle;
  x0: number;
  x1: number;
}

/** Prebuilt paths for one level's static geometry. */
export class StaticArt {
  strips: Strip[] = [];

  constructor(readonly level: LevelData) {
    const floor = level.bounds.y0 - 6;
    for (const t of level.terrain) this.strips.push(this.terrainStrip(t, floor));
    for (const s of level.solids) this.strips.push(this.solidStrip(s));
  }

  private terrainStrip(t: TerrainData, floor: number): Strip {
    const fill = new Path2D();
    const edge = new Path2D();
    t.points.forEach(([x, y], i) => {
      if (i === 0) {
        fill.moveTo(x, y);
        edge.moveTo(x, y);
      } else {
        fill.lineTo(x, y);
        // Walls keep a plain outline. Only riding surfaces get the bright edge.
        if (Math.abs(x - t.points[i - 1][0]) < 0.02) edge.moveTo(x, y);
        else edge.lineTo(x, y);
      }
    });
    const first = t.points[0];
    const last = t.points[t.points.length - 1];
    fill.lineTo(last[0], floor);
    fill.lineTo(first[0], floor);
    fill.closePath();
    const xs = t.points.map((p) => p[0]);
    return { fill, edge, style: t.style, x0: Math.min(...xs), x1: Math.max(...xs) };
  }

  private solidStrip(s: SolidData): Strip {
    const a = s.angle ?? 0;
    const c = Math.cos(a);
    const sn = Math.sin(a);
    const pt = (lx: number, ly: number) => [s.x + lx * c - ly * sn, s.y + lx * sn + ly * c] as const;
    const hw = s.w / 2;
    const hh = s.h / 2;
    const corners = [pt(-hw, hh), pt(hw, hh), pt(hw, -hh), pt(-hw, -hh)];
    const fill = new Path2D();
    corners.forEach(([x, y], i) => (i === 0 ? fill.moveTo(x, y) : fill.lineTo(x, y)));
    fill.closePath();
    const edge = new Path2D();
    edge.moveTo(corners[0][0], corners[0][1]);
    edge.lineTo(corners[1][0], corners[1][1]);
    const xs = corners.map((p) => p[0]);
    return { fill, edge, style: s.style, x0: Math.min(...xs), x1: Math.max(...xs) };
  }

  draw(g: CanvasRenderingContext2D, tex: TextureBank, view: View) {
    for (const s of this.strips) {
      if (s.x1 < view.x0 || s.x0 > view.x1) continue;
      g.fillStyle = tex.surface(s.style);
      g.fill(s.fill);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.09;
      g.stroke(s.fill);
    }
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const s of this.strips) {
      if (s.x1 < view.x0 || s.x0 > view.x1) continue;
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.14;
      g.stroke(s.edge);
      g.strokeStyle = INK.cream;
      g.lineWidth = 0.055;
      g.stroke(s.edge);
    }
  }
}

export function worldText(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string, align: CanvasTextAlign = 'center') {
  g.save();
  g.translate(x, y);
  g.scale(size / 24, -size / 24);
  g.font = '700 24px "Big Shoulders Display", Impact, sans-serif';
  g.textAlign = align;
  g.textBaseline = 'alphabetic';
  g.fillStyle = color;
  g.fillText(text, 0, 0);
  g.restore();
}

export function drawKillRegion(g: CanvasRenderingContext2D, k: KillRegion, tex: TextureBank) {
  if (k.style !== 'pit') return;
  // The fatal line sits below this, so a fall has a moment to register.
  const top = k.y1 + 2.5;
  g.fillStyle = '#1a1715';
  g.fillRect(k.x0, k.y0, k.x1 - k.x0, top - k.y0);
  // Red and black lip, so the drop reads before you reach it.
  g.fillStyle = tex.stripes();
  g.fillRect(k.x0, top - 0.24, k.x1 - k.x0, 0.24);
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.05;
  g.strokeRect(k.x0, top - 0.24, k.x1 - k.x0, 0.24);
}

function post(g: CanvasRenderingContext2D, x: number, y: number, h: number, w = 0.12, color: string = INK.steelDark) {
  g.fillStyle = color;
  g.fillRect(x - w / 2, y, w, h);
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.035;
  g.strokeRect(x - w / 2, y, w, h);
}

export function drawDecor(g: CanvasRenderingContext2D, d: DecorData, tex: TextureBank) {
  const s = d.scale ?? 1;
  g.save();
  g.translate(d.x, d.y);
  g.scale(s, s);
  switch (d.kind) {
    case 'cone':
      g.beginPath();
      g.moveTo(-0.26, 0);
      g.lineTo(-0.05, 0.62);
      g.lineTo(0.05, 0.62);
      g.lineTo(0.26, 0);
      g.closePath();
      g.fillStyle = INK.amber;
      g.fill();
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.035;
      g.stroke();
      g.fillStyle = INK.cream;
      g.fillRect(-0.16, 0.22, 0.32, 0.12);
      g.fillStyle = INK.charcoal;
      g.fillRect(-0.34, -0.02, 0.68, 0.06);
      break;
    case 'barrier':
      post(g, -0.9, 0, 1.05);
      post(g, 0.9, 0, 1.05);
      g.fillStyle = tex.stripes();
      g.fillRect(-1.25, 0.66, 2.5, 0.28);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.04;
      g.strokeRect(-1.25, 0.66, 2.5, 0.28);
      break;
    case 'sign': {
      post(g, 0, 0, 1.6);
      g.fillStyle = INK.cream;
      g.fillRect(-1.1, 1.5, 2.2, 0.9);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.06;
      g.strokeRect(-1.1, 1.5, 2.2, 0.9);
      worldText(g, d.text ?? 'ROAD CLOSED', 0, 1.78, 0.55, INK.charcoal);
      break;
    }
    case 'arrow':
      post(g, 0, 0, 1.2);
      g.fillStyle = INK.amber;
      g.beginPath();
      g.moveTo(-0.65, 1.2);
      g.lineTo(0.2, 1.2);
      g.lineTo(0.2, 1.0);
      g.lineTo(0.75, 1.45);
      g.lineTo(0.2, 1.9);
      g.lineTo(0.2, 1.7);
      g.lineTo(-0.65, 1.7);
      g.closePath();
      g.fill();
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.05;
      g.stroke();
      break;
    case 'danger':
      post(g, 0, 0, 1.3);
      g.fillStyle = tex.stripes();
      g.beginPath();
      g.moveTo(0, 2.25);
      g.lineTo(0.72, 1.2);
      g.lineTo(-0.72, 1.2);
      g.closePath();
      g.fill();
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.06;
      g.stroke();
      break;
    case 'lamp':
      post(g, 0, 0, 5.2, 0.14, INK.soot);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.1;
      g.beginPath();
      g.moveTo(0, 5.1);
      g.quadraticCurveTo(0.2, 5.7, 1.1, 5.55);
      g.stroke();
      g.fillStyle = INK.amber;
      g.fillRect(0.9, 5.36, 0.5, 0.17);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.04;
      g.strokeRect(0.9, 5.36, 0.5, 0.17);
      break;
    case 'crate':
      g.fillStyle = tex.surface('plank');
      g.fillRect(-0.6, 0, 1.2, 1.1);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.05;
      g.strokeRect(-0.6, 0, 1.2, 1.1);
      g.beginPath();
      g.moveTo(-0.6, 0);
      g.lineTo(0.6, 1.1);
      g.moveTo(-0.6, 1.1);
      g.lineTo(0.6, 0);
      g.stroke();
      break;
    case 'drum':
      g.fillStyle = INK.tealDark;
      g.fillRect(-0.36, 0, 0.72, 1.05);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.05;
      g.strokeRect(-0.36, 0, 0.72, 1.05);
      g.beginPath();
      g.moveTo(-0.36, 0.35);
      g.lineTo(0.36, 0.35);
      g.moveTo(-0.36, 0.7);
      g.lineTo(0.36, 0.7);
      g.stroke();
      break;
    case 'duct':
      g.fillStyle = INK.steel;
      g.fillRect(-1.5, 0, 3, 0.8);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.05;
      g.strokeRect(-1.5, 0, 3, 0.8);
      for (let x = -1.1; x < 1.5; x += 0.75) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, 0.8);
        g.stroke();
      }
      break;
    case 'vent':
      g.fillStyle = INK.steelDark;
      g.fillRect(-0.3, 0, 0.6, 1);
      g.fillStyle = INK.steel;
      g.beginPath();
      g.moveTo(-0.55, 1);
      g.lineTo(0.55, 1);
      g.lineTo(0, 1.45);
      g.closePath();
      g.fill();
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.05;
      g.stroke();
      break;
    case 'antenna':
      post(g, 0, 0, 3.4, 0.07, INK.soot);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.05;
      g.beginPath();
      for (let y = 2.1; y < 3.3; y += 0.4) {
        g.moveTo(-0.45, y);
        g.lineTo(0.45, y);
      }
      g.stroke();
      break;
    case 'terminal': {
      // The finish: a time clock, bolted to a post, indifferent.
      post(g, 0, 0, 2.2, 0.18, INK.soot);
      g.fillStyle = INK.cream;
      g.fillRect(-0.7, 2.1, 1.4, 1.5);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.07;
      g.strokeRect(-0.7, 2.1, 1.4, 1.5);
      worldText(g, 'CLOCK IN', 0, 2.25, 0.32, INK.charcoal);
      g.beginPath();
      g.arc(0, 3.05, 0.4, 0, Math.PI * 2);
      g.fillStyle = '#f5eeda';
      g.fill();
      g.stroke();
      g.lineWidth = 0.05;
      g.beginPath();
      g.moveTo(0, 3.05);
      g.lineTo(0, 3.35);
      g.moveTo(0, 3.05);
      g.lineTo(0.21, 2.93);
      g.stroke();
      break;
    }
    case 'stencil':
      worldText(g, d.text ?? '', 0, 0, 0.9, 'rgba(35,32,29,0.55)');
      break;
    default:
      break;
  }
  g.restore();
}

/** The directional finish gate. */
export function drawFinish(g: CanvasRenderingContext2D, level: LevelData, tex: TextureBank) {
  const f = level.finish;
  const top = f.y + Math.min(f.h, 7);
  post(g, f.x, f.y, top - f.y, 0.2, INK.soot);
  g.fillStyle = tex.surface('steel');
  g.fillRect(f.x - 0.1, top, 0.2, 0.2);
  g.fillStyle = INK.cream;
  g.beginPath();
  g.moveTo(f.x, top - 0.1);
  g.lineTo(f.x + 1.6, top - 0.1);
  g.lineTo(f.x + 2.05, top - 0.55);
  g.lineTo(f.x + 1.6, top - 1);
  g.lineTo(f.x, top - 1);
  g.closePath();
  g.fill();
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.06;
  g.stroke();
  worldText(g, 'SHIFT', f.x + 0.85, top - 0.76, 0.5, INK.charcoal);
}

export function drawCheckpoint(g: CanvasRenderingContext2D, level: LevelData, active: boolean) {
  const c = level.checkpoint;
  if (!c) return;
  post(g, c.x, c.y, 2.5, 0.14, INK.soot);
  g.beginPath();
  g.arc(c.x, c.y + 2.65, 0.26, 0, Math.PI * 2);
  g.fillStyle = active ? INK.amber : INK.steelDark;
  g.fill();
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.05;
  g.stroke();
  worldText(g, 'CHECK', c.x + 0.25, c.y + 1.6, 0.34, INK.charcoal, 'left');
}

export function drawTag(g: CanvasRenderingContext2D, x: number, y: number, t: number) {
  const bob = Math.sin(t * 2.4) * 0.07;
  g.save();
  g.translate(x, y + bob);
  g.rotate(Math.sin(t * 1.3) * 0.12);
  // Hung by one bolt, the way these always are.
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.03;
  g.beginPath();
  g.moveTo(0, 0.42);
  g.lineTo(0, 0.7);
  g.stroke();
  g.fillStyle = INK.cream;
  g.beginPath();
  g.roundRect(-0.46, -0.32, 0.92, 0.74, 0.08);
  g.fill();
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.06;
  g.stroke();
  g.strokeStyle = INK.teal;
  g.lineWidth = 0.05;
  g.beginPath();
  g.roundRect(-0.36, -0.22, 0.72, 0.54, 0.05);
  g.stroke();
  worldText(g, 'OK', 0, -0.13, 0.42, INK.tealDark);
  g.restore();
}
