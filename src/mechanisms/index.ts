import type { World } from 'planck';
import type { PrefabData } from '../levels/schema';
import type { Mechanism } from './base';
import { Compactor, Cutter } from './hazards';
import { Conveyor, Lift, Shutter, Swing } from './movers';
import { Counterweight, Tilt } from './plates';
import { Brace, Bridge, Cargo, Latch } from './release';
import { Fan, Mine, Npc, Prop, Spikes, Spring, Wrecker } from './toys';

export function buildMechanism(data: PrefabData, world: World): Mechanism {
  switch (data.type) {
    case 'counterweight':
      return new Counterweight(data, world);
    case 'tilt':
      return new Tilt(data, world);
    case 'latch':
      return new Latch(data, world);
    case 'brace':
      return new Brace(data, world);
    case 'bridge':
      return new Bridge(data, world);
    case 'cargo':
      return new Cargo(data, world);
    case 'conveyor':
      return new Conveyor(data, world);
    case 'lift':
      return new Lift(data, world);
    case 'swing':
      return new Swing(data, world);
    case 'shutter':
      return new Shutter(data, world);
    case 'cutter':
      return new Cutter(data, world);
    case 'compactor':
      return new Compactor(data, world);
    case 'prop':
      return new Prop(data, world);
    case 'mine':
      return new Mine(data, world);
    case 'spring':
      return new Spring(data, world);
    case 'fan':
      return new Fan(data, world);
    case 'wrecker':
      return new Wrecker(data, world);
    case 'spikes':
      return new Spikes(data, world);
    case 'npc':
      return new Npc(data, world);
  }
}

export { Compactor, Cutter, Conveyor, Lift, Shutter, Swing, Counterweight, Tilt, Brace, Bridge, Cargo, Latch, Fan, Mine, Npc, Prop, Spikes, Spring, Wrecker };
