import { SIM } from '../config/tuning';
import type { LevelData } from '../levels/schema';
import type { SurfaceMap } from '../levels/surface';
import { backdropFor, type Backdrop } from './background';
import type { Camera } from './camera';
import { Effects, type EffectsQuality, type GoreMode } from './effects';
import { drawMechanism, mechanismReach } from './machineArt';
import { drawMotorbike, type BikeArtState, type P2 } from './motorbikeArt';
import { PALETTES, type RiderPalette } from './palette';
import { TextureBank } from './textures';
import { StaticArt, drawCheckpoint, drawDecor, drawFinish, drawKillRegion, drawTag, type View } from './worldArt';
import type { Simulation } from '../sim/Simulation';
import type { MotorbikeController } from '../vehicles/motorbike/controller';
import type { Tracked } from '../mechanisms/base';
import type { GhostFrame } from '../store/ghost';
import type { DebugOptions } from '../dev/overlay';

export interface RenderSettings {
  gore: GoreMode;
  quality: EffectsQuality;
  reducedMotion: boolean;
  palette: RiderPalette;
}

/** Everything the player sees. It reads the simulation and never changes it. */
export class Renderer {
  readonly g: CanvasRenderingContext2D;
  readonly effects: Effects;
  private tex: TextureBank;
  private art: StaticArt | null = null;
  private backdrop: Backdrop | null = null;
  private width = 1;
  private height = 1;
  private dpr = 1;
  private clock = 0;
  settings: RenderSettings = { gore: 'full', quality: 'high', reducedMotion: false, palette: PALETTES[0] };
  /** Screen transform applied last frame, for tooling. */
  scale = 1;
  debugDraw: DebugOptions | null = null;
  debugPainter: ((g: CanvasRenderingContext2D, sim: Simulation) => void) | null = null;

  constructor(private canvas: HTMLCanvasElement) {
    const g = canvas.getContext('2d', { alpha: false });
    if (!g) throw new Error('Canvas 2D is unavailable');
    this.g = g;
    this.tex = new TextureBank(g);
    this.effects = new Effects(null, 'high');
  }

  resize(cssW: number, cssH: number, dpr: number) {
    this.width = Math.max(1, cssW);
    this.height = Math.max(1, cssH);
    this.dpr = dpr;
    this.canvas.width = Math.round(cssW * dpr);
    this.canvas.height = Math.round(cssH * dpr);
    this.canvas.style.width = `${cssW}px`;
    this.canvas.style.height = `${cssH}px`;
  }

  get aspect() {
    return this.width / this.height;
  }

  setLevel(level: LevelData, surface: SurfaceMap) {
    this.art = new StaticArt(level);
    this.backdrop = backdropFor(level.districtId);
    this.effects.setSurface(surface);
    this.effects.reset();
  }

  private drawBackdrop(cam: Camera) {
    const g = this.g;
    const b = this.backdrop;
    if (!b) return;
    const w = this.canvas.width;
    const h = this.canvas.height;
    g.setTransform(1, 0, 0, 1, 0, 0);
    g.drawImage(b.sky, 0, 0, w, h);
    for (const layer of b.layers) {
      const scale = h / 620;
      const lw = layer.canvas.width * scale;
      const lh = layer.canvas.height * scale;
      const y = h * layer.anchor - lh + (cam.y * layer.factor * scale * 14);
      let x = -((cam.x * 34 * layer.factor * scale) % lw);
      if (x > 0) x -= lw;
      for (; x < w; x += lw) g.drawImage(layer.canvas, x, y, lw, lh);
    }
  }

  private artState(sim: Simulation, v: MotorbikeController): BikeArtState {
    return {
      palette: this.settings.palette,
      rider: v.def.rider,
      wheelRadius: v.def.physics.wheel.radius,
      rearAnchor: v.def.physics.rearAxle,
      frontAnchor: v.def.physics.frontAxle,
      detached: v.detached,
      alive: v.isAlive(),
      gore: this.settings.gore,
      ghost: false,
      time: sim.worldTime,
      throttle: sim.telemetry().throttle,
    };
  }

  draw(sim: Simulation, cam: Camera, alpha: number, dt: number, ghost: GhostFrame | null) {
    this.clock += dt;
    const g = this.g;
    this.drawBackdrop(cam);

    const scale = (this.height / cam.viewH) * this.dpr;
    this.scale = scale;
    const shakeX = cam.shake > 0 ? Math.sin(this.clock * 61) * cam.shake * 0.4 : 0;
    const shakeY = cam.shake > 0 ? Math.cos(this.clock * 47) * cam.shake * 0.4 : 0;
    const cx = this.canvas.width / 2 - (cam.x + shakeX) * scale;
    const cy = this.canvas.height / 2 + (cam.y + shakeY) * scale;
    g.setTransform(scale, 0, 0, -scale, cx, cy);

    const halfW = cam.viewW / 2 + 2;
    const halfH = cam.viewH / 2 + 2;
    const view: View = { x0: cam.x - halfW, x1: cam.x + halfW, y0: cam.y - halfH, y1: cam.y + halfH };
    const level = sim.level;

    for (const d of level.decor) {
      if (d.layer !== 'front' && d.x > view.x0 - 3 && d.x < view.x1 + 3) drawDecor(g, d, this.tex);
    }
    for (const k of level.killRegions) if (k.x1 > view.x0 && k.x0 < view.x1) drawKillRegion(g, k, this.tex);

    this.art?.draw(g, this.tex, view);
    this.effects.drawDecals(g);

    drawFinish(g, level, this.tex);
    drawCheckpoint(g, level, sim.checkpointActive);
    if (!sim.tag) drawTag(g, level.tag.x, level.tag.y, this.clock);

    for (const m of sim.mechanisms) {
      const reach = mechanismReach(m);
      if (reach.x1 < view.x0 || reach.x0 > view.x1) continue;
      drawMechanism(g, sim, m, this.tex, alpha, sim.worldTime);
    }

    if (ghost) this.drawGhost(sim, ghost);
    this.drawVehicle(sim, alpha);

    this.effects.update(dt, SIM.gravity);
    this.effects.draw(g);

    for (const d of level.decor) {
      if (d.layer === 'front' && d.x > view.x0 - 3 && d.x < view.x1 + 3) drawDecor(g, d, this.tex);
    }

    if (this.debugPainter) this.debugPainter(g, sim);
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  private drawVehicle(sim: Simulation, alpha: number) {
    const v = sim.vehicle as MotorbikeController;
    const g = this.g;
    const scratch = new Map<string, P2>();
    const poses = (id: string) => {
      const cached = scratch.get(id);
      if (cached) return cached;
      const t: Tracked | undefined = sim.vehicleTracks.get(id);
      if (!t) return null;
      const out = { x: 0, y: 0, a: 0 };
      t.at(alpha, out);
      scratch.set(id, out);
      return out;
    };
    g.save();
    if (sim.crushed) {
      // Flattened against the floor plate, and left there.
      const c = poses('chassis');
      const floor = c ? c.y - 0.6 : 0;
      g.translate(0, floor);
      g.scale(1.2, 0.24);
      g.translate(0, -floor);
    }
    drawMotorbike(g, poses, this.artState(sim, v));
    g.restore();
  }

  private drawGhost(sim: Simulation, frame: GhostFrame) {
    const g = this.g;
    const v = sim.vehicle as MotorbikeController;
    const poses = (id: string) => frame.get(id) ?? null;
    g.save();
    g.globalAlpha = 0.34;
    drawMotorbike(g, poses, {
      ...this.artState(sim, v),
      detached: new Set(),
      alive: true,
      ghost: true,
      gore: 'off',
    });
    g.restore();
  }
}
