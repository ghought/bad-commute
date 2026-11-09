import { Vec2, type Body, type World } from 'planck';
import { clamp, lerp, smooth } from '../core/math';
import type { CounterweightData, MechanismRestore, TiltData } from '../levels/schema';
import { Mechanism, type MechContext } from './base';

const PLATE_DEPTH = 0.32;

/**
 * Counterweight: a plate the bike's weight pushes down, linked to a ramp that
 * rises in step. Holds briefly when the bike leaves, then sinks back, so the
 * moment of departure sets the angle available.
 */
export class Counterweight extends Mechanism {
  readonly type = 'counterweight';
  plate: Body;
  ramp: Body | null = null;
  p = 0;
  private hold = 0;
  private wasLoaded = false;
  private signalled = false;
  /** Set when a released load is sitting on the plate instead of the bike. */
  private forced = false;

  constructor(readonly data: CounterweightData, world: World) {
    super(data.id, world);
    this.plate = this.kinematic(data.x, data.y);
    this.box(this.plate, data.w / 2, PLATE_DEPTH / 2, 0, -PLATE_DEPTH / 2);
    if (data.ramp) {
      const r = data.ramp;
      this.ramp = this.kinematic(r.x, r.y, r.a0);
      this.box(this.ramp, Math.abs(r.len) / 2, 0.14, r.len / 2, -0.14);
    }
  }

  fixedUpdate(ctx: MechContext) {
    const d = this.data;
    const loaded = this.forced || ctx.loadOf(this.id) > 0;
    if (loaded) {
      if (!this.wasLoaded && !this.forced) {
        // Hitting the plate hard buys some travel straight away.
        this.p = clamp(this.p + ctx.bike().speed * 0.018, 0, 1);
        ctx.emit({ t: 'mech', id: this.id, what: 'clunk', x: d.x, y: d.y });
      }
      this.p = clamp(this.p + (d.down ?? 0.9) * ctx.dt, 0, 1);
      this.hold = d.hold ?? 1.2;
    } else if (this.hold > 0) {
      this.hold -= ctx.dt;
    } else {
      this.p = clamp(this.p - (d.up ?? 0.35) * ctx.dt, 0, 1);
    }
    this.wasLoaded = loaded;

    const t = smooth(this.p);
    this.drive(this.plate, d.x, d.y - d.travel * t, 0, ctx.dt);
    if (this.ramp && d.ramp) this.drive(this.ramp, d.ramp.x, d.ramp.y, lerp(d.ramp.a0, d.ramp.a1, t), ctx.dt);

    const on = this.p >= (d.threshold ?? 0.8);
    if (on !== this.signalled) {
      this.signalled = on;
      for (const id of d.targets ?? []) ctx.send(id, on);
    }
  }

  receive(on: boolean) {
    this.forced = on;
  }

  restore(state: MechanismRestore) {
    this.forced = !!state.released;
    this.p = clamp(state.phase ?? (state.released ? 1 : 0), 0, 1);
    const t = smooth(this.p);
    const d = this.data;
    this.hold = this.p > 0 ? 6 : 0;
    this.plate.setPosition(Vec2(d.x, d.y - d.travel * t));
    if (this.ramp && d.ramp) this.ramp.setAngle(lerp(d.ramp.a0, d.ramp.a1, t));
  }
}

/** A beam on a pivot, tipped by which side of the pivot the bike is on. */
export class Tilt extends Mechanism {
  readonly type = 'tilt';
  beam: Body;
  angle: number;

  constructor(readonly data: TiltData, world: World) {
    super(data.id, world);
    this.angle = data.initial;
    this.beam = this.kinematic(data.x, data.y, data.initial);
    const len = data.left + data.right;
    const depth = data.style === 'container' ? 1.1 : 0.32;
    this.box(this.beam, len / 2, depth / 2, (data.right - data.left) / 2, -depth / 2);
  }

  fixedUpdate(ctx: MechContext) {
    const d = this.data;
    if (ctx.loadOf(this.id) > 0) {
      // Left of the pivot pushes the left end down, which is a positive rotation.
      const lever = clamp((d.x - ctx.bike().x) / Math.max(d.left, d.right), -1, 1);
      this.angle = clamp(this.angle + lever * d.rate * ctx.dt, d.minA, d.maxA);
    } else if (d.returnRate) {
      const step = d.returnRate * ctx.dt;
      this.angle += clamp(d.initial - this.angle, -step, step);
    }
    this.drive(this.beam, d.x, d.y, this.angle, ctx.dt);
  }

  restore(state: MechanismRestore) {
    this.angle = state.phase ?? this.data.initial;
    this.beam.setAngle(this.angle);
  }
}

