import { Body, Box, Circle, Vec2, World, type Shape } from 'planck';
import { CAT, MASK, type FixtureTag } from '../sim/filters';
import type { SimEvent } from '../sim/events';
import { wrapAngle } from '../core/math';
import type { VehicleTelemetry } from '../vehicles/types';
import type { MechanismRestore } from '../levels/schema';

export interface CrushZone {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}

/** What a mechanism may see and do during its fixed update. */
export interface MechContext {
  dt: number;
  /** How many bike fixtures are resting on this mechanism. Gore never counts. */
  loadOf(id: string): number;
  bike(): VehicleTelemetry;
  send(id: string, on: boolean): void;
  emit(e: SimEvent): void;
  /** Queues a blast. It goes off after `delay` seconds, never inside a contact callback. */
  explode(x: number, y: number, radius: number, delay?: number): void;
}

/** Previous and current pose of one body, for render interpolation. */
export class Tracked {
  x: number;
  y: number;
  a: number;
  px: number;
  py: number;
  pa: number;

  constructor(public body: Body) {
    const p = body.getPosition();
    this.x = this.px = p.x;
    this.y = this.py = p.y;
    this.a = this.pa = body.getAngle();
  }

  capture() {
    this.px = this.x;
    this.py = this.y;
    this.pa = this.a;
    const p = this.body.getPosition();
    this.x = p.x;
    this.y = p.y;
    this.a = this.body.getAngle();
  }

  /** Writes the interpolated pose into `out`. */
  at(alpha: number, out: { x: number; y: number; a: number }) {
    out.x = this.px + (this.x - this.px) * alpha;
    out.y = this.py + (this.y - this.py) * alpha;
    out.a = this.pa + wrapAngle(this.a - this.pa) * alpha;
    return out;
  }
}

export abstract class Mechanism {
  abstract readonly type: string;
  bodies: Body[] = [];

  constructor(
    readonly id: string,
    protected world: World,
  ) {}

  protected kinematic(x: number, y: number, angle = 0) {
    const body = this.world.createBody({ type: 'kinematic', position: Vec2(x, y), angle });
    this.bodies.push(body);
    return body;
  }

  protected addFixture(body: Body, shape: Shape, tag: FixtureTag, friction = 0.9) {
    body.createFixture({
      shape,
      density: 0,
      friction,
      restitution: 0.02,
      filterCategoryBits: CAT.MACHINE,
      filterMaskBits: MASK.MACHINE,
      userData: tag,
    });
  }

  protected box(body: Body, hx: number, hy: number, cx: number, cy: number) {
    this.addFixture(body, new Box(hx, hy, Vec2(cx, cy), 0), { k: 'machine', id: this.id });
  }

  protected sensor(body: Body, r: number) {
    body.createFixture({
      shape: new Circle(r),
      isSensor: true,
      filterCategoryBits: CAT.TRIGGER,
      filterMaskBits: MASK.TRIGGER,
      userData: { k: 'trigger', id: this.id } satisfies FixtureTag,
    });
  }

  /** Moves a kinematic body so it arrives at the pose exactly one step from now. */
  protected drive(body: Body, x: number, y: number, a: number, dt: number) {
    const p = body.getPosition();
    body.setLinearVelocity(Vec2((x - p.x) / dt, (y - p.y) / dt));
    body.setAngularVelocity(wrapAngle(a - body.getAngle()) / dt);
  }

  abstract fixedUpdate(ctx: MechContext): void;

  /** A signal from a latch, brace, plate or cargo. */
  receive(_on: boolean, _ctx: MechContext): void {}

  /** Called when the bike strikes this mechanism's trigger or solid. */
  struck(_speed: number, _ctx: MechContext): void {}

  /** Sets canonical state from a checkpoint, with no animation or events. */
  restore(_state: MechanismRestore): void {}

  crushZone(): CrushZone | null {
    return null;
  }

  /** A blast went off `dist` metres away, inside its radius. */
  blasted(_dist: number, _ctx: MechContext): void {}

  /** Horizontal span this can reach, for culling. Null uses the bodies. */
  reach(): { x0: number; x1: number } | null {
    return null;
  }

  /** Applies world changes that cannot happen during contact callbacks. */
  flush(): void {}
}
