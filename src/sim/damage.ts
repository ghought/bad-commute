import { DAMAGE } from '../config/tuning';
import type { BodyRegion } from './filters';

export type DamageOutcome = 'none' | 'bruise' | 'sever' | 'lethal' | 'decapitate';

/**
 * The whole damage model. Contact speed and body region decide the outcome;
 * touching something is never enough on its own. Wheel and chassis contact does
 * not reach this function at all.
 */
export function evaluateImpact(region: BodyRegion, speed: number): DamageOutcome {
  switch (region) {
    case 'head':
      if (speed >= DAMAGE.head.decapitate) return 'decapitate';
      return speed >= DAMAGE.head.lethal ? 'lethal' : speed >= DAMAGE.limb.bruise ? 'bruise' : 'none';
    case 'torso':
      return speed >= DAMAGE.torso.lethal ? 'lethal' : speed >= DAMAGE.limb.bruise ? 'bruise' : 'none';
    case 'limb':
      return speed >= DAMAGE.limb.sever ? 'sever' : speed >= DAMAGE.limb.bruise ? 'bruise' : 'none';
  }
}

/** A cutter does not care how fast you were going. */
export function evaluateCutter(region: BodyRegion): DamageOutcome {
  return region === 'limb' ? 'sever' : region === 'head' ? 'decapitate' : 'lethal';
}

/** Stops one sustained contact from hurting the same part every step. */
export class ContactCooldown {
  private until = new Map<string, number>();

  constructor(private seconds: number = DAMAGE.contactCooldown) {}

  /** True when this part may take damage at `time`, and starts its cooldown. */
  claim(part: string, time: number): boolean {
    const next = this.until.get(part) ?? -Infinity;
    if (time < next) return false;
    this.until.set(part, time + this.seconds);
    return true;
  }
}
