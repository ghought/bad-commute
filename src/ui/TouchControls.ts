import type { ActionName, InputAdapter } from '../input/adapter';
import type { Settings } from '../store/progress';

interface Button {
  action: ActionName;
  el: HTMLElement;
  rect: DOMRect;
}

/** On-screen buttons. Tracks each finger by id, and fingers may slide between buttons. */
export class TouchControls {
  private input!: InputAdapter;
  private buttons: Button[] = [];
  private visible = false;
  private touchSeen = false;

  constructor(private root: HTMLElement) {
    root.innerHTML = `
      <div class="pad left">
        <button class="tbtn" data-action="leanBack" tabindex="-1" aria-label="Lean back">
          <svg viewBox="0 0 40 40" aria-hidden="true"><path d="M24 7 11 20l13 13"/></svg><span>BACK</span>
        </button>
        <button class="tbtn" data-action="leanForward" tabindex="-1" aria-label="Lean forward">
          <svg viewBox="0 0 40 40" aria-hidden="true"><path d="m16 7 13 13-13 13"/></svg><span>FWD</span>
        </button>
      </div>
      <div class="pad right">
        <button class="tbtn eject" data-action="eject" tabindex="-1" aria-label="Ejector seat"><span>BAIL</span></button>
        <button class="tbtn" data-action="brake" tabindex="-1" aria-label="Brake and reverse"><span>BRAKE</span></button>
        <button class="tbtn throttle" data-action="throttle" tabindex="-1" aria-label="Throttle"><span>GO</span></button>
      </div>`;
  }

  bind(input: InputAdapter) {
    this.input = input;
    this.buttons = Array.from(this.root.querySelectorAll<HTMLElement>('.tbtn')).map((el) => ({
      action: el.dataset.action as ActionName,
      el,
      rect: el.getBoundingClientRect(),
    }));
    window.addEventListener('pointerdown', (e) => {
      if (e.pointerType === 'touch') this.touchSeen = true;
    });
    const r = this.root;
    r.addEventListener('pointerdown', (e) => this.down(e));
    r.addEventListener('pointermove', (e) => this.move(e));
    r.addEventListener('pointerup', (e) => this.up(e));
    r.addEventListener('pointercancel', (e) => this.up(e));
    r.addEventListener('lostpointercapture', (e) => this.up(e));
    r.addEventListener('contextmenu', (e) => e.preventDefault());
  }

  isTouchDevice() {
    return this.touchSeen || matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1;
  }

  apply(s: Settings) {
    this.root.style.setProperty('--touch-scale', String(s.touchScale));
    this.root.style.setProperty('--touch-opacity', String(s.touchOpacity));
    this.measure();
  }

  setVisible(on: boolean) {
    this.visible = on;
    this.root.hidden = !on;
    if (on) this.measure();
  }

  measure() {
    if (this.root.hidden) return;
    for (const b of this.buttons) b.rect = b.el.getBoundingClientRect();
  }

  private hit(x: number, y: number): ActionName | null {
    for (const b of this.buttons) {
      const r = b.rect;
      if (x >= r.left && x <= r.right && y >= r.top && y <= r.bottom) return b.action;
    }
    return null;
  }

  private down(e: PointerEvent) {
    const action = this.hit(e.clientX, e.clientY);
    if (!action) return;
    e.preventDefault();
    try {
      this.root.setPointerCapture(e.pointerId);
    } catch {
      // Synthetic pointers cannot be captured. Moves still arrive on the buttons.
    }
    this.input.pointerSet(e.pointerId, action);
  }

  private move(e: PointerEvent) {
    if (e.buttons === 0 && e.pointerType === 'mouse') return;
    this.input.pointerSet(e.pointerId, this.hit(e.clientX, e.clientY));
  }

  private up(e: PointerEvent) {
    this.input.pointerUp(e.pointerId);
  }

  syncPressed() {
    if (!this.visible) return;
    for (const b of this.buttons) b.el.classList.toggle('held', this.input.pressed(b.action));
  }
}
