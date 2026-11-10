import { clamp } from '../core/math';
import type { ActionState } from '../input/actions';
import { emptyActions, toCommand } from '../input/actions';
import type { Mechanism } from '../mechanisms/base';
import type { Simulation } from './Simulation';

/**
 * A route is how the verifier proves a course can be ridden. It presses only the
 * same actions a player has, on the same fixed step.
 */
export interface RouteStep {
  /** The step ends once the chassis passes this x. */
  x: number;
  /** Speed to hold on this stretch, in m/s. */
  v: number;
  /** Pitch to hold while airborne, in radians. */
  air?: number;
  /** Hold a lean on this stretch: 1 back, -1 forward. */
  lean?: number;
  /** Fire the ejector seat as this stretch begins. */
  eject?: boolean;
  /** Off the bike: heave along the ground on this stretch. */
  flop?: boolean;
  /** At the end of the step, stop and wait for this. */
  hold?: {
    id?: string;
    gte?: number;
    lte?: number;
    /** Extra seconds to wait after the condition is met. */
    after?: number;
  };
}

export interface Route {
  steps: RouteStep[];
}

/** One number describing a mechanism's progress, for route conditions. */
export function mechanismValue(m: Mechanism): number {
  const r = m as unknown as Record<string, number | boolean | string>;
  switch (m.type) {
    case 'counterweight':
      return r.p as number;
    case 'tilt':
      return r.angle as number;
    case 'lift':
      return r.u as number;
    case 'swing':
      return r.theta as number;
    case 'wrecker':
      return r.cycle as number;
    case 'shutter':
      return r.open as number;
    case 'compactor':
      return r.drop as number;
    case 'bridge':
      return r.released ? 1 : 0;
    case 'cargo':
      return r.arrived ? 1 : 0;
    default:
      return 0;
  }
}

export class Autopilot {
  private index = 0;
  private waited = 0;
  private holding = false;
  private tapPhase = 0;
  readonly actions: ActionState = emptyActions();

  constructor(private route: Route) {}

  get stepIndex() {
    return this.index;
  }

  /** The inputs for this step of the simulation. */
  decide(sim: Simulation, dt: number): ActionState {
    const a = this.actions;
    Object.assign(a, emptyActions());
    const t = sim.telemetry();

    while (this.index < this.route.steps.length) {
      const step = this.route.steps[this.index];
      if (t.x < step.x) break;
      if (step.hold && !this.holdSatisfied(sim, step, dt)) {
        this.holding = true;
        break;
      }
      this.index++;
      this.waited = 0;
      this.holding = false;
    }

    const step = this.route.steps[Math.min(this.index, this.route.steps.length - 1)];
    const target = this.holding ? 0 : step.v;

    if (sim.riderState() !== 'riding') {
      // Off the bike there is one plan: keep heaving towards the finish.
      a.throttle = true;
      return a;
    }
    if (step.eject && !this.holding) {
      a.eject = true;
      a.throttle = true;
      return a;
    }

    // Speed along the direction of travel. Platforms under the bike do not count.
    const forward = t.vx * Math.cos(t.angle) + t.vy * Math.sin(t.angle);
    this.tapPhase = (this.tapPhase + 1) % 14;
    if (this.holding || target <= 0.05) {
      // Tap the brake, so a long wait never engages reverse.
      if (Math.abs(forward) > 0.35 && forward > 0 && this.tapPhase < 12) a.brake = true;
      else if (forward < -0.4) a.throttle = true;
    } else if (forward < target - 0.25) {
      a.throttle = true;
    } else if (forward > target + 0.8) {
      a.brake = true;
    }

    if (t.grounded === 0) {
      const goal = step.air ?? 0;
      const u = (goal - t.angle) * 4.2 - t.angularVelocity * 1.05;
      if (u > 0.35) a.leanBack = true;
      else if (u < -0.35) a.leanForward = true;
    } else if (step.lean === 1 && !this.holding) {
      if (t.angle < 0.75 || t.angularVelocity < -0.4) a.leanBack = true;
      else if (t.angle > 1.05) a.leanForward = true;
    } else if (step.lean === -1 && !this.holding) {
      a.leanForward = true;
    } else if (t.grounded === 1) {
      // Bring a stray wheel back down.
      const u = clamp(-t.angle, -1, 1) * 3 - t.angularVelocity;
      if (u > 0.6) a.leanBack = true;
      else if (u < -0.6) a.leanForward = true;
    }
    return a;
  }

  private holdSatisfied(sim: Simulation, step: RouteStep, dt: number) {
    const h = step.hold!;
    if (h.id) {
      const m = sim.mechanism(h.id);
      if (!m) return true;
      const v = mechanismValue(m);
      const ok = (h.gte === undefined || v >= h.gte) && (h.lte === undefined || v <= h.lte);
      if (!ok) {
        this.waited = 0;
        return false;
      }
    }
    this.waited += dt;
    return this.waited >= (h.after ?? 0);
  }
}

export interface RouteResult {
  status: Simulation['status'];
  arrival: Simulation['arrival'];
  time: number;
  tag: boolean;
  maxX: number;
  cause: string | null;
  steps: number;
  /** How close the bike ever came to the tag, in metres. */
  tagDistance: number;
  /** The bike's position at that moment. */
  tagNear: readonly [number, number];
}

/** Plays a route on a simulation and reports what happened. */
export function runRoute(sim: Simulation, route: Route, maxSeconds = 150): RouteResult {
  const pilot = new Autopilot(route);
  const dt = 1 / 60;
  let maxX = sim.telemetry().x;
  let steps = 0;
  const limit = maxSeconds * 60;
  let tagDistance = Infinity;
  let tagNear: readonly [number, number] = [0, 0];
  // The clock starts on the first input, like any other attempt.
  sim.step({ throttle: 1, brake: 0, lean: 0 });
  while (steps < limit && sim.status === 'playing') {
    sim.step(toCommand(pilot.decide(sim, dt)));
    sim.events.length = 0;
    const t = sim.telemetry();
    maxX = Math.max(maxX, t.x);
    const d = Math.hypot(t.x - sim.level.tag.x, t.y - sim.level.tag.y);
    if (d < tagDistance) {
      tagDistance = d;
      tagNear = [t.x, t.y];
    }
    steps++;
  }
  return { status: sim.status, arrival: sim.arrival, time: sim.time, tag: sim.tag, maxX, cause: sim.deathCause, steps, tagDistance, tagNear };
}
