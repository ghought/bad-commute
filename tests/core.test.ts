import { describe, expect, it } from 'vitest';
import { GameFSM } from '../src/game/fsm';
import { emptyActions, toCommand } from '../src/input/actions';
import { DEFAULT_KEYS, InputAdapter } from '../src/input/adapter';
import { ContactCooldown, evaluateCutter, evaluateImpact } from '../src/sim/damage';
import { DAMAGE } from '../src/config/tuning';
import { Camera } from '../src/render/camera';

describe('game state machine', () => {
  const inLevel = () => {
    const f = new GameFSM();
    f.send('BOOTED');
    f.send('ENTER_LEVEL');
    return f;
  };

  it('walks a normal run', () => {
    const f = inLevel();
    expect(f.state).toBe('ready');
    expect(f.send('INPUT')).toBe('playing');
    expect(f.send('FINISH')).toBe('finished');
    expect(f.send('RESTART')).toBe('ready');
  });

  it('resumes to wherever pause came from', () => {
    const f = inLevel();
    f.send('PAUSE');
    expect(f.send('RESUME')).toBe('ready');
    f.send('INPUT');
    f.send('PAUSE');
    expect(f.send('RESUME')).toBe('playing');
    f.send('CRASH');
    f.send('PAUSE');
    expect(f.send('RESUME')).toBe('crashed');
  });

  it('cannot finish a crashed run or crash a finished one', () => {
    const f = inLevel();
    f.send('INPUT');
    f.send('CRASH');
    expect(f.send('FINISH')).toBe('crashed');
    const g = inLevel();
    g.send('INPUT');
    g.send('FINISH');
    expect(g.send('CRASH')).toBe('finished');
  });

  it('allows restart from any state in a level', () => {
    for (const setup of [['INPUT'], ['INPUT', 'CRASH'], ['INPUT', 'FINISH'], ['PAUSE']] as const) {
      const f = inLevel();
      for (const e of setup) f.send(e);
      expect(f.send('RESTART')).toBe('ready');
    }
  });
});

describe('input', () => {
  it('gives brake priority over throttle', () => {
    const a = { ...emptyActions(), throttle: true, brake: true };
    expect(toCommand(a)).toMatchObject({ throttle: 0, brake: 1 });
  });

  it('cancels opposing leans', () => {
    expect(toCommand({ ...emptyActions(), leanBack: true, leanForward: true }).lean).toBe(0);
    expect(toCommand({ ...emptyActions(), leanBack: true }).lean).toBe(1);
    expect(toCommand({ ...emptyActions(), leanForward: true }).lean).toBe(-1);
  });

  it('holds all four actions at once from four pointers', () => {
    const i = new InputAdapter();
    i.pointerSet(1, 'throttle');
    i.pointerSet(2, 'brake');
    i.pointerSet(3, 'leanBack');
    i.pointerSet(4, 'leanForward');
    expect(i.state).toEqual({ throttle: true, brake: true, leanBack: true, leanForward: true, eject: false });
    i.pointerUp(3);
    expect(i.state.leanBack).toBe(false);
    expect(i.state.throttle).toBe(true);
  });

  it('does not release an action while another source holds it', () => {
    const i = new InputAdapter();
    i.keyDown('KeyW');
    i.keyDown('ArrowUp');
    i.keyUp('KeyW');
    expect(i.state.throttle).toBe(true);
    i.keyUp('ArrowUp');
    expect(i.state.throttle).toBe(false);
  });

  it('never leaves inputs stuck after a cancel or clear', () => {
    const i = new InputAdapter();
    i.keyDown('KeyD');
    i.pointerSet(9, 'throttle');
    i.clear();
    expect(i.state).toEqual(emptyActions());
    expect(i.activePointers()).toBe(0);
    i.keyUp('KeyD');
    i.pointerUp(9);
    expect(i.state).toEqual(emptyActions());
  });

  it('slides a finger between buttons', () => {
    const i = new InputAdapter();
    i.pointerSet(1, 'brake');
    i.pointerSet(1, 'throttle');
    expect(i.state).toMatchObject({ brake: false, throttle: true });
    i.pointerSet(1, null);
    expect(i.state.throttle).toBe(false);
  });

  it('supports remapping', () => {
    const i = new InputAdapter({ ...DEFAULT_KEYS, throttle: ['KeyI'] });
    expect(i.keyDown('KeyW')).toBe(false);
    i.keyDown('KeyI');
    expect(i.state.throttle).toBe(true);
  });
});

describe('damage model', () => {
  it('uses severity and region, not mere contact', () => {
    expect(evaluateImpact('head', 1)).toBe('none');
    expect(evaluateImpact('limb', 1)).toBe('none');
    expect(evaluateImpact('torso', 1)).toBe('none');
    expect(evaluateImpact('limb', DAMAGE.limb.bruise + 0.1)).toBe('bruise');
    expect(evaluateImpact('limb', DAMAGE.limb.sever + 0.1)).toBe('sever');
    expect(evaluateImpact('head', DAMAGE.head.lethal + 0.1)).toBe('lethal');
    expect(evaluateImpact('head', DAMAGE.head.decapitate + 0.1)).toBe('decapitate');
    expect(evaluateImpact('torso', DAMAGE.torso.lethal + 0.1)).toBe('lethal');
  });

  it('cutters sever limbs and kill everything else', () => {
    expect(evaluateCutter('limb')).toBe('sever');
    expect(evaluateCutter('torso')).toBe('lethal');
    expect(evaluateCutter('head')).toBe('decapitate');
  });

  it('limits repeat damage from one sustained contact', () => {
    const c = new ContactCooldown(0.2);
    expect(c.claim('head', 1)).toBe(true);
    expect(c.claim('head', 1.1)).toBe(false);
    expect(c.claim('torso', 1.1)).toBe(true);
    expect(c.claim('head', 1.21)).toBe(true);
  });
});

describe('camera', () => {
  it('keeps the rider in the left third when moving forward', () => {
    const cam = new Camera([], { x0: -100, x1: 1000, y0: -50, y1: 100 });
    cam.snap({ x: 0, y: 0, vx: 0, speed: 0 });
    for (let i = 0; i < 600; i++) cam.update(1 / 60, { x: i * 0.2, y: 0, vx: 12, speed: 12 }, false);
    const screenX = (119.8 - (cam.x - cam.viewW / 2)) / cam.viewW;
    expect(screenX).toBeLessThan(0.34);
    expect(screenX).toBeGreaterThan(0.05);
  });

  it('honours zones', () => {
    const cam = new Camera([{ x0: 0, x1: 50, y: 7, zoom: 3 }], { x0: -100, x1: 1000, y0: -50, y1: 100 });
    cam.snap({ x: 10, y: 0, vx: 0, speed: 0 });
    for (let i = 0; i < 400; i++) cam.update(1 / 60, { x: 10, y: 0, vx: 0, speed: 0 }, false);
    expect(cam.y).toBeCloseTo(7, 1);
    expect(cam.viewH).toBeGreaterThan(13);
  });

  it('does not shake in reduced-motion mode', () => {
    const cam = new Camera([], { x0: -100, x1: 1000, y0: -50, y1: 100 });
    cam.addShake(0.4);
    cam.update(1 / 60, { x: 0, y: 0, vx: 0, speed: 0 }, true);
    expect(cam.shake).toBe(0);
  });
});

describe('boundaries', () => {
  it('keeps presentation and storage out of the simulation', async () => {
    const { readdirSync, readFileSync } = await import('node:fs');
    for (const dir of ['sim', 'mechanisms', 'vehicles', 'vehicles/motorbike']) {
      const base = new URL(`../src/${dir}/`, import.meta.url);
      for (const file of readdirSync(base).filter((f) => f.endsWith('.ts'))) {
        const text = readFileSync(new URL(file, base), 'utf8');
        expect(text, `${dir}/${file}`).not.toMatch(/from '.*\/(render|ui|audio|store)\//);
        expect(text, `${dir}/${file}`).not.toMatch(/\b(document|window)\./);
      }
    }
  });
});
