import { DISTRICTS } from '../levels';
import { PALETTES } from '../render/palette';
import type { Game, Perf } from '../game/Game';
import type { GameState } from '../game/fsm';
import type { DistrictId, LevelData } from '../levels/schema';
import type { Simulation } from '../sim/Simulation';
import type { RunOutcome, Settings } from '../store/progress';
import { defaultSettings } from '../store/progress';
import type { ActionName } from '../input/adapter';
import { DEFAULT_VEHICLE } from '../vehicles';
import { formatKey, formatTime } from './format';
import { TouchControls } from './TouchControls';

export interface ResultsView {
  level: LevelData;
  timeMs: number;
  assisted: boolean;
  tag: boolean;
  bestBefore: number | null;
  outcome: RunOutcome;
  next: LevelData | null;
}

type Screen = 'none' | 'notice' | 'title' | 'levels' | 'settings' | 'pause' | 'results';

const esc = (text: string) =>
  text.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c] ?? c);

const MEDAL_NAME = { gold: 'Gold', silver: 'Silver', bronze: 'Bronze' } as const;

/** The HTML layer: menus, HUD and touch controls, sitting over the canvas. */
export class UI {
  private game!: Game;
  private screenEl: HTMLElement;
  private hud: HTMLElement;
  private timerEl: HTMLElement;
  private tagEl: HTMLElement;
  private hintEl: HTMLElement;
  private crashEl: HTMLElement;
  private rotateEl: HTMLElement;
  private toastEl: HTMLElement;
  private saveWarnEl: HTMLElement;
  private perfEl: HTMLElement | null = null;
  readonly touch: TouchControls;

  screen: Screen = 'none';
  /** Where the settings screen goes back to. */
  private settingsReturn: Screen = 'title';
  private lastTimerText = '';
  private lastTag = false;
  private rebinding: { action: ActionName } | null = null;
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private levelsNote: string | null = null;
  onNavigate: (hash: string) => void = () => {};
  resizeNow: () => void = () => {};

  constructor(private root: HTMLElement) {
    root.innerHTML = `
      <div id="hud" hidden>
        <div class="hud-left">
          <button class="hud-btn" data-act="pause" aria-label="Pause"><span aria-hidden="true">II</span></button>
          <button class="hud-btn" data-act="hud-restart" aria-label="Restart from the beginning"><span aria-hidden="true">R</span></button>
        </div>
        <div class="hud-centre">
          <div class="timer" id="timer" role="timer">0:00.00</div>
          <div class="hud-title" id="hud-title"></div>
        </div>
        <div class="hud-right">
          <div class="tag-state" id="tag-state" title="Inspection tag" aria-label="Inspection tag not collected">TAG</div>
        </div>
      </div>
      <div id="hint" aria-live="polite" hidden></div>
      <div id="crash" hidden></div>
      <div id="toast" hidden></div>
      <div id="save-warn" hidden>Progress can't be saved in this browser. You can keep playing.</div>
      <div id="touch" hidden></div>
      <div id="screen" hidden></div>
      <div id="rotate" hidden><div class="stamp">Turn your phone sideways</div><p>This job needs both hands and the full width of the road.</p></div>
    `;
    const $ = (id: string) => root.querySelector<HTMLElement>(`#${id}`)!;
    this.screenEl = $('screen');
    this.hud = $('hud');
    this.timerEl = $('timer');
    this.tagEl = $('tag-state');
    this.hintEl = $('hint');
    this.crashEl = $('crash');
    this.rotateEl = $('rotate');
    this.toastEl = $('toast');
    this.saveWarnEl = $('save-warn');
    this.touch = new TouchControls($('touch'));
    root.addEventListener('click', (e) => this.onClick(e));
    root.addEventListener('input', (e) => this.onInput(e));
    root.addEventListener('keydown', (e) => this.onMenuKey(e as KeyboardEvent));
  }

  bind(game: Game) {
    this.game = game;
    this.touch.bind(game.input);
    this.touch.apply(game.settings);
    if (this.touch.isTouchDevice()) game.input.lastSource = 'touch';
    this.syncSaveWarning();
  }

  /** Shows or hides the portrait prompt. */
  setPortrait(blocked: boolean) {
    this.rotateEl.hidden = !blocked;
  }

  private open(screen: Screen, html: string) {
    this.screen = screen;
    this.screenEl.hidden = screen === 'none';
    this.screenEl.dataset.screen = screen;
    this.screenEl.innerHTML = html;
    const focus = this.screenEl.querySelector<HTMLElement>('[data-autofocus]') ?? this.screenEl.querySelector<HTMLElement>('button:not([disabled])');
    focus?.focus({ preventScroll: true });
  }

  private closeScreen() {
    this.screen = 'none';
    this.screenEl.hidden = true;
    this.screenEl.innerHTML = '';
    delete this.screenEl.dataset.screen;
  }

  private syncSaveWarning() {
    this.saveWarnEl.hidden = !this.game.store.saveFailed;
  }

  // ---- Menus -------------------------------------------------------------------

  showNotice(after: () => void) {
    this.noticeAfter = after;
    this.hideGameplay();
    this.open(
      'notice',
      `<div class="panel notice">
        <h1 class="stamp big">Before you clock in</h1>
        <p class="lead">Graphic violence and dismemberment.</p>
        <p>You can change this later in Settings.</p>
        <div class="actions">
          <button class="btn primary" data-act="notice-continue" data-autofocus>Continue</button>
          <button class="btn" data-act="notice-reduced">Reduced Gore</button>
        </div>
      </div>`,
    );
  }

  private noticeAfter: () => void = () => {};

  showTitle() {
    this.hideGameplay();
    const done = this.game.store.completedCount();
    const label = done > 0 ? 'Continue' : 'Play';
    this.open(
      'title',
      `<div class="title-wrap">
        <header class="masthead">
          <div class="plate">District map 01–03</div>
          <h1 class="logo">BAD<br>COMMUTE</h1>
          <p class="tagline">The city works. You might not.</p>
        </header>
        <nav class="menu" aria-label="Main menu">
          <button class="btn primary big" data-act="continue" data-autofocus>${label}</button>
          <button class="btn" data-act="levels">Level select</button>
          <button class="btn" data-act="settings">Settings</button>
        </nav>
        <footer class="fineprint">
          <span class="mature">Mature: graphic violence</span>
          <span>${done} of 20 shifts complete. Progress stays in this browser.</span>
        </footer>
      </div>`,
    );
  }

  showLevels(note: string | null = null) {
    this.levelsNote = note;
    this.hideGameplay();
    const g = this.game;
    const strips = DISTRICTS.map((d) => this.districtStrip(d.id, d.number, d.name, d.note)).join('');
    this.open(
      'levels',
      `<div class="levels">
        <header class="bar">
          <button class="btn small" data-act="back-title" aria-label="Back to title">Back</button>
          <h1 class="stamp">Shift schedule</h1>
          <span class="count">${g.store.completedCount()}/20</span>
        </header>
        ${this.levelsNote ? `<p class="note" role="status">${esc(this.levelsNote)}</p>` : ''}
        ${strips}
      </div>`,
    );
  }

  private districtStrip(id: DistrictId, number: string, name: string, note: string) {
    const g = this.game;
    const cards = g
      .levelsInOrder()
      .filter((l) => l.districtId === id)
      .map((l) => {
        const rec = g.store.data.levels[l.levelId];
        const open = g.isUnlocked(l);
        const best = g.store.bestMs(l, DEFAULT_VEHICLE);
        const medal = rec?.medal;
        const state = rec?.completed ? 'done' : open ? 'open' : 'locked';
        const summary = `${l.order}. ${l.title}${open ? '' : ', locked'}${rec?.completed ? ', complete' : ''}${medal ? `, ${MEDAL_NAME[medal]} medal` : ''}${rec?.tag ? ', tag collected' : ''}`;
        return `<button class="card ${state}" data-act="play" data-id="${l.levelId}" ${open ? '' : 'aria-disabled="true"'} aria-label="${esc(summary)}">
          <span class="card-no">${String(l.order).padStart(2, '0')}</span>
          <span class="card-title">${esc(l.title)}</span>
          <span class="card-meta">
            <span class="medal ${medal ?? 'none'}" aria-hidden="true">${medal ? medal[0].toUpperCase() : '–'}</span>
            <span class="mini-tag ${rec?.tag ? 'got' : ''}" aria-hidden="true">TAG</span>
            <span class="card-time">${best !== null ? formatTime(best) : open ? '' : 'LOCKED'}</span>
          </span>
        </button>`;
      })
      .join('');
    return `<section class="district">
      <h2><span class="district-no">${number}</span> ${esc(name)} <small>${esc(note)}</small></h2>
      <div class="cards">${cards}</div>
    </section>`;
  }

  showSettings(from: Screen) {
    this.settingsReturn = from;
    this.renderSettings();
  }

  private renderSettings() {
    const s = this.game.settings;
    const done = this.game.store.completedCount();
    const seg = (key: keyof Settings, options: Array<[string, string]>, label: string) => `
      <fieldset class="seg"><legend>${label}</legend>
        ${options.map(([v, text]) => `<button class="btn small ${String(s[key]) === v ? 'on' : ''}" data-act="set" data-key="${key}" data-value="${v}" aria-pressed="${String(s[key]) === v}">${text}</button>`).join('')}
      </fieldset>`;
    const slider = (key: keyof Settings, label: string, min: number, max: number, step: number) => `
      <label class="slider"><span>${label}</span><input type="range" data-key="${key}" min="${min}" max="${max}" step="${step}" value="${s[key]}"></label>`;
    const toggle = (key: keyof Settings, label: string) => `
      <button class="btn small toggle ${s[key] ? 'on' : ''}" data-act="toggle" data-key="${key}" aria-pressed="${!!s[key]}">${label}: ${s[key] ? 'On' : 'Off'}</button>`;
    const palettes = PALETTES.map((p) => {
      const open = done >= p.unlockAt;
      return `<button class="btn small swatch ${s.palette === p.id ? 'on' : ''}" data-act="palette" data-value="${p.id}" ${open ? '' : 'disabled'} aria-pressed="${s.palette === p.id}">
        <i style="background:${p.jacket}"></i><i style="background:${p.helmet}"></i>${esc(p.name)}${open ? '' : ` (${p.unlockAt} shifts)`}
      </button>`;
    }).join('');
    const actions: Array<[ActionName, string]> = [
      ['throttle', 'Throttle'],
      ['brake', 'Brake / reverse'],
      ['leanBack', 'Lean back'],
      ['leanForward', 'Lean forward'],
    ];
    const keys = actions
      .map(([action, label]) => {
        const waiting = this.rebinding?.action === action;
        return `<div class="keyrow"><span>${label}</span>
          <button class="btn small" data-act="rebind" data-value="${action}">${waiting ? 'Press a key…' : esc(s.keys[action].map(formatKey).join(' / '))}</button></div>`;
      })
      .join('');

    this.open(
      'settings',
      `<div class="settings">
        <header class="bar">
          <button class="btn small" data-act="back-settings" data-autofocus>Back</button>
          <h1 class="stamp">Settings</h1>
          <span></span>
        </header>
        <div class="settings-grid">
          <section>
            <h2>Display</h2>
            ${seg('gore', [['full', 'Full'], ['reduced', 'Reduced'], ['off', 'Off']], 'Violence')}
            ${seg('quality', [['auto', 'Auto'], ['low', 'Low'], ['high', 'High']], 'Effects')}
            ${toggle('reducedMotion', 'Reduced motion')}
            ${toggle('ghost', 'Personal-best ghost')}
            <p class="fine">These change how the game looks and sounds. Physics, damage and records stay the same.</p>
          </section>
          <section>
            <h2>Sound</h2>
            ${toggle('muted', 'Mute')}
            ${slider('master', 'Master', 0, 1, 0.05)}
            ${slider('sfx', 'Effects', 0, 1, 0.05)}
            ${slider('music', 'Music', 0, 1, 0.05)}
          </section>
          <section>
            <h2>Touch controls</h2>
            ${slider('touchScale', 'Button size', 0.8, 1.4, 0.05)}
            ${slider('touchOpacity', 'Button opacity', 0.25, 1, 0.05)}
          </section>
          <section>
            <h2>Keyboard</h2>
            ${keys}
            <button class="btn small" data-act="keys-reset">Reset keys</button>
          </section>
          <section>
            <h2>Rider colours</h2>
            <div class="swatches">${palettes}</div>
            <p class="fine">Cosmetic only. Unlocked by completing shifts.</p>
          </section>
        </div>
        <p class="fine">Progress and settings are saved in this browser, on this device.</p>
      </div>`,
    );
  }

  showPause(reason: 'player' | 'system' | 'overload') {
    this.touch.setVisible(false);
    const g = this.game;
    const line = reason === 'overload' ? `<p class="note">Paused because this device fell behind. Lowering Effects in Settings may help.</p>` : '';
    const recover = g.canRecover() ? `<button class="btn" data-act="recover">Recover at checkpoint</button>` : '';
    this.open(
      'pause',
      `<div class="panel pause">
        <h1 class="stamp big">Paused</h1>
        ${line}
        <div class="actions column">
          <button class="btn primary" data-act="resume" data-autofocus>Resume</button>
          <button class="btn" data-act="restart-full">Restart from beginning</button>
          ${recover}
          <button class="btn" data-act="settings-pause">Settings</button>
          <button class="btn" data-act="levels">Level select</button>
        </div>
      </div>`,
    );
  }

  hidePause() {
    this.closeScreen();
    this.showGameplayControls();
  }

  showResults(view: ResultsView) {
    this.touch.setVisible(false);
    this.crashEl.hidden = true;
    const { level, timeMs, assisted, tag, bestBefore, outcome, next } = view;
    this.lastResultsNext = next;
    const medal = !assisted && outcome.medal ? `<span class="stamp medal-stamp ${outcome.medal}">${MEDAL_NAME[outcome.medal]}</span>` : `<span class="stamp medal-stamp none">No medal</span>`;
    const best = outcome.bestMs !== null ? formatTime(outcome.bestMs) : '—';
    const pb = !assisted && outcome.newBest && bestBefore !== null ? '<span class="pb">New best</span>' : '';
    const unlocks = outcome.unlocks.length ? `<p class="note">New rider colours unlocked: ${outcome.unlocks.map(esc).join(', ')}.</p>` : '';
    this.open(
      'results',
      `<div class="panel results">
        <p class="label">${String(level.order).padStart(2, '0')} · ${esc(level.title)}</p>
        <h1 class="stamp big">Arrived.</h1>
        <p class="run-type">${assisted ? 'Assisted run: used a checkpoint, no medal or record' : 'Full run'}</p>
        <dl class="stats">
          <div><dt>Time</dt><dd>${formatTime(timeMs)} ${pb}</dd></div>
          <div><dt>Best</dt><dd>${best}</dd></div>
          <div><dt>Medal</dt><dd>${medal}</dd></div>
          <div><dt>Tag</dt><dd>${tag ? '<span class="tag-yes">Collected</span>' : 'Not collected'}</dd></div>
        </dl>
        ${unlocks}
        <div class="actions">
          <button class="btn" data-act="restart-full">Retry</button>
          ${next ? `<button class="btn primary" data-act="next" data-autofocus>Next shift</button>` : `<button class="btn primary" data-act="levels" data-autofocus>End of shift</button>`}
        </div>
      </div>`,
    );
    this.syncSaveWarning();
  }

  lastResultsNext: LevelData | null = null;

  showCrash(cause: string, canRecover: boolean) {
    this.crashEl.hidden = false;
    this.crashEl.innerHTML = `
      <div class="crash-card">
        <h1 class="stamp">Shift interrupted.</h1>
        <p>${esc(cause)}</p>
        <div class="actions">
          <button class="btn primary" data-act="retry" data-autofocus>${canRecover ? 'Retry from checkpoint' : 'Retry'}<kbd>Enter</kbd></button>
          ${canRecover ? `<button class="btn" data-act="restart-full">Full restart<kbd>R</kbd></button>` : ''}
        </div>
      </div>`;
    this.crashEl.querySelector<HTMLElement>('[data-autofocus]')?.focus({ preventScroll: true });
  }

  // ---- Gameplay ----------------------------------------------------------------

  enterGameplay(level: LevelData) {
    this.closeScreen();
    this.crashEl.hidden = true;
    this.hud.hidden = false;
    this.root.querySelector<HTMLElement>('#hud-title')!.textContent = `${String(level.order).padStart(2, '0')} ${level.title}`;
    this.lastTimerText = '';
    this.lastTag = !this.game.sim?.tag;
    this.showGameplayControls();
    (document.activeElement as HTMLElement | null)?.blur?.();
  }

  private showGameplayControls() {
    this.touch.setVisible(this.touch.isTouchDevice());
  }

  hideGameplay() {
    this.hud.hidden = true;
    this.hintEl.hidden = true;
    this.crashEl.hidden = true;
    this.touch.setVisible(false);
  }

  setHint(text: string | null) {
    this.hintEl.hidden = !text;
    this.hintEl.textContent = text ?? '';
  }

  updateHud(sim: Simulation, _state: GameState) {
    const text = formatTime(Math.round(sim.time * 1000));
    if (text !== this.lastTimerText) {
      this.lastTimerText = text;
      this.timerEl.textContent = text;
      this.timerEl.classList.toggle('assisted', sim.assisted);
    }
    if (sim.tag !== this.lastTag) {
      this.lastTag = sim.tag;
      this.tagEl.classList.toggle('got', sim.tag);
      this.tagEl.setAttribute('aria-label', sim.tag ? 'Inspection tag collected' : 'Inspection tag not collected');
    }
    this.touch.syncPressed();
    if (this.perfEl) this.renderPerf(this.game.perf, sim);
  }

  flashTag() {
    this.tagEl.classList.remove('flash');
    void this.tagEl.offsetWidth;
    this.tagEl.classList.add('flash');
    this.toast('Inspection tag collected');
  }

  toast(text: string) {
    this.toastEl.textContent = text;
    this.toastEl.hidden = false;
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => (this.toastEl.hidden = true), 1600);
  }

  syncMute() {
    if (this.screen === 'settings') this.renderSettings();
  }

  /** Adds the developer readout. Never called in production. */
  enablePerf(el: HTMLElement) {
    this.perfEl = el;
  }

  private renderPerf(p: Perf, sim: Simulation) {
    if (!this.perfEl) return;
    this.perfEl.textContent = `fps ${p.fps.toFixed(0)}  frame ${p.frameMs.toFixed(1)}ms  step ${p.stepMs.toFixed(2)}ms  restart ${p.restartMs.toFixed(1)}ms  bodies ${sim.bodyCount()}  fx ${this.game.renderer.effects.active}  decals ${this.game.renderer.effects.decals.length}`;
  }

  // ---- Events ------------------------------------------------------------------

  private onClick(e: Event) {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-act]');
    if (!target) return;
    this.game.audio.unlock();
    const g = this.game;
    switch (target.dataset.act) {
      case 'notice-continue':
      case 'notice-reduced':
        if (target.dataset.act === 'notice-reduced') {
          g.settings.gore = 'reduced';
          g.applySettings();
        }
        g.store.data.noticeSeen = true;
        g.store.save();
        this.syncSaveWarning();
        this.noticeAfter();
        break;
      case 'continue':
        this.onNavigate(`#/level/${g.continueLevel().levelId}`);
        break;
      case 'levels':
        this.onNavigate('#/levels');
        break;
      case 'back-title':
        this.onNavigate('#/');
        break;
      case 'settings':
        this.showSettings('title');
        break;
      case 'settings-pause':
        this.showSettings('pause');
        break;
      case 'back-settings':
        this.rebinding = null;
        if (this.settingsReturn === 'pause') this.showPause('player');
        else this.showTitle();
        break;
      case 'play': {
        if (target.getAttribute('aria-disabled') === 'true') {
          this.toast('Finish the shift before this one to unlock it.');
          break;
        }
        this.onNavigate(`#/level/${target.dataset.id}`);
        break;
      }
      case 'pause':
        g.pause('player');
        break;
      case 'resume':
        g.resume();
        break;
      case 'hud-restart':
      case 'restart-full':
        g.restartFull();
        break;
      case 'recover':
        g.recover();
        break;
      case 'retry':
        g.retry();
        break;
      case 'next':
        if (this.lastResultsNext) this.onNavigate(`#/level/${this.lastResultsNext.levelId}`);
        break;
      case 'set': {
        const key = target.dataset.key as 'gore' | 'quality';
        (g.settings as unknown as Record<string, unknown>)[key] = target.dataset.value;
        this.commitSettings();
        this.renderSettings();
        break;
      }
      case 'toggle': {
        const key = target.dataset.key as 'muted' | 'reducedMotion' | 'ghost';
        g.settings[key] = !g.settings[key];
        this.commitSettings();
        this.renderSettings();
        break;
      }
      case 'palette':
        g.settings.palette = target.dataset.value ?? 'municipal';
        this.commitSettings();
        this.renderSettings();
        break;
      case 'rebind':
        this.rebinding = { action: target.dataset.value as ActionName };
        this.renderSettings();
        break;
      case 'keys-reset':
        g.settings.keys = defaultSettings().keys;
        this.commitSettings();
        this.renderSettings();
        break;
      default:
        break;
    }
  }

  private commitSettings() {
    this.game.applySettings();
    this.game.store.save();
    this.touch.apply(this.game.settings);
    this.syncSaveWarning();
  }

  private onInput(e: Event) {
    const el = e.target as HTMLInputElement;
    const key = el.dataset.key;
    if (!key) return;
    (this.game.settings as unknown as Record<string, number>)[key] = Number(el.value);
    this.commitSettings();
  }

  /** Captures the next key while rebinding. Returns true if it used the key. */
  captureRebind(code: string) {
    if (!this.rebinding) return false;
    if (code !== 'Escape') {
      const { action } = this.rebinding;
      const keys = this.game.settings.keys;
      // A key can only do one thing.
      for (const name of Object.keys(keys) as ActionName[]) keys[name] = keys[name].filter((k) => k !== code);
      keys[action] = [code, ...keys[action].slice(0, 1)];
      this.commitSettings();
    }
    this.rebinding = null;
    this.renderSettings();
    return true;
  }

  /** Arrow keys move focus through whatever menu is open. */
  private onMenuKey(e: KeyboardEvent) {
    if (this.screen === 'none' || this.rebinding) return;
    const dirs: Record<string, number> = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    const dir = dirs[e.key];
    if (!dir) return;
    if ((e.target as HTMLElement).tagName === 'INPUT') return;
    const items = Array.from(this.screenEl.querySelectorAll<HTMLElement>('button:not([disabled]), input'));
    if (!items.length) return;
    const at = items.indexOf(document.activeElement as HTMLElement);
    const next = items[(at + dir + items.length) % items.length];
    next.focus();
    next.scrollIntoView({ block: 'nearest' });
    e.preventDefault();
  }

  /** Escape-to-go-back for each menu. */
  backOut() {
    switch (this.screen) {
      case 'levels':
        this.onNavigate('#/');
        break;
      case 'settings':
        if (this.settingsReturn === 'pause') this.showPause('player');
        else this.showTitle();
        break;
      default:
        break;
    }
  }
}
