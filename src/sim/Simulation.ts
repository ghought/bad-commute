import { Box, Chain, Circle, Contact, Vec2, World, type Body, type Fixture } from 'planck';
import type { Spikes, Spring } from '../mechanisms/toys';
import { DAMAGE, SIM } from '../config/tuning';
import type { VehicleCommand } from '../input/actions';
import type { LevelData } from '../levels/schema';
import { Tracked, type Mechanism, type MechContext } from '../mechanisms/base';
import { buildMechanism } from '../mechanisms';
import type { VehicleController, VehicleTelemetry } from '../vehicles/types';
import { ContactCooldown, evaluateCutter, evaluateImpact, type DamageOutcome } from './damage';
import type { Arrival, DeathCause, SimEvent } from './events';
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
  /** Share of the contact speed the rider feels. Cardboard is kind. */
  scale: number;
  /** The spike strip that was landed on, if any. */
  spikes: string | null;
}

interface Bounce {
  id: string;
  who: 'bike' | 'rider' | 'prop';
  body: Body;
}

interface Blast {
  x: number;
  y: number;
  r: number;
  delay: number;
}

const LIMB_IDS: RiderPartId[] = ['armUpperN', 'armLowerN', 'armUpperF', 'armLowerF', 'legUpperN', 'legLowerN', 'legUpperF', 'legLowerF'];

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
 *   6. Triggers fire, if the rider is still on the bike.
 *   7. The finish gate is checked. Any torso that crosses it has arrived.
 *
 * The attempt carries on after the rider leaves the bike, alive or not: status
 * stays 'playing' until the body crosses the line or has nowhere left to go.
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
  /** How the finish line was crossed. Set with status 'finished'. */
  arrival: Arrival | null = null;
  /** Seconds since death, and seconds the body has lain still. */
  private deadFor = 0;
  private restFor = 0;
  private idleFor = 0;
  private prevRiderX = 0;
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
  private propHits: Array<{ id: string; speed: number }> = [];
  private fuses: string[] = [];
  private snags: string[] = [];
  private bounces: Bounce[] = [];
  private blasts: Blast[] = [];
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
      explode: (x, y, radius, delay = 0) => this.blasts.push({ x, y, r: radius, delay }),
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
    this.prevRiderX = vehicle.riderPose().x;

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
    this.propHits.length = 0;
    this.fuses.length = 0;
    this.snags.length = 0;
    this.bounces.length = 0;
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
    this.handleSide(c, a, b, delta, fa.getBody());
    this.handleSide(c, b, a, delta, fb.getBody());
  }

  private handleSide(c: Contact, self: FixtureTag, other: FixtureTag, delta: 1 | -1, body: Body) {
    if (self.k === 'wheel' || self.k === 'chassis') {
      if (other.k === 'terrain' || other.k === 'machine' || other.k === 'prop') {
        this.vehicle.contactChanged(self, delta);
        const id = other.k === 'machine' ? other.id : null;
        if (id) this.loads.set(id, (this.loads.get(id) ?? 0) + delta);
        if (delta === 1) {
          const hit = this.measure(c);
          if (hit) this.bikeHits.push({ id, speed: hit.speed, x: hit.x, y: hit.y, what: self.k });
          if (other.k === 'machine' && other.spring) this.bounces.push({ id: other.id, who: 'bike', body });
        }
      } else if (delta !== 1) {
        return;
      } else if (other.k === 'trigger') {
        this.triggers.push(other.id);
      } else if (other.k === 'fuse') {
        this.fuses.push(other.id);
      } else if (other.k === 'hazard') {
        if (other.style === 'spikes') this.snags.push(other.id);
        const hit = this.measure(c);
        if (hit) this.events.push({ t: 'sparks', x: hit.x, y: hit.y });
      }
      return;
    }
    if (delta !== 1) return;
    if (self.k === 'rider') {
      if (other.k === 'fuse') {
        this.fuses.push(other.id);
        return;
      }
      if (other.k !== 'terrain' && other.k !== 'machine' && other.k !== 'hazard' && other.k !== 'prop') return;
      if (other.k === 'machine' && other.spring) this.bounces.push({ id: other.id, who: 'rider', body });
      const hit = this.measure(c);
      if (!hit) return;
      this.hits.push({
        part: self.part,
        region: self.region,
        ...hit,
        cutter: other.k === 'hazard' && other.style === 'cutter',
        crush: other.k === 'machine' && !!other.crush,
        scale: other.k === 'prop' ? other.soft : 1,
        spikes: other.k === 'hazard' && other.style === 'spikes' ? other.id : null,
      });
      return;
    }
    if (self.k === 'prop') {
      if (other.k === 'fuse') {
        this.fuses.push(other.id);
        return;
      }
      if (other.k === 'machine' && other.spring) this.bounces.push({ id: other.id, who: 'prop', body });
      const hit = this.measure(c);
      if (hit) this.propHits.push({ id: self.id, speed: hit.speed });
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

  /** Where the employee is: the torso, wherever that has ended up. */
  riderState() {
    return this.vehicle.riderState();
  }

  step(cmd: VehicleCommand) {
    const anyInput = cmd.throttle !== 0 || cmd.brake !== 0 || cmd.lean !== 0;
    if (this.status === 'ready') {
      if (!anyInput) return;
      this.begin();
    }

    const playing = this.status === 'playing';
    const dt = SIM.dt;

    // 1. Deliver signals from last step.
    if (this.signals.length) {
      const batch = this.signals;
      this.signals = [];
      for (const [id, on] of batch) this.mechById.get(id)?.receive(on, this.ctx);
    }

    // 2. Machines, then the vehicle. A loose rider still gets their inputs.
    for (const m of this.mechanisms) m.fixedUpdate(this.ctx);
    this.resolveBlasts(dt);
    this.vehicle.fixedUpdate(dt, playing && this.vehicle.riderState() !== 'dead' ? cmd : { throttle: 0, brake: 0, lean: 0 });
    if (this.vehicle.ejectRequested) {
      this.vehicle.ejectRequested = false;
      if (playing && this.vehicle.eject(true)) this.events.push({ t: 'eject', x: this.tel.x, y: this.tel.y, chosen: true });
    }
    if (this.vehicle.flopped) {
      this.vehicle.flopped = false;
      const p = this.vehicle.riderPose();
      this.events.push({ t: 'flop', x: p.x, y: p.y });
    }

    // 3. Physics.
    this.world.step(dt, SIM.velocityIterations, SIM.positionIterations);
    this.worldTime += dt;
    this.capture();
    this.tel = this.vehicle.telemetry();

    // 4. Damage, and everything else contacts started.
    this.resolveRiderHits();
    this.resolveBikeHits();
    this.resolveToys();

    if (this.status === 'playing') {
      // 5. Crushes and bounds.
      this.checkLethalRegions();
    }
    if (this.status === 'playing') {
      // 6. Triggers.
      if (this.vehicle.riderState() === 'riding') this.resolveTriggers();
      else this.triggers.length = 0;
      // 7. Finish.
      this.checkFinish();
    } else {
      this.triggers.length = 0;
    }

    for (const m of this.mechanisms) m.flush();

    if (this.status === 'playing') {
      this.time += dt;
      this.trackStuck(dt);
      this.trackBody(dt, anyInput);
    } else if (this.status === 'crashed') {
      const before = this.aftermath;
      this.aftermath += dt;
      if (before < DAMAGE.aftermathSeconds && this.aftermath >= DAMAGE.aftermathSeconds) this.vehicle.settle();
    }
    this.prevX = this.tel.x;
    this.prevRiderX = this.vehicle.riderPose().x;
  }

  private trackStuck(dt: number) {
    const upset = Math.cos(this.tel.angle) < 0.2;
    if (this.vehicle.riderState() === 'riding' && upset && this.tel.speed < DAMAGE.stuckSpeed) this.stuck += dt;
    else this.stuck = 0;
  }

  /**
   * A dead body gets a few seconds to finish its journey, then the attempt is over.
   * So is a living one that has been lying still with no input for a while.
   */
  private trackBody(dt: number, input: boolean) {
    const state = this.vehicle.riderState();
    if (state === 'loose') {
      const p = this.vehicle.riderPose();
      if (!input && Math.hypot(p.vx, p.vy) < DAMAGE.restSpeed) this.idleFor += dt;
      else this.idleFor = 0;
      if (this.idleFor >= DAMAGE.idleSeconds) {
        this.status = 'crashed';
        this.events.push({ t: 'over' });
      }
      return;
    }
    if (state !== 'dead') return;
    this.deadFor += dt;
    const p = this.vehicle.riderPose();
    if (Math.hypot(p.vx, p.vy) < DAMAGE.restSpeed) this.restFor += dt;
    else this.restFor = 0;
    const final = this.deathCause === 'pit' || this.deathCause === 'bounds';
    if (final || this.restFor >= DAMAGE.restSeconds || this.deadFor >= DAMAGE.deadSeconds || (this.crushed && this.deadFor > 0.9)) {
      this.status = 'crashed';
      this.events.push({ t: 'over' });
    }
  }

  private resolveRiderHits() {
    const batch = this.hits;
    this.hits = [];
    if (this.status === 'finished' && this.arrival === 'riding') return;
    for (const hit of batch) {
      const state = this.vehicle.riderState();
      const playing = this.status === 'playing';
      const speed = hit.speed * hit.scale;

      if (hit.crush && state !== 'dead' && playing) {
        // A press does not leave a decision to make.
        this.die('crush', hit.x, hit.y);
        continue;
      }
      if (hit.spikes) {
        this.impale(hit);
        continue;
      }

      let outcome: DamageOutcome = 'none';
      if (this.cooldown.claim(hit.part, this.worldTime)) {
        outcome = hit.cutter ? evaluateCutter(hit.region) : evaluateImpact(hit.region, speed);
      }
      // The dead cannot be killed again, but they can still come apart.
      if (state === 'dead' && (outcome === 'lethal' || outcome === 'knock')) outcome = 'bruise';
      if (state === 'loose' && outcome === 'knock') outcome = 'bruise';
      if (!playing && outcome !== 'sever' && outcome !== 'decapitate' && outcome !== 'none') outcome = 'bruise';

      this.events.push({
        t: 'impact',
        part: hit.part,
        region: hit.region,
        speed,
        x: hit.x,
        y: hit.y,
        nx: hit.nx,
        ny: hit.ny,
        outcome,
        live: state !== 'dead',
      });

      switch (outcome) {
        case 'sever':
          this.severPart(hit.part, hit.x, hit.y);
          break;
        case 'decapitate':
          this.beheadRider(hit.x, hit.y);
          this.die(hit.cutter ? 'cutter' : 'head', hit.x, hit.y);
          break;
        case 'lethal':
          this.die(hit.cutter ? 'cutter' : hit.region === 'head' ? 'head' : 'torso', hit.x, hit.y);
          break;
        case 'knock':
          if (this.vehicle.eject(false)) this.events.push({ t: 'eject', x: hit.x, y: hit.y, chosen: false });
          break;
        default:
          break;
      }
    }
  }

  private severPart(part: RiderPartId, x: number, y: number) {
    if (!this.vehicle.sever(part)) return;
    const b = this.bodyVelocity(part);
    this.events.push({ t: 'sever', part, x, y, vx: b.x, vy: b.y });
  }

  private beheadRider(x: number, y: number) {
    if (!this.vehicle.decapitate()) return;
    const b = this.bodyVelocity('head');
    this.events.push({ t: 'decapitate', x, y, vx: b.x, vy: b.y });
  }

  private impale(hit: QueuedHit) {
    const spikes = this.mechById.get(hit.spikes!) as Spikes | undefined;
    const body = this.vehicleTracks.get(hit.part)?.body;
    if (!spikes || !body) return;
    const vital = hit.region !== 'limb';
    const state = this.vehicle.riderState();
    if (vital && state !== 'dead' && this.status === 'playing') this.die('spikes', hit.x, hit.y);
    if ((vital || state !== 'riding') && spikes.pin(body, hit.x, hit.y)) this.events.push({ t: 'impale', x: hit.x, y: hit.y });
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

  /** Props, fuses, spikes and springs: everything a contact started that could not finish there. */
  private resolveToys() {
    if (this.propHits.length) {
      const batch = this.propHits;
      this.propHits = [];
      for (const hit of batch) this.mechById.get(hit.id)?.struck(hit.speed, this.ctx);
    }
    if (this.fuses.length) {
      const batch = this.fuses;
      this.fuses = [];
      for (const id of batch) this.mechById.get(id)?.struck(0, this.ctx);
    }
    if (this.snags.length) {
      this.snags.length = 0;
      this.vehicle.snag();
      if (this.status === 'playing' && this.vehicle.riderState() === 'riding') this.die('spikes', this.tel.x, this.tel.y);
    }
    if (this.bounces.length) {
      const batch = this.bounces;
      this.bounces = [];
      for (const b of batch) this.bounce(b);
    }
  }

  private bounce(b: Bounce) {
    const spring = this.mechById.get(b.id) as Spring | undefined;
    if (!spring || spring.type !== 'spring' || !spring.fire(this.ctx, b.who === 'prop')) return;
    const n = spring.normal();
    const power = spring.data.power;
    const riding = this.vehicle.riderState() === 'riding';
    const kick = (vx: number, vy: number) => {
      const along = vx * n.x + vy * n.y;
      return Math.max(0, power - along);
    };
    if (b.who === 'bike' || (b.who === 'rider' && riding)) {
      const t = this.vehicle.telemetry();
      const dv = kick(t.vx, t.vy);
      this.vehicle.launch(n.x * dv, n.y * dv, riding ? 'all' : 'bike');
    } else if (b.who === 'rider') {
      const p = this.vehicle.riderPose();
      const dv = kick(p.vx, p.vy);
      this.vehicle.launch(n.x * dv, n.y * dv, 'rider');
    } else {
      const v = b.body.getLinearVelocity();
      const dv = kick(v.x, v.y);
      b.body.setLinearVelocity(Vec2(v.x + n.x * dv, v.y + n.y * dv));
    }
  }

  private resolveBlasts(dt: number) {
    if (!this.blasts.length) return;
    const due: Blast[] = [];
    const later: Blast[] = [];
    for (const b of this.blasts) {
      b.delay -= dt;
      (b.delay <= 0 ? due : later).push(b);
    }
    this.blasts = later;
    for (const b of due) this.detonate(b);
  }

  /** One explosion: the rider first, then everything loose, then anything else that can go off. */
  private detonate({ x, y, r }: Blast) {
    this.events.push({ t: 'explosion', x, y, r });
    const distTo = (id: string) => {
      const p = this.vehicleTracks.get(id)?.body.getPosition();
      return p ? Math.hypot(p.x - x, p.y - y) : Infinity;
    };

    if (this.status !== 'finished' || this.arrival !== 'riding') {
      const torso = distTo('torso');
      const playing = this.status === 'playing';
      for (const part of LIMB_IDS) {
        if (distTo(part) < r * 0.5) {
          const p = this.vehicleTracks.get(part)!.body.getPosition();
          this.severPart(part, p.x, p.y);
        }
      }
      if (distTo('head') < r * 0.3) {
        const p = this.vehicleTracks.get('head')!.body.getPosition();
        this.beheadRider(p.x, p.y);
        if (playing) this.die('blast', p.x, p.y);
      }
      if (torso < r && playing && this.vehicle.riderState() !== 'dead') {
        if (torso < r * 0.42) this.die('blast', x, y);
        else if (this.vehicle.eject(false)) this.events.push({ t: 'eject', x, y, chosen: false });
      }
    }

    for (let body = this.world.getBodyList(); body; body = body.getNext()) {
      if (!body.isDynamic()) continue;
      const c = body.getWorldCenter();
      const dx = c.x - x;
      const dy = c.y - y;
      const d = Math.hypot(dx, dy);
      if (d > r) continue;
      const fall = 1 - d / r;
      let nx = d > 0.01 ? dx / d : 0;
      let ny = (d > 0.01 ? dy / d : 1) + 0.5;
      const len = Math.hypot(nx, ny) || 1;
      nx /= len;
      ny /= len;
      const dv = 6 + 15 * fall;
      const v = body.getLinearVelocity();
      body.setAwake(true);
      body.setLinearVelocity(Vec2(v.x + nx * dv, v.y + ny * dv));
      body.setAngularVelocity(body.getAngularVelocity() + (dx >= 0 ? -1 : 1) * 8 * fall);
    }

    for (const m of this.mechanisms) {
      const body = m.bodies[0];
      if (!body) continue;
      const p = body.getPosition();
      const d = Math.hypot(p.x - x, p.y - y);
      if (d < r) m.blasted(d, this.ctx);
    }
  }

  private checkLethalRegions() {
    const state = this.vehicle.riderState();
    const { x, y } = state === 'riding' ? this.tel : this.vehicle.riderPose();
    if (state !== 'dead') {
      for (const m of this.mechanisms) {
        const zone = m.crushZone();
        if (zone && x >= zone.x0 && x <= zone.x1 && y >= zone.y0 && y <= zone.y1) {
          this.die('crush', x, y);
          return;
        }
      }
    }
    const lost = (cause: DeathCause) => {
      if (state !== 'dead') this.die(cause, x, y);
      // The body is gone for good, so there is nothing left to wait for.
      this.deathCause = cause;
    };
    for (const k of this.level.killRegions) {
      if (x >= k.x0 && x <= k.x1 && y >= k.y0 && y <= k.y1) {
        lost('pit');
        return;
      }
    }
    const b = this.level.bounds;
    if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) lost('bounds');
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

  /** Attendance is attendance. The torso crossing the line counts, with or without the rest. */
  private checkFinish() {
    if (this.status !== 'playing') return;
    // A body lost to a pit or the edge of the map has not arrived anywhere.
    if (this.deathCause === 'pit' || this.deathCause === 'bounds') return;
    const f = this.level.finish;
    const state = this.vehicle.riderState();
    const rider = this.vehicle.riderPose();
    const x = state === 'riding' ? this.tel.x : rider.x;
    const y = state === 'riding' ? this.tel.y : rider.y;
    const before = state === 'riding' ? this.prevX : this.prevRiderX;
    if (before < f.x && x >= f.x && y >= f.y && y <= f.y + f.h) {
      this.status = 'finished';
      this.arrival = state;
      this.events.push({ t: 'finish', arrival: state });
    }
  }

  private die(cause: DeathCause, x: number, y: number) {
    if (this.status !== 'playing' || this.vehicle.riderState() === 'dead') return;
    const wasRiding = this.vehicle.riderState() === 'riding';
    this.deathCause = cause;
    if (cause === 'crush' && wasRiding) this.crushed = true;
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
