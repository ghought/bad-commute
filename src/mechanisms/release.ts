import { Box, Vec2, type Body, type World } from 'planck';
import { lerp, smooth } from '../core/math';
import type { BraceData, BridgeData, CargoData, LatchData, MechanismRestore } from '../levels/schema';
import { Mechanism, type MechContext } from './base';

/** Amber lever. Any contact from the bike trips it, once. */
export class Latch extends Mechanism {
  readonly type = 'latch';
  tripped = false;
  swing = 0;

  constructor(readonly data: LatchData, world: World) {
    super(data.id, world);
    const body = this.kinematic(data.x, data.y);
    this.sensor(body, 0.55);
  }

  struck(_speed: number, ctx: MechContext) {
    if (this.tripped) return;
    this.tripped = true;
    ctx.emit({ t: 'mech', id: this.id, what: 'release', x: this.data.x, y: this.data.y });
    for (const id of this.data.targets) ctx.send(id, true);
  }

  fixedUpdate(ctx: MechContext) {
    if (this.tripped && this.swing < 1) this.swing = Math.min(1, this.swing + ctx.dt * 6);
  }

  restore(state: MechanismRestore) {
    this.tripped = !!state.released;
    this.swing = this.tripped ? 1 : 0;
  }
}

/** A solid strut that gives way to a hard enough hit from the bike. */
export class Brace extends Mechanism {
  readonly type = 'brace';
  broken = false;
  private body: Body | null;
  private pendingRemoval = false;

  constructor(readonly data: BraceData, world: World) {
    super(data.id, world);
    this.body = this.kinematic(data.x, data.y, data.angle ?? 0);
    this.addFixture(this.body, new Box(data.w / 2, data.h / 2), { k: 'machine', id: this.id });
  }

  struck(speed: number, ctx: MechContext) {
    if (this.broken || speed < this.data.minSpeed) return;
    this.broken = true;
    this.pendingRemoval = true;
    ctx.emit({ t: 'mech', id: this.id, what: 'break', x: this.data.x, y: this.data.y });
    for (const id of this.data.targets) ctx.send(id, true);
  }

  fixedUpdate() {}

  flush() {
    if (this.pendingRemoval && this.body) {
      this.world.destroyBody(this.body);
      this.bodies = [];
      this.body = null;
      this.pendingRemoval = false;
    }
  }

  restore(state: MechanismRestore) {
    if (state.released) {
      this.broken = true;
      this.pendingRemoval = true;
      this.flush();
    }
  }
}

/** A hinged span, held up until released, then dropped into place. */
export class Bridge extends Mechanism {
  readonly type = 'bridge';
  body: Body;
  released = false;
  angle: number;
  private rate = 0;
  private landed = false;

  constructor(readonly data: BridgeData, world: World) {
    super(data.id, world);
    this.angle = data.upAngle;
    this.body = this.kinematic(data.x, data.y, data.upAngle);
    this.box(this.body, Math.abs(data.len) / 2, 0.16, data.len / 2, -0.16);
  }

  receive(on: boolean, ctx: MechContext) {
    if (!on || this.released) return;
    this.released = true;
    ctx.emit({ t: 'mech', id: this.id, what: 'clunk', x: this.data.x, y: this.data.y });
  }

  fixedUpdate(ctx: MechContext) {
    const d = this.data;
    if (this.released && !this.landed) {
      this.rate += (d.fall ?? 7) * ctx.dt;
      const dir = Math.sign(d.downAngle - d.upAngle);
      this.angle += dir * this.rate * ctx.dt;
      if ((this.angle - d.downAngle) * dir >= 0) {
        this.angle = d.downAngle;
        this.landed = true;
        this.rate = 0;
        ctx.emit({ t: 'mech', id: this.id, what: 'slam', x: d.x + d.len, y: d.y });
      }
    }
    this.drive(this.body, d.x, d.y, this.angle, ctx.dt);
  }

  restore(state: MechanismRestore) {
    if (state.released) {
      this.released = true;
      this.landed = true;
      this.angle = this.data.downAngle;
      this.body.setAngle(this.angle);
    }
  }
}

/** An authored load that follows a fixed path once released. */
export class Cargo extends Mechanism {
  readonly type = 'cargo';
  body: Body;
  released = false;
  arrived = false;
  private t = 0;

  constructor(readonly data: CargoData, world: World) {
    super(data.id, world);
    const [x, y, a] = data.path[0];
    this.body = this.kinematic(x, y, a);
    this.addFixture(this.body, new Box(data.w / 2, data.h / 2), { k: 'machine', id: this.id });
  }

  private poseAt(u: number) {
    const path = this.data.path;
    const span = u * (path.length - 1);
    const i = Math.min(Math.floor(span), path.length - 2);
    const f = span - i;
    const [x0, y0, a0] = path[i];
    const [x1, y1, a1] = path[i + 1];
    return [lerp(x0, x1, f), lerp(y0, y1, f), lerp(a0, a1, f)] as const;
  }

  receive(on: boolean, ctx: MechContext) {
    if (!on || this.released) return;
    this.released = true;
    const [x, y] = this.data.path[0];
    ctx.emit({ t: 'mech', id: this.id, what: 'clunk', x, y });
  }

  fixedUpdate(ctx: MechContext) {
    const d = this.data;
    if (this.released && !this.arrived) {
      this.t = Math.min(1, this.t + ctx.dt / d.duration);
      if (this.t >= 1) {
        this.arrived = true;
        const [x, y] = d.path[d.path.length - 1];
        ctx.emit({ t: 'mech', id: this.id, what: 'arrive', x, y });
        for (const id of d.targets ?? []) ctx.send(id, true);
      }
    }
    // Loads fall, so progress along the path accelerates.
    const [x, y, a] = this.poseAt(smooth(this.t * this.t * 0.5 + this.t * 0.5));
    this.drive(this.body, x, y, a, ctx.dt);
  }

  restore(state: MechanismRestore) {
    if (state.released) {
      this.released = true;
      this.arrived = true;
      this.t = 1;
      const [x, y, a] = this.data.path[this.data.path.length - 1];
      this.body.setPosition(Vec2(x, y));
      this.body.setAngle(a);
    }
  }
}
