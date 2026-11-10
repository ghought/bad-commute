import { hashString } from '../core/math';
import type { Tracked } from '../mechanisms/base';
import { SPIKE_HEIGHT, type Fan, type Mine, type Npc, type Prop, type Spikes, type Spring, type Wrecker } from '../mechanisms/toys';
import type { Simulation } from '../sim/Simulation';
import type { GoreMode } from './effects';
import { INK } from './palette';

const LINE = 0.035;

function pose(track: Tracked | undefined, alpha: number) {
  return track ? track.at(alpha, { x: 0, y: 0, a: 0 }) : null;
}

function ink(g: CanvasRenderingContext2D, width = LINE) {
  g.strokeStyle = INK.charcoal;
  g.lineWidth = width;
  g.lineJoin = 'round';
  g.stroke();
}

function block(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: string, r = 0.03) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  ink(g);
}

function poly(g: CanvasRenderingContext2D, pts: number[], fill: string, stroke = true) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (stroke) ink(g);
}

function disc(g: CanvasRenderingContext2D, x: number, y: number, r: number, fill: string, stroke = true) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fillStyle = fill;
  g.fill();
  if (stroke) ink(g);
}

function label(g: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, color: string) {
  g.save();
  g.translate(x, y);
  g.scale(size / 24, -size / 24);
  g.font = '900 24px "Big Shoulders Display", Impact, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillStyle = color;
  g.fillText(text, 0, 0);
  g.restore();
}

function shade(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, alpha = 0.18) {
  g.fillStyle = `rgba(20,16,12,${alpha})`;
  g.fillRect(x, y, w, h);
}

export function drawProp(g: CanvasRenderingContext2D, sim: Simulation, m: Prop, alpha: number) {
  if (m.gone) return;
  const p = pose(sim.trackOf(m.body), alpha);
  if (!p) return;
  const { w, h } = m.spec;
  const hw = w / 2;
  const hh = h / 2;
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.a);
  switch (m.data.kind) {
    case 'box':
      block(g, -hw, -hh, w, h, '#cfa76b', 0.02);
      shade(g, -hw, -hh, w * 0.28, h);
      g.fillStyle = '#e6cf9c';
      g.fillRect(-0.07, -hh + 0.02, 0.14, h - 0.04);
      poly(g, [-hw, hh, -hw + 0.05, hh + 0.07, hw - 0.05, hh + 0.07, hw, hh], '#b98f55');
      label(g, 'FRAGILE', hw * 0.5, -hh * 0.45, 0.11, '#8a3a22');
      break;
    case 'crate':
      block(g, -hw, -hh, w, h, '#a8743c', 0.02);
      g.strokeStyle = '#6f4720';
      g.lineWidth = 0.03;
      g.beginPath();
      for (let y = -hh + h / 4; y < hh - 0.01; y += h / 4) {
        g.moveTo(-hw, y);
        g.lineTo(hw, y);
      }
      g.stroke();
      g.beginPath();
      g.moveTo(-hw + 0.06, -hh + 0.06);
      g.lineTo(hw - 0.06, hh - 0.06);
      g.moveTo(-hw + 0.06, hh - 0.06);
      g.lineTo(hw - 0.06, -hh + 0.06);
      g.strokeStyle = '#7d5226';
      g.lineWidth = 0.1;
      g.stroke();
      g.beginPath();
      g.rect(-hw, -hh, w, h);
      ink(g, 0.05);
      break;
    case 'cone':
      poly(g, [-hw - 0.04, -hh, hw + 0.04, -hh, hw + 0.04, -hh + 0.07, -hw - 0.04, -hh + 0.07], '#2b2725');
      poly(g, [-hw + 0.02, -hh + 0.07, hw - 0.02, -hh + 0.07, 0.05, hh, -0.05, hh], '#f2761b');
      poly(g, [-hw + 0.085, -hh + 0.26, hw - 0.085, -hh + 0.26, hw - 0.115, -hh + 0.38, -hw + 0.115, -hh + 0.38], '#fff6e6', false);
      break;
    case 'barrel':
    case 'tnt': {
      const red = m.data.kind === 'tnt';
      block(g, -hw, -hh, w, h, red ? '#d5311f' : '#3f7fa6', 0.07);
      shade(g, -hw, -hh, w * 0.26, h);
      g.fillStyle = 'rgba(255,255,255,0.22)';
      g.fillRect(hw - 0.17, -hh + 0.05, 0.07, h - 0.1);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.03;
      g.beginPath();
      g.moveTo(-hw, hh * 0.38);
      g.lineTo(hw, hh * 0.38);
      g.moveTo(-hw, -hh * 0.38);
      g.lineTo(hw, -hh * 0.38);
      g.stroke();
      if (red) {
        poly(g, [0, 0.22, 0.2, 0, 0, -0.22, -0.2, 0], '#f7cf2e');
        label(g, '!', 0, -0.01, 0.3, INK.charcoal);
      }
      break;
    }
    case 'cooler':
      block(g, -hw, -hh, w, h * 0.56, '#f1ead8', 0.03);
      shade(g, -hw, -hh, w * 0.3, h * 0.56, 0.12);
      block(g, -0.05, -hh + h * 0.3, 0.1, 0.08, '#3f7fa6', 0.01);
      block(g, -hw + 0.04, -hh + h * 0.56, w - 0.08, h * 0.4, '#8fd0ec', 0.1);
      g.fillStyle = 'rgba(255,255,255,0.5)';
      g.fillRect(hw - 0.14, -hh + h * 0.62, 0.04, h * 0.26);
      block(g, -0.07, hh - 0.06, 0.14, 0.06, '#3f7fa6', 0.01);
      break;
    case 'cart':
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.05;
      g.beginPath();
      g.moveTo(-hw - 0.08, hh);
      g.lineTo(-hw + 0.06, hh - 0.04);
      g.stroke();
      poly(g, [-hw + 0.04, hh - 0.04, hw, hh - 0.04, hw - 0.12, -hh + 0.2, -hw + 0.14, -hh + 0.2], '#c9d2d0');
      g.strokeStyle = '#5c6664';
      g.lineWidth = 0.02;
      g.beginPath();
      for (let x = -hw + 0.2; x < hw - 0.1; x += 0.13) {
        g.moveTo(x, hh - 0.05);
        g.lineTo(x * 0.86, -hh + 0.2);
      }
      g.moveTo(-hw + 0.08, 0.06);
      g.lineTo(hw - 0.06, 0.06);
      g.stroke();
      disc(g, -hw + 0.2, -hh + 0.09, 0.09, '#2b2725');
      disc(g, hw - 0.2, -hh + 0.09, 0.09, '#2b2725');
      break;
    case 'chair':
      block(g, -hw + 0.02, 0.02, 0.1, hh - 0.04, '#3b4a9a', 0.04);
      block(g, -hw + 0.02, -0.08, w - 0.08, 0.13, '#4a5cc0', 0.05);
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.06;
      g.beginPath();
      g.moveTo(0, -0.08);
      g.lineTo(0, -hh + 0.1);
      g.moveTo(-hw + 0.02, -hh + 0.1);
      g.lineTo(hw - 0.02, -hh + 0.1);
      g.stroke();
      disc(g, -hw + 0.06, -hh + 0.06, 0.06, '#2b2725');
      disc(g, hw - 0.06, -hh + 0.06, 0.06, '#2b2725');
      break;
    case 'bin':
      poly(g, [-hw + 0.05, -hh, hw - 0.05, -hh, hw, hh - 0.08, -hw, hh - 0.08], '#7c8a86');
      g.strokeStyle = '#55615e';
      g.lineWidth = 0.025;
      g.beginPath();
      for (let x = -hw + 0.14; x < hw - 0.1; x += 0.11) {
        g.moveTo(x, -hh + 0.05);
        g.lineTo(x * 1.08, hh - 0.12);
      }
      g.stroke();
      block(g, -hw - 0.03, hh - 0.09, w + 0.06, 0.09, '#5f6b68', 0.03);
      break;
    default:
      disc(g, 0, 0, hw, '#e0489b');
      g.fillStyle = 'rgba(255,255,255,0.45)';
      g.beginPath();
      g.ellipse(-hw * 0.34, hw * 0.4, hw * 0.24, hw * 0.13, -0.6, 0, Math.PI * 2);
      g.fill();
      g.strokeStyle = '#a82b6d';
      g.lineWidth = 0.03;
      g.beginPath();
      g.arc(0, 0, hw * 0.62, 0.4, 2.2);
      g.stroke();
  }
  g.restore();
}

export function drawMine(g: CanvasRenderingContext2D, m: Mine, time: number) {
  if (m.gone) return;
  const { x, y } = m.data;
  g.save();
  g.translate(x, y);
  poly(g, [-0.42, 0, -0.3, 0.14, 0.3, 0.14, 0.42, 0], '#4a4f3d');
  g.beginPath();
  g.arc(0, 0.14, 0.2, 0, Math.PI);
  g.fillStyle = '#5d644b';
  g.fill();
  ink(g);
  const on = Math.floor(time * 5) % 2 === 0;
  disc(g, 0, 0.36, on ? 0.075 : 0.055, on ? '#ff3b2f' : '#6b1712');
  if (on) {
    g.globalAlpha = 0.25;
    disc(g, 0, 0.36, 0.2, '#ff3b2f', false);
    g.globalAlpha = 1;
  }
  g.restore();
}

export function drawSpring(g: CanvasRenderingContext2D, m: Spring) {
  const d = m.data;
  // Shoots out, then eases back.
  const u = m.since < 0.07 ? m.since / 0.07 : Math.max(0, 1 - (m.since - 0.07) / 0.35);
  const lift = 0.06 + u * 0.75;
  const hw = d.w / 2;
  g.save();
  g.translate(d.x, d.y);
  g.rotate(d.angle ?? 0);
  // Housing sunk into the floor.
  g.fillStyle = INK.charcoal;
  g.fillRect(-hw - 0.08, -0.12, d.w + 0.16, 0.14);
  // Zigzag springs.
  g.strokeStyle = '#9aa3a0';
  g.lineWidth = 0.05;
  g.lineJoin = 'miter';
  for (const sx of [-hw * 0.55, hw * 0.55]) {
    g.beginPath();
    g.moveTo(sx, 0);
    const turns = 5;
    for (let i = 1; i <= turns; i++) g.lineTo(sx + (i % 2 ? 0.14 : -0.14), (lift * i) / turns);
    g.stroke();
  }
  // Plate.
  g.beginPath();
  g.roundRect(-hw, lift - 0.07, d.w, 0.14, 0.04);
  g.fillStyle = '#f7cf2e';
  g.fill();
  ink(g, 0.045);
  g.fillStyle = INK.charcoal;
  for (let x = -hw + 0.18; x < hw - 0.2; x += 0.42) {
    g.beginPath();
    g.moveTo(x, lift - 0.07);
    g.lineTo(x + 0.14, lift - 0.07);
    g.lineTo(x + 0.26, lift + 0.07);
    g.lineTo(x + 0.12, lift + 0.07);
    g.closePath();
    g.fill();
  }
  // A glove, because someone in procurement had a sense of humour.
  g.save();
  g.translate(0, lift + 0.07);
  g.beginPath();
  g.roundRect(-0.17, 0, 0.34, 0.3, 0.12);
  g.fillStyle = '#d5311f';
  g.fill();
  ink(g);
  g.beginPath();
  g.roundRect(-0.27, 0.03, 0.14, 0.18, 0.06);
  g.fill();
  ink(g);
  g.fillStyle = '#fff6e6';
  g.fillRect(-0.15, 0, 0.3, 0.06);
  g.restore();
  g.restore();
}

export function drawFan(g: CanvasRenderingContext2D, m: Fan, time: number) {
  const d = m.data;
  const hw = d.w / 2;
  g.save();
  g.translate(d.x, d.y);
  g.rotate(-(d.angle ?? 0));
  // Draught lines, climbing the column.
  g.lineCap = 'round';
  const lanes = Math.max(3, Math.floor(d.w / 0.9));
  for (let i = 0; i < lanes; i++) {
    const lx = -hw + ((i + 0.5) / lanes) * d.w;
    const phase = (time * 1.4 + i * 0.37) % 1;
    const y0 = phase * d.h;
    const len = 0.9 + (i % 3) * 0.4;
    g.globalAlpha = 0.42 * (1 - phase);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 0.06;
    g.beginPath();
    g.moveTo(lx + Math.sin(time * 3 + i) * 0.08, y0);
    g.lineTo(lx + Math.sin(time * 3 + i + 1) * 0.08, Math.min(d.h, y0 + len));
    g.stroke();
  }
  g.globalAlpha = 1;
  // Housing.
  g.beginPath();
  g.roundRect(-hw - 0.15, -0.5, d.w + 0.3, 0.56, 0.08);
  g.fillStyle = '#4d5a66';
  g.fill();
  ink(g, 0.05);
  g.fillStyle = INK.charcoal;
  g.fillRect(-hw, -0.06, d.w, 0.1);
  // Blades, seen from the side: a row of slats that sweep across.
  const slats = Math.max(4, Math.floor(d.w / 0.5));
  for (let i = 0; i < slats; i++) {
    const u = (i / slats + (m.spin * 0.05) % (1 / slats)) % 1;
    const bx = -hw + u * d.w;
    const wob = Math.abs(Math.sin(m.spin + i * 1.3));
    g.fillStyle = '#c9d2d0';
    g.fillRect(bx, -0.03, 0.1 + wob * 0.22, 0.07);
  }
  // Grille.
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.025;
  g.beginPath();
  for (let x = -hw; x <= hw + 0.01; x += 0.3) {
    g.moveTo(x, -0.06);
    g.lineTo(x, 0.06);
  }
  g.stroke();
  poly(g, [-hw - 0.05, -0.42, -hw + 0.55, -0.42, -hw + 0.55, -0.18, -hw - 0.05, -0.18], '#f7cf2e');
  label(g, 'FAN', -hw + 0.25, -0.3, 0.17, INK.charcoal);
  g.restore();
}

export function drawWrecker(g: CanvasRenderingContext2D, sim: Simulation, m: Wrecker, alpha: number) {
  const d = m.data;
  const p = pose(sim.trackOf(m.body), alpha);
  if (!p) return;
  // Hung from a crane nobody can see the top of.
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.16;
  g.beginPath();
  g.moveTo(d.x, d.y);
  g.lineTo(d.x, d.y + 30);
  g.stroke();
  g.strokeStyle = '#f7cf2e';
  g.lineWidth = 0.08;
  g.stroke();
  block(g, d.x - 0.5, d.y - 0.1, 1, 0.3, '#4d5352', 0.04);
  // Chain.
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.13;
  g.setLineDash([0.22, 0.12]);
  g.beginPath();
  g.moveTo(d.x, d.y);
  g.lineTo(p.x, p.y);
  g.stroke();
  g.strokeStyle = '#9aa3a0';
  g.lineWidth = 0.06;
  g.stroke();
  g.setLineDash([]);
  // Ball.
  g.save();
  g.translate(p.x, p.y);
  disc(g, 0, 0, d.r, '#3b3f44');
  g.lineWidth = 0.06;
  g.stroke();
  g.fillStyle = 'rgba(255,255,255,0.16)';
  g.beginPath();
  g.ellipse(-d.r * 0.35, d.r * 0.4, d.r * 0.3, d.r * 0.16, -0.6, 0, Math.PI * 2);
  g.fill();
  g.fillStyle = 'rgba(0,0,0,0.25)';
  g.beginPath();
  g.arc(0, 0, d.r, Math.PI * 1.05, Math.PI * 1.95);
  g.fill();
  g.rotate(p.a);
  block(g, -0.14, d.r - 0.08, 0.28, 0.2, '#4d5352', 0.03);
  g.restore();
}

export function drawSpikes(g: CanvasRenderingContext2D, m: Spikes, gore: GoreMode, bloody: boolean) {
  const d = m.data;
  const x0 = d.x - d.w / 2;
  const n = Math.max(2, Math.round(d.w / 0.34));
  const step = d.w / n;
  g.fillStyle = INK.charcoal;
  g.fillRect(x0 - 0.06, d.y - 0.04, d.w + 0.12, 0.12);
  for (let i = 0; i < n; i++) {
    const sx = x0 + i * step;
    poly(g, [sx + 0.02, d.y + 0.06, sx + step / 2, d.y + SPIKE_HEIGHT, sx + step - 0.02, d.y + 0.06], '#c9d2d0');
    g.fillStyle = 'rgba(20,16,12,0.22)';
    g.beginPath();
    g.moveTo(sx + 0.02, d.y + 0.06);
    g.lineTo(sx + step / 2, d.y + SPIKE_HEIGHT);
    g.lineTo(sx + step * 0.4, d.y + 0.06);
    g.fill();
    if (bloody && gore === 'full' && i % 2 === 0) {
      g.fillStyle = INK.blood;
      g.beginPath();
      g.moveTo(sx + step / 2, d.y + SPIKE_HEIGHT);
      g.lineTo(sx + step * 0.36, d.y + SPIKE_HEIGHT * 0.55);
      g.lineTo(sx + step * 0.64, d.y + SPIKE_HEIGHT * 0.62);
      g.fill();
    }
  }
}

const SKIN = ['#f0c9a0', '#d9a273', '#a86f47', '#7a4a2c', '#f5d6b8'];

export function drawNpc(g: CanvasRenderingContext2D, sim: Simulation, m: Npc, alpha: number, gore: GoreMode) {
  const facing = m.data.facing ?? -1;
  const look = m.data.look ?? 'inspector';
  const skin = SKIN[hashString(m.id) % SKIN.length];
  const part = (name: 'legs' | 'torso' | 'head' | 'arm', fn: () => void) => {
    const p = pose(sim.trackOf(m.parts.get(name)!), alpha);
    if (!p) return;
    g.save();
    g.translate(p.x, p.y);
    g.rotate(p.a);
    g.scale(facing, 1);
    fn();
    g.restore();
  };
  const top = look === 'inspector' ? '#f2761b' : look === 'manager' ? '#59606b' : '#8fc0e8';

  part('legs', () => {
    block(g, -0.13, -0.36, 0.26, 0.76, look === 'manager' ? '#3a3f47' : '#3d4d63', 0.05);
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.02;
    g.beginPath();
    g.moveTo(0, -0.36);
    g.lineTo(0, 0.2);
    g.stroke();
    block(g, -0.14, -0.41, 0.36, 0.11, '#2b2725', 0.04);
  });
  part('torso', () => {
    block(g, -0.18, -0.3, 0.36, 0.62, top, 0.07);
    if (look === 'inspector') {
      g.fillStyle = '#f7ee9a';
      g.fillRect(-0.17, -0.08, 0.34, 0.07);
      g.fillRect(-0.17, 0.1, 0.34, 0.07);
    } else if (look === 'manager') {
      poly(g, [0.05, 0.3, 0.13, 0.3, 0.11, -0.05, 0.07, -0.12, 0.03, -0.05], '#c8321f');
    } else {
      g.strokeStyle = '#d5311f';
      g.lineWidth = 0.025;
      g.beginPath();
      g.moveTo(-0.02, 0.3);
      g.lineTo(0.08, 0);
      g.stroke();
      block(g, 0.03, -0.1, 0.1, 0.12, '#fff6e6', 0.01);
    }
    if (m.headOff && gore !== 'off') disc(g, 0, 0.33, 0.08, gore === 'full' ? INK.blood : INK.soot);
  });
  part('arm', () => {
    block(g, -0.06, -0.26, 0.12, 0.54, top, 0.05);
    disc(g, 0, -0.29, 0.065, skin);
    if (look === 'inspector') {
      // Clipboard, held like evidence.
      block(g, 0.02, -0.46, 0.24, 0.3, '#8a5a2e', 0.02);
      block(g, 0.04, -0.44, 0.2, 0.24, '#fff6e6', 0.01);
    } else if (look === 'manager') {
      block(g, 0.02, -0.4, 0.12, 0.16, '#fff6e6', 0.03);
    } else {
      block(g, 0.02, -0.42, 0.09, 0.17, '#2b2725', 0.02);
    }
  });
  part('head', () => {
    disc(g, 0, 0, 0.19, skin);
    if (look === 'inspector') {
      g.beginPath();
      g.arc(0, 0.04, 0.2, 0, Math.PI);
      g.closePath();
      g.fillStyle = '#f7cf2e';
      g.fill();
      ink(g);
      block(g, -0.2, 0.01, 0.48, 0.055, '#f7cf2e', 0.02);
    } else {
      g.beginPath();
      g.arc(-0.02, 0.05, 0.19, 0.1, Math.PI * 1.05);
      g.closePath();
      g.fillStyle = look === 'manager' ? '#8c8c8c' : '#5b3a1e';
      g.fill();
      ink(g);
    }
    const shocked = m.disturbed;
    if (m.headOff) {
      g.strokeStyle = INK.charcoal;
      g.lineWidth = 0.025;
      g.beginPath();
      g.moveTo(0.04, -0.01);
      g.lineTo(0.12, -0.08);
      g.moveTo(0.12, -0.01);
      g.lineTo(0.04, -0.08);
      g.stroke();
      if (gore !== 'off') disc(g, -0.02, -0.19, 0.07, gore === 'full' ? INK.blood : INK.soot);
    } else {
      disc(g, 0.08, -0.03, shocked ? 0.06 : 0.035, '#fff6e6', shocked);
      disc(g, 0.09, -0.03, 0.022, INK.charcoal, false);
      if (shocked) disc(g, 0.1, -0.13, 0.04, '#5a1a14');
      else {
        g.strokeStyle = INK.charcoal;
        g.lineWidth = 0.02;
        g.beginPath();
        g.moveTo(0.06, -0.12);
        g.lineTo(0.14, -0.12);
        g.stroke();
      }
    }
  });
}
