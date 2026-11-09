import { Box, Circle, Vec2, type Body, type World } from 'planck';
import type { CompactorData, CutterData, MechanismRestore } from '../levels/schema';
import { CAT, MASK, type FixtureTag } from '../sim/filters';
import { Mechanism, type CrushZone, type MechContext } from './base';

/** A spinning disc. Passes through everything and cuts what it passes through. */
export class Cutter extends Mechanism {
  readonly type = 'cutter';
  body: Body;
  spin = 0;
  private t: number;

  constructor(readonly data: CutterData, world: World) {
    super(data.id, world);
    this.t = data.phase ?? 0;
    const [x, y] = this.position();
    this.body = this.kinematic(x, y);
    this.body.createFixture({
      shape: new Circle(data.r),
      filterCategoryBits: CAT.HAZARD,
      filterMaskBits: MASK.HAZARD,
      userData: { k: 'hazard', id: this.id, style: 'cutter' } satisfies FixtureTag,
    });
  }

  private position() {
    const d = this.data;
    if (d.bx === undefined || d.by === undefined || !d.period) return [d.x, d.y] as const;
    const u = 0.5 - 0.5 * Math.cos((2 * Math.PI * this.t) / d.period);
    return [d.x + (d.bx - d.x) * u, d.y + (d.by - d.y) * u] as const;
  }

  fixedUpdate(ctx: MechContext) {
    this.t += ctx.dt;
    this.spin += ctx.dt * 22;
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

const HEAD_DEPTH = 1.4;
const CRUSH_GAP = 1.7;

export type CompactorStage = 'rest' | 'warn' | 'slam' | 'hold' | 'rise';

/** A press on a fixed cycle. It has never once checked whether anything is underneath. */
export class Compactor extends Mechanism {
  readonly type = 'compactor';
  body: Body;
  t: number;
  stage: CompactorStage = 'rest';
  /** 0 fully raised, 1 fully down. */
  drop = 0;
  private lastStage: CompactorStage = 'rest';

  constructor(readonly data: CompactorData, world: World) {
    super(data.id, world);
    this.t = data.phase ?? 0;
    this.body = this.kinematic(data.x, data.top + HEAD_DEPTH / 2);
    this.addFixture(this.body, new Box(data.w / 2, HEAD_DEPTH / 2), { k: 'machine', id: this.id, crush: true });
    this.evaluate();
    this.lastStage = this.stage;
    this.body.setPosition(Vec2(data.x, this.bottom() + HEAD_DEPTH / 2));
  }

  private period() {
    const d = this.data;
    return d.rest + d.warn + d.slam + d.hold + d.rise;
  }

  private evaluate() {
    const d = this.data;
    let m = this.t % this.period();
    if (m < d.rest) {
      this.stage = 'rest';
      this.drop = 0;
      return;
    }
    m -= d.rest;
    if (m < d.warn) {
      this.stage = 'warn';
      this.drop = 0;
      return;
    }
    m -= d.warn;
    if (m < d.slam) {
      this.stage = 'slam';
      const u = m / d.slam;
      this.drop = u * u;
      return;
    }
    m -= d.slam;
    if (m < d.hold) {
      this.stage = 'hold';
      this.drop = 1;
      return;
    }
    m -= d.hold;
    this.stage = 'rise';
    this.drop = 1 - m / d.rise;
  }

  bottom() {
    const d = this.data;
    return d.top - (d.top - d.floor) * this.drop;
  }

  fixedUpdate(ctx: MechContext) {
    this.t += ctx.dt;
    this.evaluate();
    const d = this.data;
    if (this.stage !== this.lastStage) {
      if (this.stage === 'warn') ctx.emit({ t: 'mech', id: this.id, what: 'warn', x: d.x, y: d.floor });
      if (this.stage === 'hold') ctx.emit({ t: 'mech', id: this.id, what: 'slam', x: d.x, y: d.floor });
      this.lastStage = this.stage;
    }
    this.drive(this.body, d.x, this.bottom() + HEAD_DEPTH / 2, 0, ctx.dt);
  }

  crushZone(): CrushZone | null {
    const gap = this.bottom() - this.data.floor;
    if (gap > CRUSH_GAP || this.stage === 'rise') return null;
    const d = this.data;
    return { x0: d.x - d.w / 2, x1: d.x + d.w / 2, y0: d.floor - 0.5, y1: d.floor + gap + 0.2 };
  }

  restore(state: MechanismRestore) {
    if (state.phase === undefined) return;
    this.t = state.phase;
    this.evaluate();
    this.lastStage = this.stage;
    this.body.setPosition(Vec2(this.data.x, this.bottom() + HEAD_DEPTH / 2));
  }
}
