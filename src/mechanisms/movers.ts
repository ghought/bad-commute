import { Box, Vec2, type Body, type World } from 'planck';
import { clamp, lerp, smooth } from '../core/math';
import type { ConveyorData, LiftData, MechanismRestore, ShutterData, SwingData } from '../levels/schema';
import { Mechanism, type CrushZone, type MechContext } from './base';

const BELT_DEPTH = 0.5;
const LIFT_CRUSH_GAP = 1.7;

export class Conveyor extends Mechanism {
  readonly type = 'conveyor';
  speed: number;
  /** Visual belt position. */
  travel = 0;

  constructor(readonly data: ConveyorData, world: World) {
    super(data.id, world);
    this.speed = data.speed;
    const body = this.world.createBody({ type: 'static', position: Vec2(data.x, data.y) });
    this.bodies.push(body);
    this.addFixture(
      body,
      new Box(data.w / 2, BELT_DEPTH / 2, Vec2(0, -BELT_DEPTH / 2), 0),
      { k: 'machine', id: this.id, conveyor: () => this.speed },
      1.1,
    );
  }

  receive(on: boolean) {
    if (!on) return;
    if (this.data.onActivate === 'reverse') this.speed = -this.data.speed;
    else if (this.data.onActivate === 'stop') this.speed = 0;
  }

  fixedUpdate(ctx: MechContext) {
    this.travel += this.speed * ctx.dt;
  }

  restore(state: MechanismRestore) {
    if (state.released) this.receive(true);
  }
}

/** A platform shuttling between two stops. */
export class Lift extends Mechanism {
  readonly type = 'lift';
  body: Body;
  t: number;
  started: boolean;
  /** 0 at A, 1 at B. */
  u = 0;
  private previousU = 0;
  private arrived = false;
  private readonly length: number;

  constructor(readonly data: LiftData, world: World) {
    super(data.id, world);
    this.t = data.phase ?? 0;
    this.started = data.mode === 'cycle';
    this.length = Math.hypot(data.bx - data.ax, data.by - data.ay);
    this.body = this.kinematic(data.ax, data.ay);
    this.box(this.body, data.w / 2, 0.16, 0, -0.16);
    this.u = this.progressAt(this.t);
    this.body.setPosition(Vec2(lerp(data.ax, data.bx, this.u), lerp(data.ay, data.by, this.u)));
  }

  private progressAt(t: number) {
    const d = this.data;
    const travel = this.length / d.speed;
    const waitA = d.waitA ?? 1;
    const waitB = d.waitB ?? 1;
    if (d.mode === 'activated') return smooth(clamp(t / travel, 0, 1));
    const period = 2 * travel + waitA + waitB;
    const m = ((t % period) + period) % period;
    if (m < waitA) return 0;
    if (m < waitA + travel) return smooth((m - waitA) / travel);
    if (m < waitA + travel + waitB) return 1;
    return 1 - smooth((m - waitA - travel - waitB) / travel);
  }

  receive(on: boolean, ctx: MechContext) {
    if (!on || this.started) return;
    this.started = true;
    ctx.emit({ t: 'mech', id: this.id, what: 'clunk', x: this.data.ax, y: this.data.ay });
  }

  fixedUpdate(ctx: MechContext) {
    const d = this.data;
    if (this.started) this.t += ctx.dt;
    this.previousU = this.u;
    this.u = this.progressAt(this.t);
    if (d.mode === 'activated' && this.u >= 1 && !this.arrived) {
      this.arrived = true;
      ctx.emit({ t: 'mech', id: this.id, what: 'arrive', x: d.bx, y: d.by });
    }
    this.drive(this.body, lerp(d.ax, d.bx, this.u), lerp(d.ay, d.by, this.u), 0, ctx.dt);
  }

  crushZone(): CrushZone | null {
    const d = this.data;
    if (d.crushFloor === undefined) return null;
    const y = lerp(d.ay, d.by, this.u);
    const gap = y - d.crushFloor;
    const descending = this.previousU !== this.u && (d.by - d.ay) * (this.u - this.previousU) < 0;
    if (!descending || gap > LIFT_CRUSH_GAP) return null;
    const x = lerp(d.ax, d.bx, this.u);
    return { x0: x - d.w / 2, x1: x + d.w / 2, y0: d.crushFloor - 0.5, y1: d.crushFloor + gap };
  }

  restore(state: MechanismRestore) {
    const d = this.data;
    if (state.released) {
      this.started = true;
      this.t = this.length / d.speed;
      this.arrived = true;
    } else if (state.phase !== undefined) {
      this.t = state.phase;
    } else return;
    this.u = this.progressAt(this.t);
    this.body.setPosition(Vec2(lerp(d.ax, d.bx, this.u), lerp(d.ay, d.by, this.u)));
  }
}

/** A level platform hung on parallel arms. Stays flat through its arc. */
export class Swing extends Mechanism {
  readonly type = 'swing';
  body: Body;
  t: number;
  theta = 0;

  constructor(readonly data: SwingData, world: World) {
    super(data.id, world);
    this.t = data.phase ?? 0;
    const [x, y] = this.position();
    this.body = this.kinematic(x, y);
    this.box(this.body, data.w / 2, 0.15, 0, -0.15);
  }

  private position() {
    const d = this.data;
    this.theta = d.amplitude * Math.sin((2 * Math.PI * this.t) / d.period);
    return [d.x + Math.sin(this.theta) * d.rod, d.y - Math.cos(this.theta) * d.rod] as const;
  }

  fixedUpdate(ctx: MechContext) {
    this.t += ctx.dt;
    const [x, y] = this.position();
    this.drive(this.body, x, y, 0, ctx.dt);
  }

  restore(state: MechanismRestore) {
    if (state.phase === undefined) return;
    this.t = state.phase;
    const [x, y] = this.position();
    this.body.setPosition(Vec2(x, y));
  }
}

const SHUTTER_WIDTH = 0.5;
const SHUTTER_CRUSH_GAP = 1.75;

type ShutterState = 'closed' | 'opening' | 'open' | 'closing';

/** A roller door. Solid when closed, lethal if it closes on you. */
export class Shutter extends Mechanism {
  readonly type = 'shutter';
  body: Body;
  state: ShutterState = 'closed';
  /** 0 closed, 1 fully open. */
  open = 0;
  /** Seconds left at the current state's end, for the warning lamp. */
  timer = 0;
  private held = false;
  private cycleT: number;

  constructor(readonly data: ShutterData, world: World) {
    super(data.id, world);
    this.cycleT = data.phase ?? 0;
    this.body = this.kinematic(data.x, data.floor + data.height / 2);
    this.box(this.body, SHUTTER_WIDTH / 2, data.height / 2, 0, 0);
  }

  receive(on: boolean, ctx: MechContext) {
    this.held = on;
    if (on && (this.state === 'closed' || this.state === 'closing')) {
      this.state = 'opening';
      ctx.emit({ t: 'mech', id: this.id, what: 'shutter', x: this.data.x, y: this.data.floor });
    }
  }

  fixedUpdate(ctx: MechContext) {
    const d = this.data;
    const dt = ctx.dt;
    if (d.mode === 'cycle') {
      this.cycleT += dt;
      if (this.state === 'closed' && this.cycleT >= d.holdTime) {
        this.state = 'opening';
        this.cycleT = 0;
        ctx.emit({ t: 'mech', id: this.id, what: 'shutter', x: d.x, y: d.floor });
      }
    }
    switch (this.state) {
      case 'opening':
        this.open = Math.min(1, this.open + dt / d.openTime);
        if (this.open >= 1) {
          this.state = 'open';
          this.timer = d.holdTime;
        }
        break;
      case 'open':
        if (!this.held) this.timer -= dt;
        if (this.timer <= 0) {
          this.state = 'closing';
          ctx.emit({ t: 'mech', id: this.id, what: 'warn', x: d.x, y: d.floor });
        }
        break;
      case 'closing':
        this.open = Math.max(0, this.open - dt / d.closeTime);
        if (this.open <= 0) {
          this.state = 'closed';
          this.cycleT = 0;
          ctx.emit({ t: 'mech', id: this.id, what: 'slam', x: d.x, y: d.floor });
        }
        break;
      default:
        break;
    }
    this.drive(this.body, d.x, this.yAt(this.open), 0, dt);
  }

  private yAt(open: number) {
    return this.data.floor + this.data.height / 2 + this.data.opening * open;
  }

  gap() {
    return this.data.opening * this.open;
  }

  crushZone(): CrushZone | null {
    if (this.state !== 'closing' || this.gap() > SHUTTER_CRUSH_GAP) return null;
    const d = this.data;
    return { x0: d.x - 0.5, x1: d.x + 0.5, y0: d.floor, y1: d.floor + this.gap() + 0.2 };
  }

  restore(state: MechanismRestore) {
    if (state.released) {
      this.state = 'open';
      this.open = 1;
      this.timer = this.data.holdTime;
      this.body.setPosition(Vec2(this.data.x, this.yAt(1)));
    }
  }
}
