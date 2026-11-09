import { DAMAGE, SIM } from '../config/tuning';
import { AudioEngine } from '../audio/AudioEngine';
import { anyAction, emptyActions, toCommand } from '../input/actions';
import { InputAdapter } from '../input/adapter';
import { LEVELS, levelById, levelByOrder } from '../levels';
import type { LevelData } from '../levels/schema';
import { validateLevel } from '../levels/schema';
import { SurfaceMap } from '../levels/surface';
import { Camera } from '../render/camera';
import { PALETTES } from '../render/palette';
import type { Renderer } from '../render/Renderer';
import type { SimEvent } from '../sim/events';
import { Simulation } from '../sim/Simulation';
import { GhostPlayer, GhostRecorder, GhostStore, ghostCompatible, ghostKey } from '../store/ghost';
import type { ProgressStore, RunOutcome } from '../store/progress';
import type { UI } from '../ui/UI';
import { DEFAULT_VEHICLE, createVehicle, KNOWN_VEHICLES } from '../vehicles';
import type { MotorbikeController } from '../vehicles/motorbike/controller';
import { GameFSM } from './fsm';

export interface Bridge {
  embedded: boolean;
  canonicalUrl(): string | null;
  playStarted(): void;
  roundEnded(payload: Record<string, unknown>): void;
  score(score: number): void;
  error(message: string): void;
}

interface Emitter {
  part: string;
  lx: number;
  ly: number;
  dx: number;
  dy: number;
  left: number;
  rate: number;
  carry: number;
}

export interface Perf {
  fps: number;
  frameMs: number;
  stepMs: number;
  restartMs: number;
}

export const DEATH_COPY: Record<string, string> = {
  head: 'Cause: head strike.',
  torso: 'Cause: blunt contact, upper body.',
  cutter: 'Cause: contact with rotating equipment.',
  crush: 'Cause: compaction cycle completed as scheduled.',
  pit: 'Cause: open excavation.',
  bounds: 'Cause: left the work area.',
};

/** Holds a run together: state machine, loop, simulation, presentation and saves. */
export class Game {
  readonly fsm = new GameFSM();
  readonly input: InputAdapter;
  sim: Simulation | null = null;
  level: LevelData | null = null;
  camera: Camera | null = null;
  ui!: UI;
  private surface: SurfaceMap | null = null;

  private accumulator = 0;
  private lastFrame = 0;
  private rafId = 0;
  private overloadCount = 0;
  private emitters: Emitter[] = [];
  private recorder: GhostRecorder | null = null;
  private ghost: GhostPlayer | null = null;
  private ghostToken = 0;
  private scraping = 0;
  private hostPaused = false;
  private lastHint: string | null = null;
  /** Measured time for the most recent restart. */
  perf: Perf = { fps: 60, frameMs: 16, stepMs: 0, restartMs: 0 };
  private fpsWindow = { frames: 0, time: 0, slow: 0 };
  autoQuality: 'low' | 'high' = 'high';

  constructor(
    readonly renderer: Renderer,
    readonly audio: AudioEngine,
    readonly store: ProgressStore,
    readonly bridge: Bridge,
  ) {
    this.input = new InputAdapter(store.data.settings.keys);
    this.applySettings();
  }

  get state() {
    return this.fsm.state;
  }

  get settings() {
    return this.store.data.settings;
  }

  /** Pushes saved settings to the parts that use them. Never touches the simulation. */
  applySettings() {
    const s = this.settings;
    const quality = s.quality === 'auto' ? this.autoQuality : s.quality;
    this.renderer.settings.gore = s.gore;
    this.renderer.settings.quality = quality;
    this.renderer.settings.reducedMotion = s.reducedMotion;
    this.renderer.settings.palette = PALETTES.find((p) => p.id === s.palette) ?? PALETTES[0];
    this.renderer.effects.gore = s.gore;
    this.renderer.effects.setQuality(quality);
    this.input.setKeys(s.keys);
    this.audio.apply(s);
  }

  start() {
    this.fsm.send('BOOTED');
    this.lastFrame = performance.now();
    const loop = (now: number) => {
      this.frame(now);
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stop() {
    cancelAnimationFrame(this.rafId);
  }

  // ---- Entering and leaving levels -------------------------------------------

  /** Builds a clean attempt. All transient state from the last one is dropped first. */
  private buildAttempt(level: LevelData, options: { fromCheckpoint?: boolean; time?: number; tag?: boolean }) {
    const t0 = performance.now();
    this.clearTransients();
    this.sim?.dispose();

    const vehicleId = DEFAULT_VEHICLE;
    this.sim = new Simulation(level, createVehicle(vehicleId), options);
    this.renderer.effects.reset();

    const tel = this.sim.telemetry();
    this.camera = new Camera(level.cameraZones, level.bounds);
    this.camera.aspect = this.renderer.aspect;
    this.camera.snap({ x: tel.x, y: tel.y, vx: 0, speed: 0 });

    this.accumulator = 0;
    this.lastHint = null;
    this.recorder = options.fromCheckpoint ? null : new GhostRecorder();
    this.perf.restartMs = performance.now() - t0;

    this.audio.stopLoops();
    this.audio.startLoops();
  }

  private clearTransients() {
    this.emitters.length = 0;
    this.scraping = 0;
    this.input.clear();
  }

  private loadGhost(level: LevelData) {
    const token = ++this.ghostToken;
    this.ghost = null;
    if (!this.settings.ghost) return;
    GhostStore.load(ghostKey(level.levelId, DEFAULT_VEHICLE))
      .then((data) => {
        if (token !== this.ghostToken || !data) return;
        if (ghostCompatible(data, level, DEFAULT_VEHICLE)) this.ghost = new GhostPlayer(data);
      })
      .catch(() => {});
  }

  enterLevel(level: LevelData) {
    const errors = validateLevel(level, KNOWN_VEHICLES);
    if (errors.length) {
      this.bridge.error(errors[0]);
      throw new Error(errors.join('\n'));
    }
    this.level = level;
    this.surface = new SurfaceMap(level);
    this.renderer.setLevel(level, this.surface);
    this.store.data.lastLevel = level.levelId;
    this.store.save();
    this.fsm.send('ENTER_LEVEL');
    this.buildAttempt(level, {});
    this.loadGhost(level);
    this.ui.enterGameplay(level);
    this.ui.resizeNow();
    this.audio.startMusic(['road-closed', 'loading-zone', 'roof-access'].indexOf(level.districtId));
  }

  exitToMenu() {
    this.ghostToken++;
    this.clearTransients();
    this.sim?.dispose();
    this.sim = null;
    this.level = null;
    this.camera = null;
    this.fsm.send('EXIT');
    this.audio.stopLoops();
    this.audio.stopMusic();
    this.audio.resume();
  }

  /** Back to the start, with a clean clock and no tag. */
  restartFull() {
    if (!this.level) return;
    this.fsm.send('RESTART');
    this.audio.resume();
    this.buildAttempt(this.level, {});
    this.ui.enterGameplay(this.level);
  }

  canRecover() {
    return !!this.sim?.checkpointActive && !!this.level?.checkpoint;
  }

  /** Back to the checkpoint. The run is marked assisted and the clock carries on. */
  recover() {
    if (!this.level || !this.sim || !this.canRecover()) return;
    const { time, checkpointTag } = this.sim;
    this.fsm.send('RESTART');
    this.audio.resume();
    this.buildAttempt(this.level, { fromCheckpoint: true, time, tag: checkpointTag });
    this.ui.enterGameplay(this.level);
  }

  /** The primary Retry: the checkpoint if one is active, otherwise the start. */
  retry() {
    if (this.canRecover()) this.recover();
    else this.restartFull();
  }

  // ---- Pause ------------------------------------------------------------------

  pause(reason: 'player' | 'system' | 'overload' = 'player') {
    const before = this.state;
    if (before !== 'ready' && before !== 'playing' && before !== 'crashed') return;
    this.fsm.send('PAUSE');
    this.input.clear();
    this.accumulator = 0;
    this.audio.suspend();
    this.ui.showPause(reason);
  }

  resume() {
    if (this.state !== 'paused') return;
    if (this.hostPaused) return;
    this.fsm.send('RESUME');
    this.lastFrame = performance.now();
    this.accumulator = 0;
    this.audio.resume();
    this.ui.hidePause();
  }

  pauseFromHost() {
    this.hostPaused = true;
    if (this.fsm.inLevel) this.pause('system');
    else this.audio.suspend();
  }

  resumeFromHost() {
    this.hostPaused = false;
    if (this.state === 'paused') this.resume();
    else if (!this.fsm.inLevel) this.audio.resume();
  }

  restartFromHost() {
    if (!this.fsm.inLevel) return;
    this.hostPaused = false;
    this.restartFull();
  }

  setMuted(muted: boolean) {
    this.settings.muted = muted;
    this.store.save();
    this.audio.apply(this.settings);
    this.ui.syncMute();
  }

  /** Portrait, hidden, blurred or resized: nothing keeps running or stays held. */
  handleInterruption() {
    this.input.clear();
    if (this.state === 'ready' || this.state === 'playing') this.pause('system');
  }

  // ---- Frame ------------------------------------------------------------------

  private frame(now: number) {
    const rawDt = (now - this.lastFrame) / 1000;
    this.lastFrame = now;
    const dt = Math.min(rawDt, 0.25);

    this.measure(rawDt);
    const sim = this.sim;
    if (!sim || !this.camera) return;

    if (this.state !== 'paused') this.advance(dt, sim);

    const alpha = this.state === 'paused' ? 1 : this.accumulator / SIM.dt;
    const tel = sim.telemetry();
    if (this.state !== 'paused') {
      this.camera.aspect = this.renderer.aspect;
      this.camera.update(dt, this.cameraTarget(sim), this.settings.reducedMotion);
      this.updateEmitters(dt, sim);
      this.audio.update(tel, sim.vehicle.isAlive() && this.state !== 'finished', this.scraping > 0);
    }

    const showGhost = this.ghost && this.settings.ghost && this.state !== 'crashed' && sim.status !== 'ready' && !sim.assisted;
    const ghostFrame = showGhost ? this.ghost!.at(sim.time) : null;
    this.renderer.draw(sim, this.camera, alpha, this.state === 'paused' ? 0 : dt, ghostFrame);
    this.ui.updateHud(sim, this.state);
    this.updateHint(sim);
  }

  /** The bike while riding. After a crash the rider, since that is where the news is. */
  private cameraTarget(sim: Simulation) {
    const tel = sim.telemetry();
    const torso = sim.status === 'crashed' && !sim.crushed ? sim.vehicleTracks.get('torso') : null;
    if (!torso) return { x: tel.x, y: tel.y, vx: tel.vx, speed: tel.speed };
    return { x: torso.x, y: torso.y, vx: 0, speed: 0 };
  }

  private measure(dt: number) {
    const w = this.fpsWindow;
    w.frames++;
    w.time += dt;
    if (dt > 1 / 40) w.slow++;
    if (w.time >= 1) {
      this.perf.fps = w.frames / w.time;
      this.perf.frameMs = (w.time / w.frames) * 1000;
      if (this.settings.quality === 'auto' && this.state === 'playing' && this.autoQuality === 'high' && w.slow > w.frames * 0.5) {
        this.autoQuality = 'low';
        this.applySettings();
        this.ui.resizeNow();
      }
      w.frames = 0;
      w.time = 0;
      w.slow = 0;
    }
  }

  private advance(dt: number, sim: Simulation) {
    const actions = this.state === 'ready' || this.state === 'playing' ? this.input.state : emptyActions();

    if (this.state === 'ready') {
      if (!anyAction(actions)) return;
      this.fsm.send('INPUT');
    }

    this.accumulator += dt;
    let steps = 0;
    const started = performance.now();
    while (this.accumulator >= SIM.dt && steps < SIM.maxCatchUpSteps) {
      sim.step(toCommand(actions));
      this.accumulator -= SIM.dt;
      steps++;
      this.handleEvents(sim);
      this.recordGhost(sim);
      if (this.sim !== sim) return;
    }
    if (steps) this.perf.stepMs = (performance.now() - started) / steps;

    if (this.accumulator >= SIM.dt) {
      // Behind by more than the catch-up allowance: drop the debt, never speed up.
      this.accumulator = 0;
      this.overloadCount++;
      if (this.overloadCount >= SIM.overloadFrames && this.state === 'playing') {
        this.overloadCount = 0;
        this.pause('overload');
      }
    } else {
      this.overloadCount = 0;
    }
  }

  private recordGhost(sim: Simulation) {
    if (!this.recorder || sim.status !== 'playing') return;
    this.recorder.tick(sim.time, (out) => sim.vehicle.ghostPose(out));
  }

  private updateHint(sim: Simulation) {
    let hint: string | null = null;
    if (sim.status === 'ready') {
      hint = this.input.lastSource === 'touch' ? 'Press GO to start the clock.' : 'Press throttle (W or Up) to start the clock.';
    } else if (sim.status === 'playing') {
      if (sim.stuck > DAMAGE.stuckSeconds) {
        hint = this.input.lastSource === 'touch' ? 'Upside down. Tap restart.' : 'Upside down. Press R to restart.';
      } else {
        const x = sim.telemetry().x;
        const h = sim.level.hints.find((q) => x >= q.x0 && x <= q.x1);
        if (h) hint = this.input.lastSource === 'touch' ? h.touch : h.keyboard;
      }
    }
    if (hint !== this.lastHint) {
      this.lastHint = hint;
      this.ui.setHint(hint);
    }
  }

  // ---- Simulation events to presentation --------------------------------------

  private handleEvents(sim: Simulation) {
    if (!sim.events.length) return;
    const list = sim.events;
    sim.events = [];
    for (const e of list) this.present(sim, e);
  }

  private present(sim: Simulation, e: SimEvent) {
    const fx = this.renderer.effects;
    const cam = this.camera;
    this.audio.event(e, this.settings.gore);

    switch (e.t) {
      case 'start':
        this.bridge.playStarted();
        break;
      case 'bike':
        if (e.what === 'chassis') {
          if (e.speed > 1.5) {
            fx.sparks(e.x, e.y, 8, 5);
            this.scraping = 0.2;
          }
        } else if (e.speed > 4) {
          fx.dust(e.x, e.y, 4);
          cam?.addShake(Math.min(0.16, e.speed * 0.012));
        }
        break;
      case 'sparks':
        fx.sparks(e.x, e.y, 12, 8);
        break;
      case 'impact':
        if (e.outcome === 'bruise' || e.speed > 5) {
          fx.blood(e.x, e.y, e.nx * 2, Math.abs(e.ny) * 2, Math.min(14, Math.floor(e.speed * 1.2)));
        }
        if (e.speed > 6) cam?.addShake(Math.min(0.3, e.speed * 0.02));
        break;
      case 'sever':
        fx.blood(e.x, e.y, e.vx * 0.4, e.vy * 0.4 + 2, 34, 9);
        this.addEmitter(e.part, 0, 0.18, 0, 1, 1.1, 34);
        if (e.part.endsWith('N') || e.part.endsWith('F')) this.addStumpEmitter(sim, e.part);
        cam?.addShake(0.16);
        break;
      case 'decapitate':
        fx.blood(e.x, e.y, e.vx * 0.3, 7, 50, 10);
        this.addEmitter('torso', 0, 0.32, 0, 1, 2.8, 70);
        cam?.addShake(0.3);
        break;
      case 'death':
        this.onDeath(sim, e.cause, e.x, e.y);
        break;
      case 'mech':
        if (e.what === 'slam') {
          fx.dust(e.x, e.y, 8);
          cam?.addShake(0.2);
        } else if (e.what === 'break') {
          fx.sparks(e.x, e.y, 22, 9);
          fx.dust(e.x, e.y, 8);
          cam?.addShake(0.15);
        } else if (e.what === 'release') {
          fx.sparks(e.x, e.y, 10, 5);
        }
        break;
      case 'tag':
        this.ui.flashTag();
        break;
      case 'checkpoint':
        this.ui.toast('Checkpoint active');
        break;
      case 'finish':
        this.onFinish(sim);
        break;
      default:
        break;
    }
  }

  private addStumpEmitter(sim: Simulation, part: string) {
    const v = sim.vehicle as MotorbikeController;
    const isUpper = part.includes('Upper');
    if (isUpper) {
      const isArm = part.startsWith('arm');
      this.addEmitter('torso', 0, isArm ? 0.25 : -0.28, -0.5, isArm ? 0.5 : -0.8, 0.9, 34);
    } else {
      const upper = part.replace('Lower', 'Upper');
      const body = v.parts.get(upper as never);
      if (body) this.addEmitter(upper, 0, -0.18, 0, -1, 0.9, 30);
    }
  }

  private addEmitter(part: string, lx: number, ly: number, dx: number, dy: number, left: number, rate: number) {
    if (this.emitters.length >= 6) this.emitters.shift();
    this.emitters.push({ part, lx, ly, dx, dy, left, rate, carry: 0 });
  }

  private updateEmitters(dt: number, sim: Simulation) {
    const fx = this.renderer.effects;
    for (let i = this.emitters.length - 1; i >= 0; i--) {
      const e = this.emitters[i];
      e.left -= dt;
      if (e.left <= 0 || sim.aftermath > DAMAGE.aftermathSeconds) {
        this.emitters.splice(i, 1);
        continue;
      }
      const track = sim.vehicleTracks.get(e.part);
      if (!track) continue;
      e.carry += e.rate * dt;
      const n = Math.floor(e.carry);
      if (n <= 0) continue;
      e.carry -= n;
      const c = Math.cos(track.a);
      const s = Math.sin(track.a);
      const x = track.x + e.lx * c - e.ly * s;
      const y = track.y + e.lx * s + e.ly * c;
      const wx = e.dx * c - e.dy * s;
      const wy = e.dx * s + e.dy * c;
      const v = track.body.getLinearVelocity();
      fx.blood(x, y, v.x + wx * 5.5, v.y + wy * 5.5, n, 1.6);
    }
    if (this.scraping > 0) this.scraping -= dt;
  }

  private onDeath(sim: Simulation, cause: string, x: number, y: number) {
    const fx = this.renderer.effects;
    this.fsm.send('CRASH');
    this.recorder = null;
    if (cause === 'crush') {
      fx.blood(x - 1, y - 0.2, -8, 2, 40, 6);
      fx.blood(x + 1, y - 0.2, 8, 2, 40, 6);
      this.camera?.addShake(0.5);
    } else {
      fx.blood(x, y, 0, 3, 26, 8);
      this.camera?.addShake(0.32);
    }
    this.bridge.roundEnded({ score: this.store.completedCount(), level: sim.level.levelId, outcome: 'crashed', seconds: Math.round(sim.time) });
    this.ui.showCrash(DEATH_COPY[cause] ?? '', this.canRecover());
  }

  private onFinish(sim: Simulation) {
    this.fsm.send('FINISH');
    const level = sim.level;
    const timeMs = Math.round(sim.time * 1000);
    const assisted = sim.assisted;
    const bestBefore = this.store.bestMs(level, DEFAULT_VEHICLE);
    const outcome: RunOutcome = this.store.applyRun(level, { timeMs, assisted, tag: sim.tag, vehicleId: DEFAULT_VEHICLE }, PALETTES);

    if (!assisted && outcome.newBest && this.recorder) {
      const data = this.recorder.finish(timeMs, level, DEFAULT_VEHICLE);
      if (data) {
        const key = ghostKey(level.levelId, DEFAULT_VEHICLE);
        // Retry straight after a new best should race the new ghost.
        void GhostStore.save(key, data)
          .then(() => this.loadGhost(level))
          .catch(() => {});
      }
    }
    this.recorder = null;

    this.bridge.roundEnded({ score: this.store.completedCount(), level: level.levelId, outcome: 'finished', seconds: Math.round(sim.time) });
    this.ui.showResults({ level, timeMs, assisted, tag: sim.tag, bestBefore, outcome, next: levelByOrder(level.order + 1) });
  }

  // ---- Lookups for the UI -----------------------------------------------------

  levelsInOrder() {
    return LEVELS;
  }

  findLevel(id: string) {
    return levelById(id);
  }

  isUnlocked(level: LevelData) {
    return this.store.isUnlocked(level, LEVELS);
  }

  /** The next thing to play: the first incomplete course, or the last one touched. */
  continueLevel(): LevelData {
    const first = LEVELS.find((l) => !this.store.data.levels[l.levelId]?.completed);
    return first ?? levelById(this.store.data.lastLevel ?? '') ?? LEVELS[0];
  }
}
