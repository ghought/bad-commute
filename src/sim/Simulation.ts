import { Box, Chain, Circle, Contact, Vec2, World, type Body, type Fixture } from 'planck';
import { DAMAGE, SIM } from '../config/tuning';
import type { VehicleCommand } from '../input/actions';
import type { LevelData } from '../levels/schema';
import { Tracked, type Mechanism, type MechContext } from '../mechanisms/base';
import { buildMechanism } from '../mechanisms';
import type { VehicleController, VehicleTelemetry } from '../vehicles/types';
import { ContactCooldown, evaluateCutter, evaluateImpact, type DamageOutcome } from './damage';
import type { DeathCause, SimEvent } from './events';
import { CAT, MASK, type BodyRegion, type FixtureTag, type RiderPartId } from './filters';

export type RunStatus = 'ready' | 'playing' | 'crashed' | 'finished';

export interface SimOptions {
  /** Start from the level's checkpoint, in its authored state. */
  fromCheckpoint?: boolean;
  /** Clock carried across a recovery. */
  time?: number;
  /** Tag state carried across a recovery. */
  tag?: boolean;
}

interface QueuedHit {
  part: RiderPartId;
  region: BodyRegion;
  speed: number;
  x: number;
  y: number;
  nx: number;
  ny: number;
  cutter: boolean;
  crush: boolean;
}

interface QueuedBikeHit {
  id: string | null;
  speed: number;
  x: number;
  y: number;
  what: 'wheel' | 'chassis';
}

const tagOf = (f: Fixture) => f.getUserData() as FixtureTag | null;

/**
 * One attempt at one level. It knows nothing about the DOM, so it runs
 * identically in the browser, in tests and in the route verifier.
 *
 * Order within a step, which tests rely on:
 *   1. Signals sent last step are delivered to mechanisms.
 *   2. Mechanisms move, then the vehicle applies its inputs.
 *   3. The physics world steps.
 *   4. Rider damage resolves, latching death before anything else.
 *   5. Crush zones, kill regions and bounds are checked.
 *   6. Triggers fire, if the rider is still alive.
 *   7. The finish gate is checked, if the rider is still alive.
 */
export class Simulation {
  readonly world: World;
  readonly mechanisms: Mechanism[] = [];
  private readonly mechById = new Map<string, Mechanism>();
  readonly tracked: Tracked[] = [];
  /** Vehicle body poses for render interpolation, by name. */
  readonly vehicleTracks = new Map<string, Tracked>();
  private readonly byBody = new Map<Body, Tracked>();

  status: RunStatus = 'ready';
  deathCause: DeathCause | null = null;
  /** Bumped when a body is flattened, so the renderer can squash it. */
  crushed = false;
  time: number;
  /** Time with the world running, including after a crash. */
  worldTime = 0;
  aftermath = 0;
  stuck = 0;

  tag: boolean;
  /** Tag state saved when the checkpoint was touched. */
  checkpointTag = false;
  checkpointActive: boolean;
  readonly assisted: boolean;

  events: SimEvent[] = [];
  private loads = new Map<string, number>();
  private hits: QueuedHit[] = [];
  private bikeHits: QueuedBikeHit[] = [];
  private triggers: string[] = [];
  private signals: Array<[string, boolean]> = [];
  private cooldown = new ContactCooldown();
  private ctx: MechContext;
  private tel!: VehicleTelemetry;
  private prevX = 0;
  private disposed = false;

  constructor(
    readonly level: LevelData,
    readonly vehicle: VehicleController,
    options: SimOptions = {},
  ) {
    this.time = options.time ?? 0;
    this.tag = options.tag ?? false;
    this.assisted = !!options.fromCheckpoint;
    this.checkpointActive = !!options.fromCheckpoint;
    this.checkpointTag = this.tag;

    this.world = new World({ gravity: Vec2(0, -SIM.gravity), allowSleep: true });
    this.world.on('begin-contact', (c) => this.onContact(c, 1));
    this.world.on('end-contact', (c) => this.onContact(c, -1));
    this.world.on('pre-solve', (c) => this.onPreSolve(c));

    this.ctx = {
      dt: SIM.dt,
      loadOf: (id) => this.loads.get(id) ?? 0,
      bike: () => this.tel,
      send: (id, on) => this.signals.push([id, on]),
      emit: (e) => this.events.push(e),
    };

    this.buildStatic();
    for (const data of level.prefabs) {
      const m = buildMechanism(data, this.world);
      this.mechanisms.push(m);
      this.mechById.set(m.id, m);
    }

    const cp = options.fromCheckpoint ? level.checkpoint : undefined;
    if (cp) {
      for (const [id, state] of Object.entries(cp.restore)) this.mechById.get(id)?.restore(state);
    }
    const spawn = cp ? cp.spawn : level.spawn;
    vehicle.spawn(this.world, { x: spawn.x, y: spawn.y, angle: spawn.angle ?? 0 });
    this.tel = vehicle.telemetry();
    this.prevX = this.tel.x;

    for (const m of this.mechanisms) {
      for (const body of m.bodies) {
        const t = new Tracked(body);
        this.tracked.push(t);
        this.byBody.set(body, t);
      }
    }
    this.trackVehicle();
    this.settle();
  }

  private trackVehicle() {
    const v = this.vehicle as unknown as {
      chassis?: Body;
      wheels?: Body[];
      parts?: Map<string, Body>;
    };
    const add = (name: string, body: Body) => {
      const t = new Tracked(body);
      this.vehicleTracks.set(name, t);
      this.tracked.push(t);
    };
    if (v.chassis) add('chassis', v.chassis);
    v.wheels?.forEach((w, i) => add(`wheel${i}`, w));
    v.parts?.forEach((b, id) => add(id, b));
  }

  private buildStatic() {
    const { level, world } = this;
    const staticFixture = (body: Body, shape: Chain | Box) =>
      body.createFixture({
        shape,
        friction: 0.95,
        restitution: 0.02,
        filterCategoryBits: CAT.TERRAIN,
        filterMaskBits: MASK.TERRAIN,
        userData: { k: 'terrain' } satisfies FixtureTag,
      });

    for (const t of level.terrain) {
      const body = world.createBody({ type: 'static' });
      staticFixture(body, new Chain(t.points.map(([x, y]) => Vec2(x, y)), false));
    }
    for (const s of level.solids) {
      const body = world.createBody({ type: 'static', position: Vec2(s.x, s.y), angle: s.angle ?? 0 });
      staticFixture(body, new Box(s.w / 2, s.h / 2));
    }

    const addTrigger = (id: string, shape: Circle | Box, x: number, y: number) => {
      const body = world.createBody({ type: 'static', position: Vec2(x, y) });
      body.createFixture({
        shape,
        isSensor: true,
        filterCategoryBits: CAT.TRIGGER,
        filterMaskBits: MASK.TRIGGER,
        userData: { k: 'trigger', id } satisfies FixtureTag,
      });
    };
    addTrigger('$tag', new Circle(0.75), level.tag.x, level.tag.y);
    if (level.checkpoint) {
      const cp = level.checkpoint;
      addTrigger('$checkpoint', new Box(0.4, cp.h / 2), cp.x, cp.y + cp.h / 2);
    }
  }

  /** Lets the suspension find its rest position while the machinery stays frozen. */
  private settle() {
    for (let i = 0; i < SIM.settleSteps; i++) {
      this.vehicle.fixedUpdate(SIM.dt, { throttle: 0, brake: 0, lean: 0 });
      this.world.step(SIM.dt, SIM.velocityIterations, SIM.positionIterations);
    }
    this.events.length = 0;
    this.hits.length = 0;
    this.bikeHits.length = 0;
    this.triggers.length = 0;
    this.capture();
    this.capture();
    this.tel = this.vehicle.telemetry();
    this.prevX = this.tel.x;
  }

  private capture() {
    for (const t of this.tracked) t.capture();
  }

  private onContact(c: Contact, delta: 1 | -1) {
    const fa = c.getFixtureA();
    const fb = c.getFixtureB();
    const a = tagOf(fa);
    const b = tagOf(fb);
    if (!a || !b) return;
    this.handleSide(c, a, b, delta);
    this.handleSide(c, b, a, delta);
  }

  private handleSide(c: Contact, self: FixtureTag, other: FixtureTag, delta: 1 | -1) {
    if (self.k === 'wheel' || self.k === 'chassis') {
      if (other.k === 'terrain' || other.k === 'machine') {
        this.vehicle.contactChanged(self, delta);
        const id = other.k === 'machine' ? other.id : null;
        if (id) this.loads.set(id, (this.loads.get(id) ?? 0) + delta);
        if (delta === 1) {
          const hit = this.measure(c);
          if (hit) this.bikeHits.push({ id, speed: hit.speed, x: hit.x, y: hit.y, what: self.k });
        }
      } else if (other.k === 'trigger' && delta === 1) {
        this.triggers.push(other.id);
      } else if (other.k === 'hazard' && delta === 1) {
        const hit = this.measure(c);
        if (hit) this.events.push({ t: 'sparks', x: hit.x, y: hit.y });
      }
      return;
    }
    if (self.k === 'rider' && delta === 1) {
      if (other.k !== 'terrain' && other.k !== 'machine' && other.k !== 'hazard') return;
      const hit = this.measure(c);
      if (!hit) return;
      this.hits.push({
        part: self.part,
        region: self.region,
        ...hit,
        cutter: other.k === 'hazard',
        crush: other.k === 'machine' && !!other.crush,
      });
    }
  }

  private measure(c: Contact) {
    const wm = c.getWorldManifold(null);
    if (!wm || wm.pointCount === 0) {
      return null;
    }
    const p = wm.points[0];
    const n = wm.normal;
    const va = c.getFixtureA().getBody().getLinearVelocityFromWorldPoint(p);
    const vb = c.getFixtureB().getBody().getLinearVelocityFromWorldPoint(p);
    const speed = Math.abs((vb.x - va.x) * n.x + (vb.y - va.y) * n.y);
    return { speed, x: p.x, y: p.y, nx: n.x, ny: n.y };
  }

  private onPreSolve(c: Contact) {
    const a = tagOf(c.getFixtureA());
    const b = tagOf(c.getFixtureB());
    if (!a || !b) return;
    if (a.k === 'hazard' || b.k === 'hazard') {
      c.setEnabled(false);
      return;
    }
    const m = a.k === 'machine' ? a : b.k === 'machine' ? b : null;
    if (!m || m.k !== 'machine') return;
    if (m.conveyor) c.setTangentSpeed(m.conveyor());
    // Once the press has done its work it goes through what is left.
    if (m.crush && !this.vehicle.isAlive()) c.setEnabled(false);
  }

  /** Starts the clock and the machinery on the first riding input. */
  private begin() {
    this.status = 'playing';
    this.events.push({ t: 'start' });
  }

  step(cmd: VehicleCommand) {
    const anyInput = cmd.throttle !== 0 || cmd.brake !== 0 || cmd.lean !== 0;
    if (this.status === 'ready') {
      if (!anyInput) return;
      this.begin();
    }

    const riding = this.status === 'playing';
    const dt = SIM.dt;

    // 1. Deliver signals from last step.
    if (this.signals.length) {
      const batch = this.signals;
      this.signals = [];
      for (const [id, on] of batch) this.mechById.get(id)?.receive(on, this.ctx);
    }

    // 2. Machines, then the vehicle.
    for (const m of this.mechanisms) m.fixedUpdate(this.ctx);
    this.vehicle.fixedUpdate(dt, riding ? cmd : { throttle: 0, brake: 0, lean: 0 });

    // 3. Physics.
    this.world.step(dt, SIM.velocityIterations, SIM.positionIterations);
    this.worldTime += dt;
    this.capture();
    this.tel = this.vehicle.telemetry();

    // 4. Damage.
    this.resolveRiderHits();
    this.resolveBikeHits();

    if (this.status === 'playing') {
      // 5. Crushes and bounds.
      this.checkLethalRegions();
    }
    if (this.status === 'playing') {
      // 6. Triggers.
      this.resolveTriggers();
      // 7. Finish.
      this.checkFinish();
    } else {
      this.triggers.length = 0;
    }

    for (const m of this.mechanisms) m.flush();

    if (this.status === 'playing') {
      this.time += dt;
      this.trackStuck(dt);
    } else if (this.status === 'crashed') {
      const before = this.aftermath;
      this.aftermath += dt;
      if (before < DAMAGE.aftermathSeconds && this.aftermath >= DAMAGE.aftermathSeconds) this.vehicle.settle();
    }
    this.prevX = this.tel.x;
  }

  private trackStuck(dt: number) {
    const upset = Math.cos(this.tel.angle) < 0.2;
    if (upset && this.tel.speed < DAMAGE.stuckSpeed) this.stuck += dt;
    else this.stuck = 0;
  }

  private resolveRiderHits() {
    const batch = this.hits;
    this.hits = [];
    for (const hit of batch) {
      const live = this.status === 'playing';
      if (this.status === 'finished') continue;

      let outcome: DamageOutcome = 'none';
      if (live) {
        if (hit.crush) {
          // A press does not leave a decision to make.
          this.die('crush', hit.x, hit.y);
          continue;
        }
        if (this.cooldown.claim(hit.part, this.worldTime)) {
          outcome = hit.cutter ? evaluateCutter(hit.region) : evaluateImpact(hit.region, hit.speed);
        }
      }

      this.events.push({
        t: 'impact',
        part: hit.part,
        region: hit.region,
        speed: hit.speed,
        x: hit.x,
        y: hit.y,
        nx: hit.nx,
        ny: hit.ny,
        outcome,
        live,
      });

      switch (outcome) {
        case 'sever':
          if (this.vehicle.sever(hit.part)) {
            const b = this.bodyVelocity(hit.part);
            this.events.push({ t: 'sever', part: hit.part, x: hit.x, y: hit.y, vx: b.x, vy: b.y });
          }
          break;
        case 'decapitate': {
          this.vehicle.decapitate();
          const b = this.bodyVelocity('head');
          this.events.push({ t: 'decapitate', x: hit.x, y: hit.y, vx: b.x, vy: b.y });
          this.die(hit.cutter ? 'cutter' : 'head', hit.x, hit.y);
          break;
        }
        case 'lethal':
          this.die(hit.cutter ? 'cutter' : hit.region === 'head' ? 'head' : 'torso', hit.x, hit.y);
          break;
        default:
          break;
      }
    }
  }

  private bodyVelocity(part: RiderPartId) {
    return this.vehicleTracks.get(part)?.body.getLinearVelocity() ?? Vec2(0, 0);
  }

  private resolveBikeHits() {
    const batch = this.bikeHits;
    this.bikeHits = [];
    for (const hit of batch) {
      if (hit.id) this.mechById.get(hit.id)?.struck(hit.speed, this.ctx);
      this.events.push({ t: 'bike', speed: hit.speed, x: hit.x, y: hit.y, what: hit.what });
    }
  }

  private checkLethalRegions() {
    const { x, y } = this.tel;
    for (const m of this.mechanisms) {
      const zone = m.crushZone();
      if (zone && x >= zone.x0 && x <= zone.x1 && y >= zone.y0 && y <= zone.y1) {
        this.die('crush', x, y);
        return;
      }
    }
    for (const k of this.level.killRegions) {
      if (x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1) {
        this.die('pit', x, y);
        return;
      }
    }
    const b = this.level.bounds;
    if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) this.die('bounds', x, y);
  }

  private resolveTriggers() {
    const batch = this.triggers;
    this.triggers = [];
    for (const id of batch) {
      if (id === '$tag') {
        if (!this.tag) {
          this.tag = true;
          this.events.push({ t: 'tag', x: this.level.tag.x, y: this.level.tag.y });
        }
      } else if (id === '$checkpoint') {
        if (!this.checkpointActive && this.level.checkpoint) {
          this.checkpointActive = true;
          this.checkpointTag = this.tag;
          this.events.push({ t: 'checkpoint', x: this.level.checkpoint.x, y: this.level.checkpoint.y });
        }
      } else {
        this.mechById.get(id)?.struck(this.tel.speed, this.ctx);
      }
    }
  }

  private checkFinish() {
    if (this.status !== 'playing') return;
    const f = this.level.finish;
    const { x, y } = this.tel;
    if (this.prevX < f.x && x >= f.x && y >= f.y && y <= f.y + f.h && this.vehicle.isAlive()) {
      this.status = 'finished';
      this.events.push({ t: 'finish' });
    }
  }

  private die(cause: DeathCause, x: number, y: number) {
    if (this.status !== 'playing') return;
    this.status = 'crashed';
    this.deathCause = cause;
    if (cause === 'crush') this.crushed = true;
    this.vehicle.kill();
    this.events.push({ t: 'death', cause, x, y });
  }

  telemetry() {
    return this.tel;
  }

  /** Render interpolation state for a mechanism body. */
  trackOf(body: Body) {
    return this.byBody.get(body);
  }

  mechanism<T extends Mechanism>(id: string) {
    return this.mechById.get(id) as T | undefined;
  }

  bodyCount() {
    return this.world.getBodyCount();
  }

  /** Releases everything this attempt built. Safe to call twice. */
  dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.vehicle.dispose();
    this.events.length = 0;
  }
}
