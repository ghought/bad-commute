import {
  Body,
  Box,
  Circle,
  Joint,
  Polygon,
  RevoluteJoint,
  Vec2,
  WheelJoint,
  World,
} from 'planck';
import { approach, clamp, deg, wrapAngle } from '../../core/math';
import type { VehicleCommand } from '../../input/actions';
import { CAT, MASK, type BodyRegion, type FixtureTag, type RiderPartId } from '../../sim/filters';
import type { BodyPose, Pose, VehicleController, VehicleDefinition, VehicleTelemetry } from '../types';
import type { MotorbikePhysics, MotorbikeRider } from './definition';

type LimbKey = 'armN' | 'armF' | 'legN' | 'legF';

interface Limb {
  key: LimbKey;
  upper: RiderPartId;
  lower: RiderPartId;
  root: Joint | null;
  mid: Joint | null;
  end: Joint | null;
}

const LIMB_PARTS: Array<[LimbKey, RiderPartId, RiderPartId, BodyRegion]> = [
  ['armN', 'armUpperN', 'armLowerN', 'limb'],
  ['armF', 'armUpperF', 'armLowerF', 'limb'],
  ['legN', 'legUpperN', 'legLowerN', 'limb'],
  ['legF', 'legUpperF', 'legLowerF', 'limb'],
];

function polygonArea(points: ReadonlyArray<readonly [number, number]>) {
  let a = 0;
  for (let i = 0; i < points.length; i++) {
    const [x0, y0] = points[i];
    const [x1, y1] = points[(i + 1) % points.length];
    a += x0 * y1 - x1 * y0;
  }
  return Math.abs(a) / 2;
}

/** Elbow or knee position for a two-bone chain. `bend` picks the side. */
function solveJoint(sx: number, sy: number, tx: number, ty: number, a: number, b: number, bend: number) {
  const dx = tx - sx;
  const dy = ty - sy;
  const d = clamp(Math.hypot(dx, dy), Math.abs(a - b) + 1e-3, a + b - 1e-3);
  const cos = clamp((a * a + d * d - b * b) / (2 * a * d), -1, 1);
  const base = Math.atan2(dy, dx) + bend * Math.acos(cos);
  return [sx + Math.cos(base) * a, sy + Math.sin(base) * a] as const;
}

export type MotorbikeDef = VehicleDefinition<MotorbikePhysics, MotorbikeRider>;

export class MotorbikeController implements VehicleController {
  readonly def: MotorbikeDef;
  private world!: World;
  chassis!: Body;
  wheels: Body[] = [];
  private suspension: WheelJoint[] = [];
  parts = new Map<RiderPartId, Body>();
  limbs = new Map<LimbKey, Limb>();
  private hipJoint: RevoluteJoint | null = null;
  private neckJoint: Joint | null = null;
  /** Parts no longer attached to the living rider, in the order they came off. */
  detached = new Set<RiderPartId>();
  private alive = true;
  private wheelContacts: number[] = [0, 0];
  private chassisContacts = 0;
  private leanPose = 0;
  private reverseTimer = 0;
  private cmd: VehicleCommand = { throttle: 0, brake: 0, lean: 0 };
  private ballast = 0;

  constructor(def: MotorbikeDef) {
    this.def = def;
  }

  spawn(world: World, pose: Pose) {
    this.world = world;
    const p = this.def.physics;
    const toWorld = (lx: number, ly: number) => {
      const c = Math.cos(pose.angle);
      const s = Math.sin(pose.angle);
      return Vec2(pose.x + lx * c - ly * s, pose.y + lx * s + ly * c);
    };

    const bikeFilter = { filterCategoryBits: CAT.BIKE, filterMaskBits: MASK.BIKE };
    this.chassis = world.createBody({
      type: 'dynamic',
      position: Vec2(pose.x, pose.y),
      angle: pose.angle,
      bullet: true,
      allowSleep: false,
      angularDamping: 0.7,
    });
    const outline = p.chassisOutline.map(([x, y]) => Vec2(x, y));
    this.chassis.createFixture({
      shape: new Polygon(outline),
      density: p.chassisMass / polygonArea(p.chassisOutline),
      friction: 0.35,
      restitution: 0.05,
      ...bikeFilter,
      userData: { k: 'chassis' } satisfies FixtureTag,
    });

    const axles = [p.rearAxle, p.frontAxle];
    const axes = [p.rearAxis, p.frontAxis];
    const hz = [p.suspension.rearHz, p.suspension.frontHz];
    axles.forEach(([lx, ly], index) => {
      const wheel = world.createBody({
        type: 'dynamic',
        position: toWorld(lx, ly),
        angle: pose.angle,
        bullet: true,
        allowSleep: false,
      });
      const r = p.wheel.radius;
      wheel.createFixture({
        shape: new Circle(r),
        density: p.wheel.mass / (Math.PI * r * r),
        friction: p.wheel.friction,
        restitution: p.wheel.restitution,
        ...bikeFilter,
        userData: { k: 'wheel', index } satisfies FixtureTag,
      });
      const axis = Vec2(axes[index][0], axes[index][1]);
      axis.normalize();
      const joint = world.createJoint(
        new WheelJoint(
          {
            frequencyHz: hz[index],
            dampingRatio: p.suspension.damping,
            enableMotor: true,
            maxMotorTorque: 0,
            motorSpeed: 0,
          },
          this.chassis,
          wheel,
          wheel.getPosition(),
          this.chassis.getWorldVector(axis),
        ),
      ) as WheelJoint;
      this.wheels.push(wheel);
      this.suspension.push(joint);
    });

    this.spawnRider(pose, toWorld);
  }

  private riderBody(
    part: RiderPartId,
    region: BodyRegion,
    x: number,
    y: number,
    angle: number,
    shape: Box | Circle,
    density: number,
  ) {
    const body = this.world.createBody({
      type: 'dynamic',
      position: Vec2(x, y),
      angle,
      bullet: true,
      allowSleep: false,
      linearDamping: 0.02,
      angularDamping: 0.6,
    });
    body.createFixture({
      shape,
      density,
      friction: 0.6,
      restitution: 0.12,
      filterCategoryBits: CAT.RIDER,
      filterMaskBits: MASK.RIDER,
      userData: { k: 'rider', part, region } satisfies FixtureTag,
    });
    this.parts.set(part, body);
    return body;
  }

  private segment(part: RiderPartId, from: Vec2, to: Vec2, mass: number, halfWidth: number) {
    const dx = to.x - from.x;
    const dy = to.y - from.y;
    const len = Math.hypot(dx, dy);
    const angle = Math.atan2(dx, -dy);
    return this.riderBody(
      part,
      'limb',
      (from.x + to.x) / 2,
      (from.y + to.y) / 2,
      angle,
      new Box(halfWidth, len / 2),
      mass / (4 * halfWidth * (len / 2)),
    );
  }

  private revolute(a: Body, b: Body, anchor: Vec2, limits?: [number, number]) {
    return this.world.createJoint(
      new RevoluteJoint(
        limits
          ? { enableLimit: true, lowerAngle: limits[0], upperAngle: limits[1], collideConnected: false }
          : { collideConnected: false },
        a,
        b,
        anchor,
      ),
    ) as RevoluteJoint;
  }

  private spawnRider(pose: Pose, toWorld: (x: number, y: number) => Vec2) {
    const r = this.def.rider;
    const hip = toWorld(r.hip[0], r.hip[1]);
    const grip = toWorld(r.grip[0], r.grip[1]);
    const peg = toWorld(r.peg[0], r.peg[1]);

    const torsoAngle = pose.angle + r.torsoRest;
    const up = Vec2(-Math.sin(torsoAngle), Math.cos(torsoAngle));
    const torsoCentre = Vec2(hip.x + (up.x * r.torsoLength) / 2, hip.y + (up.y * r.torsoLength) / 2);
    const shoulder = Vec2(hip.x + up.x * (r.torsoLength - 0.03), hip.y + up.y * (r.torsoLength - 0.03));
    const neck = Vec2(hip.x + up.x * r.torsoLength, hip.y + up.y * r.torsoLength);
    const headCentre = Vec2(neck.x + up.x * r.headOffset, neck.y + up.y * r.headOffset);

    const torso = this.riderBody(
      'torso',
      'torso',
      torsoCentre.x,
      torsoCentre.y,
      torsoAngle,
      new Box(r.torsoHalfWidth, r.torsoLength / 2),
      r.masses.torso / (4 * r.torsoHalfWidth * (r.torsoLength / 2)),
    );
    const head = this.riderBody(
      'head',
      'head',
      headCentre.x,
      headCentre.y,
      torsoAngle,
      new Circle(r.headRadius),
      r.masses.head / (Math.PI * r.headRadius * r.headRadius),
    );

    this.hipJoint = this.world.createJoint(
      new RevoluteJoint(
        {
          enableLimit: true,
          lowerAngle: -r.leanForward,
          upperAngle: r.leanBack,
          enableMotor: true,
          maxMotorTorque: r.hipMotorTorque,
          motorSpeed: 0,
          collideConnected: false,
        },
        this.chassis,
        torso,
        hip,
      ),
    ) as RevoluteJoint;
    this.neckJoint = this.revolute(torso, head, neck, [deg(-18), deg(18)]);

    const elbow = solveJoint(shoulder.x, shoulder.y, grip.x, grip.y, r.armUpper, r.armLower, -1);
    const knee = solveJoint(hip.x, hip.y, peg.x, peg.y, r.legUpper, r.legLower, 1);

    for (const [key, upperId, lowerId] of LIMB_PARTS) {
      const isArm = key.startsWith('arm');
      const root = isArm ? shoulder : hip;
      const mid = Vec2(isArm ? elbow[0] : knee[0], isArm ? elbow[1] : knee[1]);
      const tip = isArm ? grip : peg;
      const upperMass = isArm ? r.masses.armUpper : r.masses.legUpper;
      const lowerMass = isArm ? r.masses.armLower : r.masses.legLower;
      const halfWidth = isArm ? 0.05 : 0.07;
      const upper = this.segment(upperId, root, mid, upperMass, halfWidth);
      const lower = this.segment(lowerId, mid, tip, lowerMass, halfWidth * 0.85);

      const bend0 = wrapAngle(lower.getAngle() - upper.getAngle());
      const sign = bend0 >= 0 ? 1 : -1;
      const a = sign * deg(4) - bend0;
      const b = sign * deg(150) - bend0;
      const rootLimit = isArm ? deg(165) : deg(110);

      this.limbs.set(key, {
        key,
        upper: upperId,
        lower: lowerId,
        root: this.revolute(torso, upper, root, [-rootLimit, rootLimit]),
        mid: this.revolute(upper, lower, mid, [Math.min(a, b), Math.max(a, b)]),
        end: this.revolute(this.chassis, lower, tip),
      });
    }
  }

  isAlive() {
    return this.alive;
  }

  contactChanged(tag: FixtureTag, delta: 1 | -1) {
    if (tag.k === 'wheel') this.wheelContacts[tag.index] += delta;
    else if (tag.k === 'chassis') this.chassisContacts += delta;
  }

  /** Rolling speed the engine is trying to hold, in rad/s. Negative rolls forward. */
  private applyDrive(dt: number, cmd: VehicleCommand, forwardSpeed: number) {
    const { engine, brake, wheel } = this.def.physics;
    const [rear, front] = this.suspension;

    if (!this.alive) {
      rear.setMaxMotorTorque(engine.coastDrag);
      rear.setMotorSpeed(0);
      front.setMaxMotorTorque(0);
      return;
    }

    if (cmd.brake) {
      if (Math.abs(forwardSpeed) < brake.reverseNearRest) this.reverseTimer += dt;
      else if (forwardSpeed > 0) this.reverseTimer = 0;

      if (this.reverseTimer >= brake.reverseDelay) {
        rear.setMotorSpeed(brake.reverseSpeed / wheel.radius);
        rear.setMaxMotorTorque(brake.reverseTorque);
        front.setMaxMotorTorque(0);
      } else {
        rear.setMotorSpeed(0);
        rear.setMaxMotorTorque(brake.rearTorque);
        front.setMotorSpeed(0);
        front.setMaxMotorTorque(brake.frontTorque);
      }
      return;
    }

    this.reverseTimer = 0;
    front.setMaxMotorTorque(0);
    if (cmd.throttle) {
      const omegaMax = engine.topSpeed / wheel.radius;
      const omega = Math.abs(this.wheels[0].getAngularVelocity() - this.chassis.getAngularVelocity());
      const load = clamp(omega / omegaMax, 0, 1);
      const torque = engine.peakTorque * Math.max(engine.torqueFloor, 1 - load * load * load);
      rear.setMotorSpeed(-omegaMax);
      rear.setMaxMotorTorque(torque);
    } else {
      rear.setMotorSpeed(0);
      rear.setMaxMotorTorque(engine.coastDrag);
    }
  }

  private applyLean(dt: number, cmd: VehicleCommand) {
    const { lean } = this.def.physics;
    const r = this.def.rider;
    const lean01 = this.alive ? cmd.lean : 0;
    this.leanPose = approach(this.leanPose, lean01, dt / lean.poseTransition);

    if (this.hipJoint) {
      const target = this.leanPose >= 0 ? this.leanPose * r.leanBack : this.leanPose * r.leanForward;
      const error = target - this.hipJoint.getJointAngle();
      this.hipJoint.setMotorSpeed(clamp(error * r.hipMotorGain, -r.hipMotorMaxRate, r.hipMotorMaxRate));
    }

    if (!this.alive || cmd.lean === 0) return;

    const rear = this.wheelContacts[0] > 0;
    const front = this.wheelContacts[1] > 0;
    const torque = rear && front ? lean.groundTorque : rear || front ? lean.wheelieTorque : lean.airTorque;
    const rate = this.chassis.getAngularVelocity();
    const limit = rear !== front ? lean.wheelieRate : lean.maxPitchRate;
    if (cmd.lean > 0 ? rate < limit : rate > -limit) {
      this.chassis.applyTorque(cmd.lean * torque, true);
    }
  }

  /** WheelJoint has no travel limits, so the stops are applied here. */
  private applyBumpStops() {
    const { maxCompress, maxDroop } = this.def.physics.suspension;
    const chassis = this.chassis;
    const massA = chassis.getMass();
    for (let i = 0; i < 2; i++) {
      const joint = this.suspension[i];
      const wheel = this.wheels[i];
      const t = joint.getJointTranslation();
      const over = t > maxCompress ? t - maxCompress : t < -maxDroop ? t + maxDroop : 0;
      if (over === 0) continue;
      const axis = chassis.getWorldVector(joint.getLocalAxisA());
      const pos = wheel.getPosition();
      const relA = chassis.getLinearVelocityFromWorldPoint(pos);
      const relB = wheel.getLinearVelocity();
      const speed = (relB.x - relA.x) * axis.x + (relB.y - relA.y) * axis.y;
      // Only remove travel that is still going the wrong way, plus a gentle pull back.
      const wanted = -over * 14;
      const delta = over > 0 ? Math.min(wanted - speed, 0) : Math.max(wanted - speed, 0);
      if (delta === 0) continue;
      const armX = pos.x - chassis.getWorldCenter().x;
      const armY = pos.y - chassis.getWorldCenter().y;
      const cross = armX * axis.y - armY * axis.x;
      // A wheel pressed against the ground cannot give, so the chassis takes the whole stop.
      const pinned = over > 0 && this.wheelContacts[i] > 0;
      const carried = massA + this.riderCarried();
      const eff = pinned
        ? 1 / (1 / carried + (cross * cross) / chassis.getInertia())
        : 1 / (1 / massA + 1 / wheel.getMass() + (cross * cross) / chassis.getInertia());
      const impulse = eff * delta;
      if (!pinned) wheel.applyLinearImpulse(Vec2(axis.x * impulse, axis.y * impulse), pos, true);
      chassis.applyLinearImpulse(Vec2(-axis.x * impulse, -axis.y * impulse), pos, true);
    }
  }

  private riderCarried() {
    if (!this.alive) return 0;
    const m = this.def.rider.masses;
    return m.torso + m.head + 2 * (m.armUpper + m.armLower + m.legUpper + m.legLower);
  }

  fixedUpdate(dt: number, cmd: VehicleCommand) {
    this.cmd = cmd;
    const v = this.chassis.getLinearVelocity();
    const fwd = this.chassis.getWorldVector(Vec2(1, 0));
    const forwardSpeed = v.x * fwd.x + v.y * fwd.y;
    this.applyDrive(dt, cmd, forwardSpeed);
    this.applyLean(dt, cmd);
    this.applyBumpStops();
  }

  telemetry(): VehicleTelemetry {
    const p = this.chassis.getPosition();
    const v = this.chassis.getLinearVelocity();
    const fwd = this.chassis.getWorldVector(Vec2(1, 0));
    const forward = v.x * fwd.x + v.y * fwd.y;
    const rearOmega = this.wheels[0].getAngularVelocity();
    const wheelSpeed = -rearOmega * this.def.physics.wheel.radius;
    return {
      x: p.x,
      y: p.y,
      angle: this.chassis.getAngle(),
      vx: v.x,
      vy: v.y,
      speed: Math.hypot(v.x, v.y),
      angularVelocity: this.chassis.getAngularVelocity(),
      grounded: (this.wheelContacts[0] > 0 ? 1 : 0) + (this.wheelContacts[1] > 0 ? 1 : 0),
      throttle: this.cmd.throttle,
      brake: this.cmd.brake,
      slip: this.wheelContacts[0] > 0 ? Math.abs(wheelSpeed - forward) : 0,
      wheelSpeed,
      suspension: this.suspension.map((j) => j.getJointTranslation()),
    };
  }

  wheelGrounded(index: number) {
    return this.wheelContacts[index] > 0;
  }

  chassisTouching() {
    return this.chassisContacts > 0;
  }

  ghostPose(out: BodyPose[]) {
    const put = (id: string, b: Body) => {
      const p = b.getPosition();
      out.push({ id, x: p.x, y: p.y, angle: b.getAngle() });
    };
    put('chassis', this.chassis);
    put('rear', this.wheels[0]);
    put('front', this.wheels[1]);
    for (const [id, body] of this.parts) put(id, body);
  }

  private toGore(part: RiderPartId) {
    const body = this.parts.get(part);
    if (!body || this.detached.has(part)) return;
    this.detached.add(part);
    body.setBullet(false);
    body.setSleepingAllowed(true);
    for (let f = body.getFixtureList(); f; f = f.getNext()) {
      f.setFilterData({ groupIndex: 0, categoryBits: CAT.GORE, maskBits: MASK.GORE });
      f.setUserData({ k: 'gore' } satisfies FixtureTag);
    }
    // Lost mass moves to the torso, so the living rider handles the same.
    if (this.alive) this.addBallast(body.getMass());
  }

  private addBallast(mass: number) {
    const torso = this.parts.get('torso');
    if (!torso) return;
    this.ballast += mass;
    const data = { mass: 0, center: Vec2(0, 0), I: 0 };
    torso.getMassData(data);
    const ratio = (data.mass + mass) / data.mass;
    data.I *= ratio;
    data.mass += mass;
    torso.setMassData(data);
  }

  /** Mass moved onto the torso so far, for tests and diagnostics. */
  ballastMass() {
    return this.ballast;
  }

  private removeJoint(j: Joint | null) {
    if (j) this.world.destroyJoint(j);
    return null;
  }

  sever(part: RiderPartId): boolean {
    if (this.detached.has(part)) return false;
    for (const limb of this.limbs.values()) {
      if (limb.upper === part) {
        limb.root = this.removeJoint(limb.root);
        limb.end = this.removeJoint(limb.end);
        this.toGore(limb.upper);
        this.toGore(limb.lower);
        return true;
      }
      if (limb.lower === part) {
        limb.mid = this.removeJoint(limb.mid);
        limb.end = this.removeJoint(limb.end);
        this.toGore(limb.lower);
        return true;
      }
    }
    return false;
  }

  decapitate(): boolean {
    if (this.detached.has('head')) return false;
    this.neckJoint = this.removeJoint(this.neckJoint);
    this.toGore('head');
    return true;
  }

  kill() {
    if (!this.alive) return;
    this.alive = false;
    this.hipJoint = this.removeJoint(this.hipJoint) as null;
    for (const limb of this.limbs.values()) limb.end = this.removeJoint(limb.end);
  }

  settle() {
    for (const body of this.parts.values()) {
      body.setBullet(false);
      body.setSleepingAllowed(true);
    }
  }

  dispose() {
    this.parts.clear();
    this.limbs.clear();
    this.wheels = [];
    this.suspension = [];
    this.hipJoint = null;
    this.neckJoint = null;
  }
}
