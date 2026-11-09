import type { RiderPartId } from '../sim/filters';
import type { MotorbikeRider } from '../vehicles/motorbike/definition';
import type { GoreMode } from './effects';
import { INK, type RiderPalette } from './palette';

export interface P2 {
  x: number;
  y: number;
  a: number;
}

export interface BikeArtState {
  palette: RiderPalette;
  rider: MotorbikeRider;
  wheelRadius: number;
  rearAnchor: readonly [number, number];
  frontAnchor: readonly [number, number];
  detached: ReadonlySet<RiderPartId>;
  alive: boolean;
  gore: GoreMode;
  ghost: boolean;
  time: number;
  throttle: number;
}

type Poses = (id: string) => P2 | null;

const LINE = 0.028;

function shape(g: CanvasRenderingContext2D, pts: number[], fill: string, stroke = true) {
  g.beginPath();
  g.moveTo(pts[0], pts[1]);
  for (let i = 2; i < pts.length; i += 2) g.lineTo(pts[i], pts[i + 1]);
  g.closePath();
  g.fillStyle = fill;
  g.fill();
  if (stroke) {
    g.strokeStyle = INK.charcoal;
    g.lineWidth = LINE;
    g.stroke();
  }
}

function rrect(g: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number, fill: string) {
  g.beginPath();
  g.roundRect(x, y, w, h, r);
  g.fillStyle = fill;
  g.fill();
  g.strokeStyle = INK.charcoal;
  g.lineWidth = LINE;
  g.stroke();
}

function place(g: CanvasRenderingContext2D, p: P2, fn: () => void) {
  g.save();
  g.translate(p.x, p.y);
  g.rotate(p.a);
  fn();
  g.restore();
}

function wound(g: CanvasRenderingContext2D, x: number, y: number, r: number, mode: GoreMode) {
  if (mode === 'off') return;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  if (mode === 'reduced') {
    g.fillStyle = INK.soot;
    g.fill();
    return;
  }
  g.fillStyle = INK.blood;
  g.fill();
  g.strokeStyle = INK.bloodDark;
  g.lineWidth = LINE * 0.8;
  g.stroke();
  g.beginPath();
  g.arc(x, y, r * 0.42, 0, Math.PI * 2);
  g.fillStyle = INK.bone;
  g.fill();
}

function drawWheel(g: CanvasRenderingContext2D, p: P2, r: number, rim: string) {
  place(g, p, () => {
    g.beginPath();
    g.arc(0, 0, r, 0, Math.PI * 2);
    g.fillStyle = INK.charcoal;
    g.fill();
    g.fillStyle = INK.charcoal;
    for (let i = 0; i < 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      g.save();
      g.rotate(a);
      g.fillRect(r - 0.01, -0.03, 0.04, 0.06);
      g.restore();
    }
    g.beginPath();
    g.arc(0, 0, r * 0.68, 0, Math.PI * 2);
    g.fillStyle = INK.steel;
    g.fill();
    g.beginPath();
    g.arc(0, 0, r * 0.56, 0, Math.PI * 2);
    g.fillStyle = INK.soot;
    g.fill();
    g.strokeStyle = INK.steel;
    g.lineWidth = 0.022;
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      g.beginPath();
      g.moveTo(0, 0);
      g.lineTo(Math.cos(a) * r * 0.6, Math.sin(a) * r * 0.6);
      g.stroke();
    }
    g.beginPath();
    g.arc(0, 0, r * 0.2, 0, Math.PI * 2);
    g.fillStyle = rim;
    g.fill();
    g.strokeStyle = INK.charcoal;
    g.lineWidth = LINE;
    g.stroke();
  });
}

/** An exposed coil, drawn between two world points. */
function coil(g: CanvasRenderingContext2D, x0: number, y0: number, x1: number, y1: number, color: string) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len;
  const ny = dx / len;
  const turns = 7;
  g.beginPath();
  g.moveTo(x0, y0);
  for (let i = 1; i < turns * 2; i++) {
    const t = i / (turns * 2);
    const side = i % 2 ? 0.075 : -0.075;
    g.lineTo(x0 + dx * t + nx * side, y0 + dy * t + ny * side);
  }
  g.lineTo(x1, y1);
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.05;
  g.lineJoin = 'round';
  g.stroke();
  g.strokeStyle = color;
  g.lineWidth = 0.026;
  g.stroke();
}

function worldPoint(p: P2, lx: number, ly: number) {
  const c = Math.cos(p.a);
  const s = Math.sin(p.a);
  return [p.x + lx * c - ly * s, p.y + lx * s + ly * c] as const;
}

function drawChassis(g: CanvasRenderingContext2D, chassis: P2, rear: P2, front: P2, st: BikeArtState) {
  const pal = st.palette;
  // Swingarm and fork first, so the springs sit on top of them.
  const [rax, ray] = worldPoint(chassis, -0.05, -0.08);
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.1;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(rax, ray);
  g.lineTo(rear.x, rear.y);
  g.stroke();
  g.strokeStyle = pal.bikeDark;
  g.lineWidth = 0.05;
  g.stroke();

  const [fx0, fy0] = worldPoint(chassis, 0.47, 0.3);
  g.strokeStyle = INK.charcoal;
  g.lineWidth = 0.09;
  g.beginPath();
  g.moveTo(fx0, fy0);
  g.lineTo(front.x, front.y);
  g.stroke();
  g.strokeStyle = INK.steel;
  g.lineWidth = 0.04;
  g.stroke();

  const [sx, sy] = worldPoint(chassis, -0.38, 0.14);
  coil(g, sx, sy, rear.x + (rax - rear.x) * 0.26, rear.y + (ray - rear.y) * 0.26, INK.amber);
  const midX = front.x + (fx0 - front.x) * 0.2;
  const midY = front.y + (fy0 - front.y) * 0.2;
  coil(g, fx0 + (front.x - fx0) * 0.15, fy0 + (front.y - fy0) * 0.15, midX, midY, INK.amber);

  place(g, chassis, () => {
    // Exhaust.
    g.lineCap = 'round';
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.12;
    g.beginPath();
    g.moveTo(0.12, -0.1);
    g.lineTo(-0.72, -0.05);
    g.stroke();
    g.strokeStyle = INK.steelDark;
    g.lineWidth = 0.07;
    g.stroke();

    // Engine block.
    rrect(g, -0.2, -0.17, 0.42, 0.25, 0.04, INK.steelDark);
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.018;
    for (let y = -0.12; y < 0.06; y += 0.045) {
      g.beginPath();
      g.moveTo(-0.17, y);
      g.lineTo(0.19, y);
      g.stroke();
    }

    // Frame.
    shape(g, [-0.55, 0.05, -0.42, 0.13, 0.5, 0.2, 0.52, 0.32, 0.44, 0.32, 0.16, 0.11, -0.28, 0.02, -0.55, -0.02], INK.soot);

    // Squat, dented tank.
    shape(g, [-0.1, 0.17, -0.05, 0.36, 0.2, 0.42, 0.37, 0.37, 0.41, 0.2, 0.14, 0.1], pal.bike);
    shape(g, [0.0, 0.28, 0.05, 0.36, 0.2, 0.39, 0.3, 0.35, 0.2, 0.3], pal.bikeDark, false);

    // Short seat.
    rrect(g, -0.44, 0.15, 0.4, 0.13, 0.05, INK.soot);

    // Utility rack and a wire crate.
    g.strokeStyle = INK.steel;
    g.lineWidth = 0.025;
    g.strokeRect(-0.82, 0.14, 0.33, 0.22);
    g.beginPath();
    for (let x = -0.76; x < -0.5; x += 0.07) {
      g.moveTo(x, 0.14);
      g.lineTo(x, 0.36);
    }
    g.moveTo(-0.82, 0.25);
    g.lineTo(-0.49, 0.25);
    g.stroke();
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.04;
    g.beginPath();
    g.moveTo(-0.82, 0.13);
    g.lineTo(-0.44, 0.13);
    g.stroke();

    // Crooked headlight on a bent bracket.
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(0.48, 0.3);
    g.lineTo(0.62, 0.34);
    g.stroke();
    g.save();
    g.translate(0.68, 0.36);
    g.rotate(0.42);
    rrect(g, -0.09, -0.1, 0.16, 0.2, 0.03, pal.bikeDark);
    g.beginPath();
    g.ellipse(0.07, 0, 0.035, 0.085, 0, 0, Math.PI * 2);
    g.fillStyle = st.alive ? INK.amber : INK.soot;
    g.fill();
    g.strokeStyle = INK.charcoal;
    g.lineWidth = LINE;
    g.stroke();
    g.restore();

    // Handlebar.
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.05;
    g.beginPath();
    g.moveTo(0.46, 0.31);
    g.lineTo(0.42, 0.52);
    g.lineTo(0.36, 0.55);
    g.stroke();
  });
}

function drawLimb(
  g: CanvasRenderingContext2D,
  p: P2,
  len: number,
  w: number,
  fill: string,
  dark: string,
  end: 'none' | 'glove' | 'boot',
  woundTop: boolean,
  woundBottom: boolean,
  st: BikeArtState,
) {
  place(g, p, () => {
    rrect(g, -w / 2, -len / 2 - 0.02, w, len + 0.04, w * 0.42, fill);
    g.fillStyle = dark;
    g.globalAlpha = 0.5;
    g.fillRect(-w / 2 + 0.01, -len / 2, w * 0.3, len);
    g.globalAlpha = 1;
    if (end === 'glove') {
      rrect(g, -w * 0.62, -len / 2 - 0.09, w * 1.24, 0.13, 0.04, INK.amberDark);
    } else if (end === 'boot') {
      shape(g, [-w * 0.6, -len / 2 + 0.03, w * 0.6, -len / 2 + 0.03, w * 0.75, -len / 2 - 0.05, w * 1.5, -len / 2 - 0.08, w * 1.5, -len / 2 - 0.14, -w * 0.62, -len / 2 - 0.14], INK.charcoal);
    }
    if (woundTop) wound(g, 0, len / 2, w * 0.5, st.gore);
    if (woundBottom) wound(g, 0, -len / 2, w * 0.5, st.gore);
  });
}

function drawTorso(g: CanvasRenderingContext2D, p: P2, st: BikeArtState) {
  const { palette: pal, rider: r } = st;
  const h = r.torsoLength / 2;
  place(g, p, () => {
    // A boxy jacket that has never fitted anyone.
    shape(g, [-0.19, h - 0.02, 0.15, h - 0.01, 0.19, h - 0.2, 0.16, -h, -0.17, -h - 0.02, -0.2, -h + 0.3], pal.jacket);
    shape(g, [-0.19, h - 0.02, -0.08, h - 0.01, -0.09, -h, -0.17, -h - 0.02, -0.2, -h + 0.3], pal.jacketDark, false);
    g.fillStyle = pal.stripe;
    g.fillRect(-0.195, -0.06, 0.37, 0.065);
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.012;
    g.strokeRect(-0.195, -0.06, 0.37, 0.065);
    g.lineWidth = 0.02;
    g.strokeRect(0.02, -0.24, 0.11, 0.11);
    // Collar.
    rrect(g, -0.1, h - 0.05, 0.2, 0.08, 0.03, pal.jacketDark);
    if (st.detached.has('head')) wound(g, 0, h + 0.03, 0.08, st.gore);
  });
}

function drawHead(g: CanvasRenderingContext2D, p: P2, st: BikeArtState) {
  const pal = st.palette;
  const flash = st.alive && Math.floor(st.time * 3.5) % 2 === 0;
  place(g, p, () => {
    // Work beacon on top, the rider's one piece of safety equipment.
    g.fillStyle = INK.charcoal;
    g.fillRect(-0.05, 0.16, 0.1, 0.05);
    g.beginPath();
    g.arc(0, 0.21, 0.058, 0, Math.PI);
    g.closePath();
    g.scale(1, -1);
    g.scale(1, -1);
    g.beginPath();
    g.ellipse(0, 0.22, 0.056, 0.06, 0, 0, Math.PI * 2);
    g.fillStyle = flash ? INK.amber : INK.amberDark;
    g.fill();
    g.strokeStyle = INK.charcoal;
    g.lineWidth = LINE;
    g.stroke();

    // Full-face shell with a square jaw.
    shape(g, [-0.17, 0.09, -0.11, 0.17, 0.08, 0.175, 0.17, 0.09, 0.2, -0.05, 0.2, -0.16, -0.02, -0.17, -0.17, -0.12], pal.helmet);
    shape(g, [-0.17, 0.09, -0.11, 0.17, -0.05, 0.17, -0.09, -0.16, -0.17, -0.12], pal.helmetDark, false);
    // Visor slit.
    shape(g, [0.03, 0.08, 0.185, 0.08, 0.205, -0.03, 0.03, -0.03], INK.charcoal, false);
    g.fillStyle = INK.teal;
    g.globalAlpha = 0.55;
    g.fillRect(0.06, 0.04, 0.09, 0.02);
    g.globalAlpha = 1;
    // Chin vents.
    g.strokeStyle = INK.charcoal;
    g.lineWidth = 0.016;
    for (let x = 0.07; x < 0.18; x += 0.04) {
      g.beginPath();
      g.moveTo(x, -0.09);
      g.lineTo(x, -0.14);
      g.stroke();
    }
    if (st.detached.has('head')) wound(g, -0.02, -0.18, 0.075, st.gore);
  });
}

function arePartsDrawn(st: BikeArtState, part: RiderPartId) {
  // With gore off, a detached limb simply is not shown.
  return !(st.gore === 'off' && st.detached.has(part));
}

/** Draws the whole bike and rider from a pose source, so ghosts share the art. */
export function drawMotorbike(g: CanvasRenderingContext2D, poses: Poses, st: BikeArtState) {
  const chassis = poses('chassis');
  const rear = poses('wheel0') ?? poses('rear');
  const front = poses('wheel1') ?? poses('front');
  if (!chassis || !rear || !front) return;
  const pal = st.palette;
  const r = st.rider;

  const limb = (
    upper: RiderPartId,
    lower: RiderPartId,
    upperLen: number,
    lowerLen: number,
    uw: number,
    lw: number,
    fill: string,
    dark: string,
    end: 'glove' | 'boot',
    far: boolean,
  ) => {
    const pu = poses(upper);
    const pl = poses(lower);
    if (far) g.globalAlpha = (st.ghost ? 0.45 : 1) * 0.92;
    const upperGone = st.detached.has(upper);
    const lowerGone = st.detached.has(lower);
    if (pu && arePartsDrawn(st, upper)) {
      drawLimb(g, pu, upperLen, uw, far ? dark : fill, dark, 'none', upperGone, lowerGone && !upperGone, st);
    }
    if (pl && arePartsDrawn(st, lower)) {
      drawLimb(g, pl, lowerLen, lw, far ? dark : fill, dark, end, lowerGone, false, st);
    }
    if (far) g.globalAlpha = st.ghost ? 0.45 : 1;
  };

  const armColor = pal.jacket;
  const armDark = pal.jacketDark;
  const legColor = pal.trousers;
  const legDark = pal.trousersDark;

  limb('armUpperF', 'armLowerF', r.armUpper, r.armLower, 0.1, 0.09, armColor, armDark, 'glove', true);
  limb('legUpperF', 'legLowerF', r.legUpper, r.legLower, 0.15, 0.12, legColor, legDark, 'boot', true);

  drawWheel(g, rear, st.wheelRadius, pal.bike);
  drawWheel(g, front, st.wheelRadius, pal.bike);
  drawChassis(g, chassis, rear, front, st);

  limb('legUpperN', 'legLowerN', r.legUpper, r.legLower, 0.16, 0.13, legColor, legDark, 'boot', false);

  const torso = poses('torso');
  if (torso) {
    drawTorso(g, torso, st);
    if (st.detached.has('armUpperN')) place(g, torso, () => wound(g, -0.02, r.torsoLength / 2 - 0.04, 0.07, st.gore));
    if (st.detached.has('legUpperN')) place(g, torso, () => wound(g, 0, -r.torsoLength / 2, 0.08, st.gore));
  }
  const head = poses('head');
  if (head) drawHead(g, head, st);
  limb('armUpperN', 'armLowerN', r.armUpper, r.armLower, 0.11, 0.095, armColor, armDark, 'glove', false);
}
