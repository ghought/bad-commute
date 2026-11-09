import { CAMERA } from '../config/tuning';
import { clamp } from '../core/math';
import type { CameraZone } from '../levels/schema';

export interface CameraTarget {
  x: number;
  y: number;
  vx: number;
  speed: number;
}

/** Follows the bike. Pure state, so it can be tested without a canvas. */
export class Camera {
  x = 0;
  y = 0;
  viewH: number = CAMERA.viewHeight;
  aspect = 16 / 9;
  private look = 0;
  shake = 0;

  constructor(
    private zones: CameraZone[],
    private bounds: { x0: number; x1: number; y0: number; y1: number },
    private scale = 1,
  ) {}

  get viewW() {
    return this.viewH * this.aspect;
  }

  private zoneAt(x: number) {
    return this.zones.find((z) => x >= z.x0 && x <= z.x1) ?? null;
  }

  snap(target: CameraTarget) {
    this.look = 0;
    this.viewH = CAMERA.viewHeight * this.scale + (this.zoneAt(target.x)?.zoom ?? 0);
    this.x = this.goalX(target);
    this.y = this.goalY(target, this.zoneAt(target.x));
  }

  private goalX(t: CameraTarget) {
    const anchorOffset = this.viewW * (0.5 - CAMERA.riderAnchor);
    return t.x + anchorOffset + this.look;
  }

  private goalY(t: CameraTarget, zone: CameraZone | null) {
    return zone?.y ?? t.y + this.viewH * 0.17;
  }

  update(dt: number, target: CameraTarget, reducedMotion: boolean) {
    const zone = this.zoneAt(target.x);
    const lookGoal = clamp(target.vx * CAMERA.lookAheadPerSpeed, -2, CAMERA.lookAheadMax) + (zone?.look ?? 0);
    this.look += (lookGoal - this.look) * (1 - Math.exp(-dt * 2.2));

    const speedShare = clamp(target.speed / 22, 0, 1);
    const viewGoal = (CAMERA.viewHeight + CAMERA.speedZoom * speedShare * speedShare) * this.scale + (zone?.zoom ?? 0);
    this.viewH += (viewGoal - this.viewH) * (1 - Math.exp(-dt * CAMERA.zoomRate));

    const gx = this.goalX(target);
    this.x += (gx - this.x) * (1 - Math.exp(-dt * CAMERA.followRate));

    const gy = this.goalY(target, zone);
    const delta = gy - this.y;
    const dead = zone?.y !== undefined ? 0 : CAMERA.verticalDeadZone;
    if (Math.abs(delta) > dead) {
      const toward = delta - Math.sign(delta) * dead;
      this.y += toward * (1 - Math.exp(-dt * CAMERA.verticalRate));
    }

    const halfH = this.viewH / 2;
    this.y = clamp(this.y, this.bounds.y0 + halfH, Math.max(this.bounds.y0 + halfH, this.bounds.y1 - halfH));

    this.shake = reducedMotion ? 0 : Math.max(0, this.shake - dt * 3.5);
  }

  addShake(amount: number) {
    this.shake = Math.min(0.5, this.shake + amount);
  }
}
