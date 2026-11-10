import { AABB, Box, Circle, RevoluteJoint, Vec2, type Body, type Joint, type World } from 'planck';
import { hashString } from '../core/math';
import type { FanData, MineData, NpcData, PropData, PropKind, SpikesData, SpringData, WreckerData } from '../levels/schema';
import { CAT, MASK, type FixtureTag } from '../sim/filters';
import { Mechanism, type MechContext } from './base';

interface PropSpec {
  w: number;
  h: number;
  mass: number;
  /** How much of a collision's speed the rider feels. Cardboard forgives. */
  soft: number;
  /** Contact speed that destroys it. 0 never breaks. */
  breakAt: number;
  friction: number;
  bounce: number;
  round?: boolean;
  explosive?: boolean;
}

export const PROP_SPECS: Record<PropKind, PropSpec> = {
  box: { w: 0.72, h: 0.6, mass: 2.4, soft: 0.2, breakAt: 6.5, friction: 0.5, bounce: 0.1 },
  crate: { w: 0.9, h: 0.9, mass: 13, soft: 0.4, breakAt: 9.5, friction: 0.6, bounce: 0.05 },
  cone: { w: 0.36, h: 0.56, mass: 1.1, soft: 0.15, breakAt: 0, friction: 0.5, bounce: 0.3 },
  barrel: { w: 0.6, h: 0.86, mass: 11, soft: 0.3, breakAt: 0, friction: 0.4, bounce: 0.15 },
  tnt: { w: 0.6, h: 0.86, mass: 11, soft: 0.3, breakAt: 5.5, friction: 0.4, bounce: 0.1, explosive: true },
  cooler: { w: 0.42, h: 1.1, mass: 7, soft: 0.22, breakAt: 5, friction: 0.5, bounce: 0.05 },
  cart: { w: 0.95, h: 0.7, mass: 8, soft: 0.24, breakAt: 0, friction: 0.04, bounce: 0.1 },
  chair: { w: 0.56, h: 0.92, mass: 5.5, soft: 0.22, breakAt: 0, friction: 0.03, bounce: 0.1 },
  bin: { w: 0.5, h: 0.72, mass: 3.5, soft: 0.2, breakAt: 0, friction: 0.45, bounce: 0.2 },
  ball: { w: 0.9, h: 0.9, mass: 1.4, soft: 0.1, breakAt: 0, friction: 0.6, bounce: 0.78, round: true },
};

const BLAST_RADIUS = 4.4;
/** Seconds after its first knock that a loose object stops getting in the way. */
const SPENT_AFTER = 1.5;

/**
 * Stops a body touching anything but the ground. The tag stays as it was, so
 * contacts that are ending still know what they were.
 */
function retire(body: Body) {
  for (let f = body.getFixtureList(); f; f = f.getNext()) {
    f.setFilterData({ groupIndex: 0, categoryBits: CAT.GORE, maskBits: MASK.GORE });
  }
}

/** One loose object. Light enough to plough through, and most of them break. */
export class Prop extends Mechanism {
  readonly type = 'prop';
  body: Body;
  readonly spec: PropSpec;
  gone = false;
  /** True once it has had its moment and only touches the ground. */
  spent = false;
  private spentIn = -1;
  private doomed = false;
  private fuse = -1;

  constructor(readonly data: PropData, world: World) {
    super(data.id, world);
    const spec = (this.spec = PROP_SPECS[data.kind]);
    this.body = world.createBody({
      type: 'dynamic',
      position: Vec2(data.x, data.y + spec.h / 2),
      angle: data.angle ?? 0,
      angularDamping: spec.round ? 0.3 : 0.5,
      linearDamping: 0.02,
      awake: false,
    });
    this.bodies.push(this.body);
    const area = spec.round ? Math.PI * (spec.w / 2) ** 2 : spec.w * spec.h;
    this.body.createFixture({
      shape: spec.round ? new Circle(spec.w / 2) : new Box(spec.w / 2, spec.h / 2),
      density: spec.mass / area,
      friction: spec.friction,
      restitution: spec.bounce,
      filterCategoryBits: CAT.PROP,
      filterMaskBits: MASK.PROP,
      userData: { k: 'prop', id: this.id, soft: spec.soft } satisfies FixtureTag,
    });
  }

  fixedUpdate(ctx: MechContext) {
    if (this.fuse >= 0 && !this.gone) {
      this.fuse -= ctx.dt;
      if (this.fuse < 0) this.destroy(ctx, 0);
    }
    if (this.spentIn > 0 && !this.gone) {
      this.spentIn -= ctx.dt;
      if (this.spentIn <= 0) {
        // One good knock each. After that it is litter, and litter cannot jam a course.
        this.spent = true;
        retire(this.body);
      }
    }
  }

  private destroy(ctx: MechContext, speed: number) {
    if (this.gone || this.doomed) return;
    this.doomed = true;
    const p = this.body.getPosition();
    const v = this.body.getLinearVelocity();
    if (this.spec.explosive) ctx.explode(p.x, p.y, BLAST_RADIUS);
    ctx.emit({ t: 'prop', kind: this.data.kind, what: 'burst', speed, x: p.x, y: p.y, vx: v.x, vy: v.y });
  }

  struck(speed: number, ctx: MechContext) {
    if (this.gone || this.doomed) return;
    if (this.spec.breakAt > 0 && speed >= this.spec.breakAt) {
      this.destroy(ctx, speed);
      return;
    }
    if (speed > 1.6) {
      if (this.spentIn < 0 && !this.spec.explosive) this.spentIn = SPENT_AFTER;
      if (this.spent) return;
      const p = this.body.getPosition();
      const v = this.body.getLinearVelocity();
      ctx.emit({ t: 'prop', kind: this.data.kind, what: 'hit', speed, x: p.x, y: p.y, vx: v.x, vy: v.y });
    }
  }

  blasted(dist: number, ctx: MechContext) {
    if (this.gone || this.doomed) return;
    if (this.spec.explosive) {
      if (this.fuse < 0) this.fuse = 0.1 + dist * 0.035;
    } else if (this.spec.breakAt > 0 && dist < BLAST_RADIUS * 0.6) {
      this.destroy(ctx, 12);
    }
  }

  flush() {
    if (this.doomed && !this.gone) {
      this.gone = true;
      this.world.destroyBody(this.body);
    }
  }
}

/** A mine. Its paperwork is in order. */
export class Mine extends Mechanism {
  readonly type = 'mine';
  body: Body;
  gone = false;
  private fuse = -1;

  constructor(readonly data: MineData, world: World) {
    super(data.id, world);
    this.body = world.createBody({ type: 'static', position: Vec2(data.x, data.y + 0.12) });
    this.bodies.push(this.body);
    this.body.createFixture({
      shape: new Box(0.34, 0.14),
      isSensor: true,
      filterCategoryBits: CAT.FUSE,
      filterMaskBits: MASK.FUSE,
      userData: { k: 'fuse', id: this.id } satisfies FixtureTag,
    });
  }

  private detonate(ctx: MechContext) {
    if (this.gone) return;
    this.gone = true;
    ctx.explode(this.data.x, this.data.y + 0.2, this.data.radius ?? BLAST_RADIUS);
  }

  fixedUpdate(ctx: MechContext) {
    if (this.fuse >= 0 && !this.gone) {
      this.fuse -= ctx.dt;
      if (this.fuse < 0) this.detonate(ctx);
    }
  }

  struck(_speed: number, ctx: MechContext) {
    this.detonate(ctx);
  }

  blasted(dist: number) {
    if (!this.gone && this.fuse < 0) this.fuse = 0.1 + dist * 0.035;
  }

  flush() {
    if (this.gone && this.body.getFixtureList()) this.body.destroyFixture(this.body.getFixtureList()!);
  }
}

/** A sprung pad. Whatever lands on it leaves along the pad's normal. */
export class Spring extends Mechanism {
  readonly type = 'spring';
  body: Body;
  /** Seconds since it last fired, for the animation. */
  since = 9;
  private cooldown = 0;

  constructor(readonly data: SpringData, world: World) {
    super(data.id, world);
    // Nearly flush with the road, so a wheel rolls onto it instead of hitting a kerb.
    this.body = world.createBody({ type: 'static', position: Vec2(data.x, data.y), angle: data.angle ?? 0 });
    this.bodies.push(this.body);
    this.addFixture(this.body, new Box(data.w / 2, 0.2, Vec2(0, -0.15), 0), { k: 'machine', id: this.id, spring: true }, 0.9);
  }

  normal() {
    const a = this.data.angle ?? 0;
    return { x: -Math.sin(a), y: Math.cos(a) };
  }

  /**
   * True if the pad is ready, and starts its recoil. Loose objects never use up
   * the pad: a cone pushed ahead of the bike must not spend the bounce the bike needs.
   */
  fire(ctx: MechContext, light = false) {
    if (light) {
      if (this.cooldown <= 0) this.since = 0;
      return true;
    }
    if (this.cooldown > 0) return false;
    this.cooldown = 0.28;
    this.since = 0;
    ctx.emit({ t: 'boing', x: this.data.x, y: this.data.y + 0.3 });
    return true;
  }

  fixedUpdate(ctx: MechContext) {
    this.cooldown = Math.max(0, this.cooldown - ctx.dt);
    this.since += ctx.dt;
  }
}

/** An industrial fan. Everything in the draught accelerates the same, so the bike lifts cleanly. */
export class Fan extends Mechanism {
  readonly type = 'fan';
  spin = 0;
  private zone: AABB;
  private seen = new Set<Body>();

  constructor(readonly data: FanData, world: World) {
    super(data.id, world);
    this.zone = new AABB(Vec2(data.x - data.w / 2, data.y), Vec2(data.x + data.w / 2, data.y + data.h));
  }

  fixedUpdate(ctx: MechContext) {
    const d = this.data;
    this.spin += ctx.dt * 26;
    const a = d.angle ?? 0;
    const ax = Math.sin(a) * d.accel;
    const ay = Math.cos(a) * d.accel;
    const seen = this.seen;
    seen.clear();
    this.world.queryAABB(this.zone, (fixture) => {
      const body = fixture.getBody();
      if (!body.isDynamic() || seen.has(body)) return true;
      const tag = fixture.getUserData() as FixtureTag | null;
      if (!tag || tag.k === 'gore') return true;
      const c = body.getWorldCenter();
      if (c.x < d.x - d.w / 2 || c.x > d.x + d.w / 2 || c.y < d.y || c.y > d.y + d.h) return true;
      seen.add(body);
      // Weaker towards the top of the column, so things hover instead of leaving.
      const fade = 1 - 0.55 * ((c.y - d.y) / d.h);
      const m = body.getMass();
      body.applyForceToCenter(Vec2(ax * m * fade, ay * m * fade), true);
      return true;
    });
  }

  reach() {
    return { x0: this.data.x - this.data.w / 2 - 1, x1: this.data.x + this.data.w / 2 + 1 };
  }
}

/** A wrecking ball. Nobody has been near the controls for some time. */
export class Wrecker extends Mechanism {
  readonly type = 'wrecker';
  body: Body;
  theta = 0;
  private t: number;

  constructor(readonly data: WreckerData, world: World) {
    super(data.id, world);
    this.t = data.phase ?? 0;
    const [x, y] = this.position();
    this.body = this.kinematic(x, y);
    this.addFixture(this.body, new Circle(data.r), { k: 'machine', id: this.id }, 0.4);
  }

  /** Where the swing is in its cycle, 0 to 1. 0 is the bottom, heading forward. */
  get cycle() {
    return (this.t / this.data.period) % 1;
  }

  private position() {
    const d = this.data;
    this.theta = d.amplitude * Math.sin((2 * Math.PI * this.t) / d.period);
    return [d.x + Math.sin(this.theta) * d.rod, d.y - Math.cos(this.theta) * d.rod] as const;
  }

  fixedUpdate(ctx: MechContext) {
    this.t += ctx.dt;
    const [x, y] = this.position();
    this.drive(this.body, x, y, this.theta, ctx.dt);
  }

  restore(state: { phase?: number }) {
    if (state.phase === undefined) return;
    this.t = state.phase;
    const [x, y] = this.position();
    this.body.setPosition(Vec2(x, y));
  }

  reach() {
    const d = this.data;
    const span = Math.sin(Math.min(Math.abs(d.amplitude), Math.PI / 2)) * d.rod + d.r + 1;
    return { x0: d.x - span, x1: d.x + span };
  }
}

export const SPIKE_HEIGHT = 0.55;

/** Spikes. Wheels sink in and stop; bodies arrive and stay. */
export class Spikes extends Mechanism {
  readonly type = 'spikes';
  body: Body;
  private pins: Joint[] = [];
  private pinned = new Set<Body>();

  constructor(readonly data: SpikesData, world: World) {
    super(data.id, world);
    this.body = world.createBody({ type: 'static', position: Vec2(data.x, data.y + SPIKE_HEIGHT / 2) });
    this.bodies.push(this.body);
    this.body.createFixture({
      shape: new Box(data.w / 2, SPIKE_HEIGHT / 2),
      filterCategoryBits: CAT.HAZARD,
      filterMaskBits: MASK.HAZARD,
      userData: { k: 'hazard', id: this.id, style: 'spikes' } satisfies FixtureTag,
    });
  }

  /** Holds a body part where it landed. A few is plenty. */
  pin(part: Body, x: number, y: number) {
    if (this.pins.length >= 4 || this.pinned.has(part)) return false;
    this.pinned.add(part);
    const px = Math.max(this.data.x - this.data.w / 2, Math.min(this.data.x + this.data.w / 2, x));
    part.setLinearVelocity(Vec2(0, 0));
    part.setAngularVelocity(part.getAngularVelocity() * 0.2);
    const joint = this.world.createJoint(
      new RevoluteJoint({ collideConnected: false, enableLimit: true, lowerAngle: -0.3, upperAngle: 0.3 }, this.body, part, Vec2(px, Math.min(y, this.data.y + SPIKE_HEIGHT))),
    );
    if (joint) this.pins.push(joint);
    return true;
  }

  fixedUpdate() {}
}

export type NpcPart = 'legs' | 'torso' | 'head' | 'arm';

/**
 * A bystander. Held upright until the bike gets close or something hits them,
 * then a ragdoll like anyone else. A fast bike punts them clear instead of
 * tripping over them.
 */
export class Npc extends Mechanism {
  readonly type = 'npc';
  readonly parts = new Map<NpcPart, Body>();
  /** True once they have been hit by something. */
  disturbed = false;
  headOff = false;
  private standing = true;
  private flung = false;
  private stand: Joint | null = null;
  private hip: RevoluteJoint;
  private neck: RevoluteJoint | null = null;
  private pendingHead = false;
  private pendingFling: { vx: number; vy: number } | null = null;
  private spentIn = -1;

  constructor(readonly data: NpcData, world: World) {
    super(data.id, world);
    const { x, y } = data;
    const facing = data.facing ?? -1;
    const group = -(1 + (hashString(data.id) % 30000));
    const make = (part: NpcPart, cx: number, cy: number, shape: Box | Circle, mass: number, area: number) => {
      const body = world.createBody({ type: 'dynamic', position: Vec2(cx, cy), angularDamping: 0.6, linearDamping: 0.02 });
      body.createFixture({
        shape,
        density: mass / area,
        friction: 0.6,
        restitution: 0.1,
        filterCategoryBits: CAT.PROP,
        filterMaskBits: MASK.PROP,
        filterGroupIndex: group,
        userData: { k: 'prop', id: this.id, soft: 0.18 } satisfies FixtureTag,
      });
      this.parts.set(part, body);
      this.bodies.push(body);
      return body;
    };
    const legs = make('legs', x, y + 0.4, new Box(0.14, 0.4), 2.6, 0.28 * 0.8);
    const torso = make('torso', x, y + 1.08, new Box(0.17, 0.3), 3.2, 0.34 * 0.6);
    const head = make('head', x + facing * 0.02, y + 1.55, new Circle(0.17), 0.9, Math.PI * 0.17 * 0.17);
    const arm = make('arm', x + facing * 0.06, y + 1.02, new Box(0.06, 0.28), 0.5, 0.12 * 0.56);
    const hinge = (a: Body, b: Body, ax: number, ay: number, lo: number, hi: number) =>
      world.createJoint(new RevoluteJoint({ enableLimit: true, lowerAngle: lo, upperAngle: hi, collideConnected: false }, a, b, Vec2(ax, ay))) as RevoluteJoint;
    // Locked straight while standing. The limits open when they stop standing.
    this.hip = hinge(legs, torso, x, y + 0.8, 0, 0);
    this.neck = hinge(torso, head, x, y + 1.38, 0, 0);
    hinge(torso, arm, x + facing * 0.06, y + 1.3, -2.6, 2.6);
    const anchor = world.createBody({ type: 'static', position: Vec2(x, y) });
    this.stand = hinge(anchor, legs, x, y, 0, 0);
  }

  private release() {
    if (!this.standing) return;
    this.standing = false;
    if (this.stand) this.world.destroyJoint(this.stand);
    this.stand = null;
    this.hip.setLimits(-1.4, 1.4);
    this.neck?.setLimits(-0.5, 0.5);
  }

  fixedUpdate(ctx: MechContext) {
    if (this.spentIn > 0) {
      this.spentIn -= ctx.dt;
      // Down and out of the way: a body on the road never blocks it.
      if (this.spentIn <= 0) for (const body of this.parts.values()) retire(body);
    }
    const b = ctx.bike();
    const torso = this.parts.get('torso')!.getPosition();
    const ahead = (torso.x - b.x) * Math.sign(b.vx || 1);
    if (!this.flung && Math.abs(b.vx) > 3 && ahead > 0 && ahead < 1.45 && Math.abs(b.y - torso.y) < 2) {
      // Punted a hair before the wheel arrives, so a fast bike never trips on a bystander.
      this.release();
      this.flung = true;
      const vx = b.vx * 1.2;
      const vy = Math.abs(b.vx) * 0.32 + 3.2;
      for (const body of this.parts.values()) body.setLinearVelocity(Vec2(vx, vy));
      this.parts.get('torso')!.setAngularVelocity(vx > 0 ? -5 : 5);
      if (!this.disturbed) {
        this.disturbed = true;
        this.spentIn = SPENT_AFTER;
        ctx.emit({ t: 'npc', what: 'hit', x: torso.x, y: torso.y, vx, vy });
      }
      if (!this.headOff && Math.abs(b.vx) >= 13) this.loseHead(ctx);
      return;
    }
    if (!this.standing) return;
    if (Math.abs(b.x - this.data.x) < 1.9 && Math.abs(b.y - this.data.y - 0.6) < 3) this.release();
  }

  private loseHead(ctx: MechContext) {
    this.headOff = true;
    this.pendingHead = true;
    const h = this.parts.get('head')!;
    const hp = h.getPosition();
    const hv = h.getLinearVelocity();
    ctx.emit({ t: 'npc', what: 'head', x: hp.x, y: hp.y, vx: hv.x, vy: hv.y });
  }

  struck(speed: number, ctx: MechContext) {
    const torso = this.parts.get('torso')!;
    const p = torso.getPosition();
    if (speed > 1.2) {
      this.release();
      if (!this.disturbed) {
        this.disturbed = true;
        this.spentIn = SPENT_AFTER;
        const b = ctx.bike();
        const near = Math.abs(b.x - p.x) < 2.6 && Math.abs(b.y - p.y) < 2.6;
        if (near && speed > 2.5 && !this.flung) {
          this.flung = true;
          this.pendingFling = { vx: b.vx * 1.2, vy: Math.abs(b.vx) * 0.32 + 3.2 };
        }
        const v = this.pendingFling ?? { vx: 0, vy: 0 };
        ctx.emit({ t: 'npc', what: 'hit', x: p.x, y: p.y, vx: v.vx, vy: v.vy });
      }
    }
    if (!this.headOff && speed >= 9) this.loseHead(ctx);
  }

  blasted(dist: number, ctx: MechContext) {
    this.release();
    this.struck(dist < 2.6 ? 12 : 4, ctx);
  }

  flush() {
    if (this.pendingFling) {
      const { vx, vy } = this.pendingFling;
      this.pendingFling = null;
      for (const body of this.parts.values()) body.setLinearVelocity(Vec2(vx, vy));
      this.parts.get('torso')!.setAngularVelocity(vx > 0 ? -5 : 5);
    }
    if (!this.pendingHead) return;
    this.pendingHead = false;
    if (this.neck) this.world.destroyJoint(this.neck);
    this.neck = null;
    const head = this.parts.get('head')!;
    retire(head);
    const v = head.getLinearVelocity();
    head.setLinearVelocity(Vec2(v.x, v.y + 4.5));
  }
}
