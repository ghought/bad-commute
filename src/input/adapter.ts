import { emptyActions, type ActionState } from './actions';

export type ActionName = keyof ActionState;
export type KeyMap = Record<ActionName, string[]>;

export const DEFAULT_KEYS: KeyMap = {
  throttle: ['KeyW', 'ArrowUp'],
  brake: ['KeyS', 'ArrowDown'],
  leanBack: ['KeyA', 'ArrowLeft'],
  leanForward: ['KeyD', 'ArrowRight'],
  eject: ['Space', 'KeyX'],
};

/**
 * Turns individual keys and pointers into the four actions. Each source is held
 * separately, so releasing one of two keys bound to an action leaves it pressed
 * and a cancelled pointer cannot strand one. No DOM in here.
 */
export class InputAdapter {
  private keys = new Set<string>();
  private pointers = new Map<number, ActionName | null>();
  private map: KeyMap;
  private codeToAction = new Map<string, ActionName>();
  /** Which input the player touched last, so hints can match it. */
  lastSource: 'keyboard' | 'touch' = 'keyboard';
  readonly state: ActionState = emptyActions();

  constructor(keys: KeyMap = DEFAULT_KEYS) {
    this.map = keys;
    this.rebuild();
  }

  setKeys(keys: KeyMap) {
    this.map = keys;
    this.rebuild();
    this.recompute();
  }

  keymap() {
    return this.map;
  }

  private rebuild() {
    this.codeToAction.clear();
    for (const name of Object.keys(this.map) as ActionName[]) {
      for (const code of this.map[name] ?? []) this.codeToAction.set(code, name);
    }
  }

  isBound(code: string) {
    return this.codeToAction.has(code);
  }

  keyDown(code: string) {
    if (!this.codeToAction.has(code)) return false;
    this.keys.add(code);
    this.lastSource = 'keyboard';
    this.recompute();
    return true;
  }

  keyUp(code: string) {
    if (!this.keys.delete(code)) return false;
    this.recompute();
    return true;
  }

  /** A pointer pressed or slid onto a control. Null means it is on nothing. */
  pointerSet(id: number, action: ActionName | null) {
    this.pointers.set(id, action);
    this.lastSource = 'touch';
    this.recompute();
  }

  pointerUp(id: number) {
    if (this.pointers.delete(id)) this.recompute();
  }

  activePointers() {
    return this.pointers.size;
  }

  /** Drops every held input. Used on blur, pause, hide and rotation. */
  clear() {
    this.keys.clear();
    this.pointers.clear();
    this.recompute();
  }

  private recompute() {
    const next = emptyActions();
    for (const code of this.keys) next[this.codeToAction.get(code)!] = true;
    for (const action of this.pointers.values()) if (action) next[action] = true;
    Object.assign(this.state, next);
  }

  /** The buttons a touch-visual layer should show as pressed. */
  pressed(action: ActionName) {
    for (const a of this.pointers.values()) if (a === action) return true;
    return false;
  }
}
