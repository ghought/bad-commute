import type { Mechanism, Tracked } from '../mechanisms/base';
import type { Compactor, Conveyor, Cutter, Lift, Shutter, Swing, Counterweight, Tilt, Brace, Bridge, Cargo, Latch } from '../mechanisms';
import type { Simulation } from '../sim/Simulation';
import { INK } from './palette';
import type { TextureBank } from './textures';
import { worldText } from './worldArt';

const tmp = { x: 0, y: 0, a: 0 };

function at(track: Tracked | undefined, alpha: number) {
  if (!track) return null;
  return track.at(alpha, { ...tmp });
}

function outlineRect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, fill: CanvasPattern | string, width = 0.06) {
  g.fillStyle = fill;
  g.fillRect(x, y, w, h);
  g.strokeStyle = INK.charcoal;
  g.lineWidth = width;
  g.strokeRect(x, y, w, h);
}

/** Bright top edge: every surface you can ride has one. */
function rideEdge(g: CanvasRenderingContext2D, x0: number, x1: number, y: number) {
  g.lineCap = 'round';
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.13;
  g.beginPath();
  g.moveTo(x0, y);
  g.lineTo(x1, y);
  g.stroke();
  g.strokeStyle = INK.cream;
  g.lineWidth = 0.05;
  g.stroke();
}

function drawCounterweight(g: CanvasRenderingContext2D, sim: Simulation, m: Counterweight, tex: TextureBank, alpha: number) {
  const d = m.data;
  const plate = at(sim.trackOf(m.plate), alpha)!;
  // The cable makes the link between plate and ramp visible at a glance.
  if (d.ramp && m.ramp) {
    const ramp = at(sim.trackOf(m.ramp), alpha)!;
    const tipX = ramp.x + Math.cos(ramp.a) * d.ramp.len;
    const tipY = ramp.y + Math.sin(ramp.a) * d.ramp.len;
    const sheaveX = (plate.x + tipX) / 2;
    const sheaveY = Math.max(d.y, tipY) + 3;
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.06;
    g.beginPath();
    g.moveTo(plate.x, plate.y);
    g.lineTo(sheaveX, sheaveY);
    g.lineTo(tipX, tipY);
    g.stroke();
    g.beginPath();
    g.arc(sheaveX, sheaveY, 0.3, 0, Math.PI * 2);
    g.fillStyle = INK.steel;
    g.fill();
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.05;
    g.stroke();
    g.fillStyle = INK.soot;
    g.fillRect(sheaveX - 0.07, sheaveY, 0.14, 8);

    g.save();
    g.translate(ramp.x, ramp.y);
    g.rotate(ramp.a);
    const x0 = Math.min(0, d.ramp.len);
    const w = Math.abs(d.ramp.len);
    outlineRect(g, x0, -0.28, w, 0.28, d.ramp.style === 'bridge' ? tex.surface('plank') : tex.surface('steel'));
    rideEdge(g, x0, x0 + w, 0);
    g.restore();
  }
  g.save();
  g.translate(plate.x, plate.y);
  outlineRect(g, -d.w / 2, -0.32, d.w, 0.32, tex.surface('steel'));
  g.fillStyle = INK.teal;
  g.fillRect(-d.w / 2 + 0.2, -0.26, d.w - 0.4, 0.14);
  rideEdge(g, -d.w / 2, d.w / 2, 0);
  worldText(g, 'LOAD', 0, -0.25, 0.2, INK.cream);
  g.restore();
}

function drawTilt(g: CanvasRenderingContext2D, sim: Simulation, m: Tilt, alpha: number) {
  const d = m.data;
  const p = at(sim.trackOf(m.beam), alpha)!;
  const container = d.style === 'container';
  const depth = container ? 1.1 : 0.32;
  g.save();
  g.translate(p.x, p.y);
  // Pivot stand, fixed to the world.
  g.fillStyle = INK.soot;
  g.beginPath();
  g.moveTo(-0.5, -depth - 1.4);
  g.lineTo(0.5, -depth - 1.4);
  g.lineTo(0.15, -depth + 0.1);
  g.lineTo(-0.15, -depth + 0.1);
  g.closePath();
  g.fill();
  g.rotate(p.a);
  const x0 = -d.left;
  const w = d.left + d.right;
  outlineRect(g, x0, -depth, w, depth, container ? INK.tealDark : INK.oxide);
  g.strokeStyle = INK.charcoal;
  g.lineWidth = container ? 0.05 : 0.035;
  g.beginPath();
  const step = container ? 0.45 : 0.6;
  for (let x = x0 + step; x < x0 + w; x += step) {
    g.moveTo(x, 0);
    g.lineTo(x - (container ? 0 : step / 2), -depth);
  }
  g.stroke();
  rideEdge(g, x0, x0 + w, 0);
  g.beginPath();
  g.arc(0, -depth / 2, 0.16, 0, Math.PI * 2);
  g.fillStyle = INK.steel;
  g.fill();
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.05;
  g.stroke();
  g.restore();
}

function drawLatch(g: CanvasRenderingContext2D, m: Latch) {
  const d = m.data;
  g.save();
  g.translate(d.x, d.y);
  // Post down to the deck.
  g.fillStyle = INK.soot;
  g.fillRect(-0.07, -1.3, 0.14, 1.3);
  g.rotate(-m.swing * 1.5);
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.22;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(0, 0);
  g.lineTo(-0.1, 0.75);
  g.stroke();
  g.strokeStyle = INK.amber;
  g.lineWidth = 0.13;
  g.stroke();
  // The amber diamond means: hit this.
  g.translate(-0.1, 0.8);
  g.rotate(Math.PI / 4);
  outlineRect(g, -0.26, -0.26, 0.52, 0.52, m.tripped ? INK.amberDark : INK.amber, 0.06);
  g.restore();
}

function drawBrace(g: CanvasRenderingContext2D, m: Brace) {
  if (m.broken) return;
  const d = m.data;
  g.save();
  g.translate(d.x, d.y);
  g.rotate(d.angle ?? 0);
  outlineRect(g, -d.w / 2, -d.h / 2, d.w, d.h, INK.amber);
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.06;
  g.beginPath();
  for (let y = -d.h / 2; y < d.h / 2; y += 0.4) {
    g.moveTo(-d.w / 2, y);
    g.lineTo(d.w / 2, y + 0.25);
  }
  g.stroke();
  g.restore();
}

function drawBridge(g: CanvasRenderingContext2D, sim: Simulation, m: Bridge, tex: TextureBank, alpha: number) {
  const d = m.data;
  const p = at(sim.trackOf(m.body), alpha)!;
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.a);
  const x0 = Math.min(0, d.len);
  const w = Math.abs(d.len);
  outlineRect(g, x0, -0.32, w, 0.32, tex.surface('plank'));
  rideEdge(g, x0, x0 + w, 0);
  g.restore();
  g.beginPath();
  g.arc(p.x, p.y - 0.16, 0.2, 0, Math.PI * 2);
  g.fillStyle = INK.steel;
  g.fill();
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.05;
  g.stroke();
}

function drawConveyor(g: CanvasRenderingContext2D, m: Conveyor, tex: TextureBank) {
  const d = m.data;
  const x0 = d.x - d.w / 2;
  outlineRect(g, x0, d.y - 0.5, d.w, 0.5, tex.surface('steel'));
  g.fillStyle = INK.soot;
  g.fillRect(x0, d.y - 0.14, d.w, 0.14);
  // Chevrons travel with the belt and show which way it runs.
  const dir = m.speed >= 0 ? 1 : -1;
  const spacing = 0.9;
  const offset = ((m.travel % spacing) + spacing) % spacing;
  g.strokeStyle = INK.teal;
  g.lineWidth = 0.05;
  g.beginPath();
  for (let x = x0 - spacing + offset; x < x0 + d.w; x += spacing) {
    if (x < x0 + 0.1 || x > x0 + d.w - 0.3) continue;
    g.moveTo(x - dir * 0.1, d.y - 0.11);
    g.lineTo(x + dir * 0.08, d.y - 0.06);
    g.lineTo(x - dir * 0.1, d.y - 0.01);
  }
  g.stroke();
  g.fillStyle = INK.steel;
  for (let x = x0 + 0.4; x < x0 + d.w; x += 1.1) {
    g.beginPath();
    g.arc(x, d.y - 0.32, 0.11, 0, Math.PI * 2);
    g.fill();
  }
  rideEdge(g, x0, x0 + d.w, d.y);
}

function drawLift(g: CanvasRenderingContext2D, sim: Simulation, m: Lift, tex: TextureBank, alpha: number) {
  const d = m.data;
  const p = at(sim.trackOf(m.body), alpha)!;
  // The rail shows the whole path, so the far stop is never a surprise.
  g.strokeStyle = 'rgba(35,32,29,0.55)';
  g.lineWidth = 0.1;
  g.setLineDash([0.3, 0.2]);
  g.beginPath();
  g.moveTo(d.ax, d.ay - 0.16);
  g.lineTo(d.bx, d.by - 0.16);
  g.stroke();
  g.setLineDash([]);

  g.save();
  g.translate(p.x, p.y);
  if (d.style === 'fork') {
    // A moving fork carriage: masts behind, tines under the deck.
    g.fillStyle = INK.amberDark;
    g.fillRect(-d.w / 2 - 0.4, -0.5, 0.4, 2.3);
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.05;
    g.strokeRect(-d.w / 2 - 0.4, -0.5, 0.4, 2.3);
    outlineRect(g, -d.w / 2, -0.32, d.w, 0.32, INK.steelDark);
    g.fillStyle = INK.amber;
    g.fillRect(-d.w / 2 + 0.1, -0.24, d.w - 0.2, 0.08);
  } else if (d.style === 'cradle') {
    outlineRect(g, -d.w / 2, -0.32, d.w, 0.32, tex.surface('plank'));
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(-d.w / 2 + 0.2, 0);
    g.lineTo(0, 3.4);
    g.lineTo(d.w / 2 - 0.2, 0);
    g.moveTo(0, 3.4);
    g.lineTo(0, 20);
    g.stroke();
  } else {
    outlineRect(g, -d.w / 2, -0.32, d.w, 0.32, tex.surface('steel'));
    g.fillStyle = INK.teal;
    g.fillRect(-d.w / 2 + 0.15, -0.24, d.w - 0.3, 0.1);
  }
  rideEdge(g, -d.w / 2, d.w / 2, 0);
  if (d.crushFloor !== undefined) {
    g.fillStyle = tex.stripes();
    g.fillRect(-d.w / 2, -0.32, d.w, 0.14);
  }
  g.restore();
}

function drawSwing(g: CanvasRenderingContext2D, sim: Simulation, m: Swing, tex: TextureBank, alpha: number) {
  const d = m.data;
  const p = at(sim.trackOf(m.body), alpha)!;
  const inset = d.w / 2 - 0.4;
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.09;
  g.beginPath();
  g.moveTo(d.x - inset, d.y);
  g.lineTo(p.x - inset, p.y);
  g.moveTo(d.x + inset, d.y);
  g.lineTo(p.x + inset, p.y);
  g.stroke();
  outlineRect(g, d.x - inset - 0.5, d.y - 0.1, inset * 2 + 1, 0.24, INK.soot);
  g.save();
  g.translate(p.x, p.y);
  outlineRect(g, -d.w / 2, -0.3, d.w, 0.3, tex.surface('plank'));
  rideEdge(g, -d.w / 2, d.w / 2, 0);
  g.restore();
}

function drawShutter(g: CanvasRenderingContext2D, sim: Simulation, m: Shutter, tex: TextureBank, alpha: number) {
  const d = m.data;
  const p = at(sim.trackOf(m.body), alpha)!;
  const bottom = p.y - d.height / 2;
  outlineRect(g, d.x - 0.25, bottom, 0.5, d.height, tex.surface('steel'));
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.025;
  g.beginPath();
  for (let y = bottom + 0.3; y < bottom + d.height; y += 0.3) {
    g.moveTo(d.x - 0.25, y);
    g.lineTo(d.x + 0.25, y);
  }
  g.stroke();
  g.fillStyle = tex.stripes();
  g.fillRect(d.x - 0.25, bottom, 0.5, 0.3);
  // Lamp: green-teal open, red when it is coming down.
  const closing = m.state === 'closing';
  g.beginPath();
  g.arc(d.x - 0.7, d.floor + 3.1, 0.2, 0, Math.PI * 2);
  g.fillStyle = closing ? INK.bloodBright : m.state === 'closed' ? INK.soot : INK.teal;
  g.fill();
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.05;
  g.stroke();
}

function drawCutter(g: CanvasRenderingContext2D, sim: Simulation, m: Cutter, tex: TextureBank, alpha: number) {
  const d = m.data;
  const p = at(sim.trackOf(m.body), alpha)!;
  if (d.bx !== undefined && d.by !== undefined) {
    g.strokeStyle = 'rgba(35,32,29,0.7)';
    g.lineWidth = 0.14;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(d.x, d.y);
    g.lineTo(d.bx, d.by);
    g.stroke();
  }
  g.save();
  g.translate(p.x, p.y);
  g.rotate(-m.spin);
  g.beginPath();
  const teeth = 14;
  for (let i = 0; i < teeth; i++) {
    const a0 = (i / teeth) * Math.PI * 2;
    const a1 = ((i + 0.55) / teeth) * Math.PI * 2;
    const a2 = ((i + 1) / teeth) * Math.PI * 2;
    g.lineTo(Math.cos(a0) * d.r * 0.82, Math.sin(a0) * d.r * 0.82);
    g.lineTo(Math.cos(a1) * d.r, Math.sin(a1) * d.r);
    g.lineTo(Math.cos(a2) * d.r * 0.82, Math.sin(a2) * d.r * 0.82);
  }
  g.closePath();
  g.fillStyle = tex.stripes();
  g.fill();
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.05;
  g.stroke();
  g.beginPath();
  g.arc(0, 0, d.r * 0.26, 0, Math.PI * 2);
  g.fillStyle = INK.steel;
  g.fill();
  g.stroke();
  g.restore();
}

function drawCompactor(g: CanvasRenderingContext2D, sim: Simulation, m: Compactor, tex: TextureBank, alpha: number, time: number) {
  const d = m.data;
  const p = at(sim.trackOf(m.body), alpha)!;
  const bottom = p.y - 0.7;
  const shake = m.stage === 'warn' ? Math.sin(time * 70) * 0.03 : 0;
  // Piston, running up out of frame.
  g.fillStyle = INK.steel;
  g.fillRect(d.x - 0.3, bottom + 1.4, 0.6, 26);
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.06;
  g.strokeRect(d.x - 0.3, bottom + 1.4, 0.6, 26);
  g.save();
  g.translate(shake, 0);
  outlineRect(g, d.x - d.w / 2, bottom + 0.4, d.w, 1, tex.surface('steel'));
  outlineRect(g, d.x - d.w / 2, bottom, d.w, 0.42, tex.stripes());
  g.restore();
  // Floor plate marks exactly where it lands.
  g.fillStyle = tex.stripes();
  g.fillRect(d.x - d.w / 2, d.floor - 0.12, d.w, 0.12);
  // The warning lamp beside the column.
  g.beginPath();
  g.arc(d.x + d.w / 2 + 0.4, d.floor + 3.4, 0.22, 0, Math.PI * 2);
  const lit = m.stage === 'warn' ? Math.floor(time * 10) % 2 === 0 : m.stage === 'slam' || m.stage === 'hold';
  g.fillStyle = lit ? INK.bloodBright : INK.soot;
  g.fill();
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.05;
  g.stroke();
  g.fillStyle = INK.soot;
  g.fillRect(d.x + d.w / 2 + 0.33, d.floor, 0.14, 3.2);
}

function drawCargo(g: CanvasRenderingContext2D, sim: Simulation, m: Cargo, tex: TextureBank, alpha: number) {
  const d = m.data;
  const p = at(sim.trackOf(m.body), alpha)!;
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.a);
  if (d.style === 'sign') {
    outlineRect(g, -d.w / 2, -d.h / 2, d.w, d.h, INK.cream);
    worldText(g, 'OUT OF SERVICE', 0, -d.h / 4, Math.min(d.h * 0.7, d.w / 8), INK.charcoal);
  } else {
    outlineRect(g, -d.w / 2, -d.h / 2, d.w, d.h, tex.surface('plank'));
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(-d.w / 2, -d.h / 2);
    g.lineTo(d.w / 2, d.h / 2);
    g.moveTo(-d.w / 2, d.h / 2);
    g.lineTo(d.w / 2, -d.h / 2);
    g.stroke();
  }
  rideEdge(g, -d.w / 2, d.w / 2, d.h / 2);
  g.restore();
}

export function drawMechanism(g: CanvasRenderingContext2D, sim: Simulation, m: Mechanism, tex: TextureBank, alpha: number, time: number) {
  switch (m.type) {
    case 'counterweight':
      return drawCounterweight(g, sim, m as Counterweight, tex, alpha);
    case 'tilt':
      return drawTilt(g, sim, m as Tilt, alpha);
    case 'latch':
      return drawLatch(g, m as Latch);
    case 'brace':
      return drawBrace(g, m as Brace);
    case 'bridge':
      return drawBridge(g, sim, m as Bridge, tex, alpha);
    case 'conveyor':
      return drawConveyor(g, m as Conveyor, tex);
    case 'lift':
      return drawLift(g, sim, m as Lift, tex, alpha);
    case 'swing':
      return drawSwing(g, sim, m as Swing, tex, alpha);
    case 'shutter':
      return drawShutter(g, sim, m as Shutter, tex, alpha);
    case 'cutter':
      return drawCutter(g, sim, m as Cutter, tex, alpha);
    case 'compactor':
      return drawCompactor(g, sim, m as Compactor, tex, alpha, time);
    case 'cargo':
      return drawCargo(g, sim, m as Cargo, tex, alpha);
    default:
      return undefined;
  }
}

/** World x extent of a mechanism's art, for culling. Machinery is drawn generously. */
export function mechanismReach(m: Mechanism) {
  const d = (m as unknown as { data: Record<string, number> }).data;
  const xs = [d.x, d.ax, d.bx].filter((v) => typeof v === 'number');
  if (m.type === 'cargo') {
    const path = (d as unknown as { path: number[][] }).path;
    for (const q of path) xs.push(q[0]);
  }
  const span = 30;
  return { x0: Math.min(...xs) - span, x1: Math.max(...xs) + span };
}
