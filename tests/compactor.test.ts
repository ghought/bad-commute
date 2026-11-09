import { describe, expect, it } from 'vitest';
import type { Compactor } from '../src/mechanisms';
import { flat, makeSim, run } from './helpers';

describe('compactor cycle', () => {
  it('rests, warns, slams and rises on schedule, every restart', () => {
    const l = flat({ prefabs: [{ type: 'compactor', id: 'c', x: 40, w: 5, top: 6, floor: 0, rest: 0.5, warn: 0.5, slam: 0.25, hold: 0.25, rise: 0.5 }] });
    const stagesOf = () => {
      const s = makeSim(l);
      const m = s.mechanism<Compactor>('c')!;
      const seen: string[] = [];
      for (let i = 0; i < 130; i++) {
        run(s, 1);
        if (seen[seen.length - 1] !== m.stage) seen.push(m.stage);
      }
      return seen;
    };
    const a = stagesOf();
    expect(a.slice(0, 5)).toEqual(['rest', 'warn', 'slam', 'hold', 'rise']);
    expect(stagesOf()).toEqual(a);
  });
});
