import { clamp } from '../core/math';
import type { SimEvent } from '../sim/events';
import type { GoreSetting, Settings } from '../store/progress';
import type { VehicleTelemetry } from '../vehicles/types';

type Ctx = AudioContext;

/**
 * Everything audible, synthesized, through one master gain. Nothing starts until
 * a user gesture calls unlock(). Pausing suspends the whole context.
 */
export class AudioEngine {
  private ctx: Ctx | null = null;
  private master!: GainNode;
  private sfx!: GainNode;
  private music!: GainNode;
  private noise!: AudioBuffer;

  private engineA: OscillatorNode | null = null;
  private engineB: OscillatorNode | null = null;
  private engineGain!: GainNode;
  private engineFilter!: BiquadFilterNode;
  private tireGain!: GainNode;
  private tireSource: AudioBufferSourceNode | null = null;
  private scrapeGain!: GainNode;
  private scrapeSource: AudioBufferSourceNode | null = null;

  private musicTimer: ReturnType<typeof setInterval> | null = null;
  private nextBeat = 0;
  private beatIndex = 0;
  private musicDistrict = 0;
  private lastImpact = 0;
  private settings: Settings | null = null;
  private loopsRunning = false;

  /** Call from a user gesture. Safe to call repeatedly. */
  unlock() {
    if (!this.ctx) {
      try {
        const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new AC();
      } catch {
        return;
      }
      this.build();
      if (this.settings) this.apply(this.settings);
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private build() {
    const c = this.ctx!;
    this.master = c.createGain();
    this.master.connect(c.destination);
    this.sfx = c.createGain();
    this.sfx.connect(this.master);
    this.music = c.createGain();
    this.music.connect(this.master);

    const seconds = 2;
    this.noise = c.createBuffer(1, c.sampleRate * seconds, c.sampleRate);
    const d = this.noise.getChannelData(0);
    let seed = 12345;
    for (let i = 0; i < d.length; i++) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      d[i] = seed / 2147483648 - 1;
    }

    this.engineFilter = c.createBiquadFilter();
    this.engineFilter.type = 'lowpass';
    this.engineFilter.frequency.value = 500;
    this.engineGain = c.createGain();
    this.engineGain.gain.value = 0;
    this.engineFilter.connect(this.engineGain);
    this.engineGain.connect(this.sfx);

    this.tireGain = c.createGain();
    this.tireGain.gain.value = 0;
    this.tireGain.connect(this.sfx);
    this.scrapeGain = c.createGain();
    this.scrapeGain.gain.value = 0;
    this.scrapeGain.connect(this.sfx);
  }

  apply(s: Settings) {
    this.settings = s;
    if (!this.ctx) return;
    const t = this.ctx.currentTime;
    this.master.gain.setTargetAtTime(s.muted ? 0 : s.master, t, 0.02);
    this.sfx.gain.setTargetAtTime(s.sfx, t, 0.02);
    this.music.gain.setTargetAtTime(s.music * 0.55, t, 0.02);
  }

  get running() {
    return !!this.ctx && this.ctx.state === 'running';
  }

  suspend() {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resume() {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }

  private noiseLoop(target: GainNode, type: BiquadFilterType, frequency: number, q: number) {
    const c = this.ctx!;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = frequency;
    f.Q.value = q;
    src.connect(f);
    f.connect(target);
    src.start();
    return src;
  }

  /** Starts engine and surface loops. Restart stops them first, so they cannot pile up. */
  startLoops() {
    if (!this.ctx || this.loopsRunning) return;
    const c = this.ctx;
    this.engineA = c.createOscillator();
    this.engineA.type = 'sawtooth';
    this.engineB = c.createOscillator();
    this.engineB.type = 'square';
    this.engineA.connect(this.engineFilter);
    const half = c.createGain();
    half.gain.value = 0.4;
    this.engineB.connect(half);
    half.connect(this.engineFilter);
    this.engineA.start();
    this.engineB.start();
    this.tireSource = this.noiseLoop(this.tireGain, 'bandpass', 900, 0.8);
    this.scrapeSource = this.noiseLoop(this.scrapeGain, 'bandpass', 3400, 3);
    this.loopsRunning = true;
  }

  stopLoops() {
    if (!this.ctx || !this.loopsRunning) return;
    for (const node of [this.engineA, this.engineB, this.tireSource, this.scrapeSource]) {
      try {
        node?.stop();
        node?.disconnect();
      } catch {
        // Already stopped.
      }
    }
    this.engineA = this.engineB = null;
    this.tireSource = this.scrapeSource = null;
    this.engineGain.gain.value = 0;
    this.tireGain.gain.value = 0;
    this.scrapeGain.gain.value = 0;
    this.loopsRunning = false;
  }

  /** Number of looping sources right now. Tests use this to catch leaks. */
  loopCount() {
    return this.loopsRunning ? 4 : 0;
  }

  update(tel: VehicleTelemetry, alive: boolean, scraping: boolean) {
    if (!this.ctx || !this.loopsRunning || !this.engineA || !this.engineB) return;
    const t = this.ctx.currentTime;
    const rev = clamp(Math.abs(tel.wheelSpeed) / 22, 0, 1);
    const base = 46 + rev * 118 + tel.throttle * 14;
    this.engineA.frequency.setTargetAtTime(base, t, 0.03);
    this.engineB.frequency.setTargetAtTime(base * 0.5, t, 0.03);
    this.engineFilter.frequency.setTargetAtTime(380 + tel.throttle * 900 + rev * 900, t, 0.04);
    this.engineGain.gain.setTargetAtTime(alive ? 0.075 + tel.throttle * 0.09 : 0, t, alive ? 0.03 : 0.25);

    const rolling = tel.grounded > 0 ? clamp(tel.speed / 20, 0, 1) * 0.05 : 0;
    const slip = clamp(tel.slip / 8, 0, 1) * 0.16;
    this.tireGain.gain.setTargetAtTime(rolling + slip, t, 0.05);
    this.scrapeGain.gain.setTargetAtTime(scraping ? clamp(tel.speed / 12, 0.1, 0.8) * 0.16 : 0, t, 0.03);
  }

  private burst(opts: { gain: number; decay: number; freq: number; type: BiquadFilterType; q?: number; sweep?: number; at?: number; bus?: GainNode }) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = opts.at ?? c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noise;
    const f = c.createBiquadFilter();
    f.type = opts.type;
    f.frequency.setValueAtTime(opts.freq, t);
    if (opts.sweep) f.frequency.exponentialRampToValueAtTime(opts.sweep, t + opts.decay);
    f.Q.value = opts.q ?? 1;
    const g = c.createGain();
    g.gain.setValueAtTime(opts.gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + opts.decay);
    src.connect(f);
    f.connect(g);
    g.connect(opts.bus ?? this.sfx);
    src.start(t, Math.random() * 1.5, opts.decay + 0.02);
  }

  private tone(freq: number, end: number, decay: number, gain: number, type: OscillatorType, at?: number, bus?: GainNode) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = at ?? c.currentTime;
    const o = c.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(end, 1), t + decay);
    const g = c.createGain();
    g.gain.setValueAtTime(gain, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + decay);
    o.connect(g);
    g.connect(bus ?? this.sfx);
    o.start(t);
    o.stop(t + decay + 0.02);
  }

  /** A cartoon voice: a buzzy tone pushed through two vowel-shaped filters. */
  private voice(from: number, to: number, seconds: number, gain: number, vowel: readonly [number, number] = [850, 1300], at?: number) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = at ?? c.currentTime;
    const o = c.createOscillator();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(Math.max(to, 40), t + seconds);
    const wobble = c.createOscillator();
    wobble.frequency.value = 11;
    const depth = c.createGain();
    depth.gain.value = from * 0.035;
    wobble.connect(depth);
    depth.connect(o.frequency);
    const out = c.createGain();
    out.gain.setValueAtTime(0.0001, t);
    out.gain.exponentialRampToValueAtTime(gain, t + 0.025);
    out.gain.setValueAtTime(gain, t + seconds * 0.6);
    out.gain.exponentialRampToValueAtTime(0.0001, t + seconds);
    for (const f of vowel) {
      const band = c.createBiquadFilter();
      band.type = 'bandpass';
      band.frequency.value = f;
      band.Q.value = 6;
      o.connect(band);
      band.connect(out);
    }
    out.connect(this.sfx);
    o.start(t);
    wobble.start(t);
    o.stop(t + seconds + 0.03);
    wobble.stop(t + seconds + 0.03);
  }

  private oof() {
    this.voice(210, 120, 0.16, 0.5, [520, 900]);
  }

  private boom() {
    this.tone(95, 24, 0.7, 0.9, 'sine');
    this.burst({ gain: 1, decay: 0.75, freq: 900, sweep: 70, type: 'lowpass', q: 1 });
    this.burst({ gain: 0.5, decay: 0.16, freq: 2600, type: 'bandpass', q: 1 });
  }

  private boing() {
    this.tone(150, 620, 0.26, 0.34, 'triangle');
    this.tone(300, 1240, 0.26, 0.12, 'sine');
  }

  private clunk(level = 1) {
    this.tone(180, 70, 0.14, 0.35 * level, 'square');
    this.burst({ gain: 0.25 * level, decay: 0.08, freq: 1800, type: 'bandpass', q: 2 });
  }

  private gore(amount: number, mode: GoreSetting) {
    if (mode === 'full') {
      this.burst({ gain: 0.5 * amount, decay: 0.16, freq: 900, sweep: 180, type: 'lowpass', q: 4 });
      this.tone(120, 42, 0.12, 0.3 * amount, 'sine');
    } else if (mode === 'reduced') {
      this.tone(100, 50, 0.1, 0.22 * amount, 'sine');
    } else {
      this.tone(90, 60, 0.08, 0.14 * amount, 'sine');
    }
  }

  event(e: SimEvent, gore: GoreSetting) {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const now = this.ctx.currentTime;
    switch (e.t) {
      case 'bike':
        if (e.speed > 2.2 && now - this.lastImpact > 0.05) {
          this.lastImpact = now;
          const v = clamp(e.speed / 12, 0.1, 1);
          this.tone(110 - v * 50, 38, 0.11, 0.3 * v, 'sine');
          if (e.what === 'chassis') this.burst({ gain: 0.3 * v, decay: 0.12, freq: 3000, type: 'bandpass', q: 4 });
        }
        break;
      case 'impact':
        if (e.speed > 2.5 && now - this.lastImpact > 0.04) {
          this.lastImpact = now;
          this.gore(clamp(e.speed / 12, 0.15, 1), gore);
        }
        break;
      case 'sever':
        this.gore(1, gore);
        break;
      case 'decapitate':
        this.gore(1.2, gore);
        this.tone(900, 240, 0.09, 0.15, 'triangle');
        break;
      case 'death':
        if (e.cause === 'crush') {
          this.tone(70, 28, 0.42, 0.7, 'sine');
          this.gore(1.3, gore);
        } else if (e.cause === 'pit' || e.cause === 'bounds') {
          this.voice(700, 260, 1.1, 0.4, [950, 1500]);
        } else {
          this.voice(560, 180, 0.34, 0.5, [800, 1250]);
        }
        break;
      case 'eject':
        if (e.chosen) {
          this.boing();
          this.voice(330, 760, 0.55, 0.42, [900, 1600], now + 0.05);
        } else {
          this.oof();
        }
        break;
      case 'flop':
        if (now - this.lastImpact > 0.1) {
          this.lastImpact = now;
          this.voice(170, 130, 0.1, 0.2, [480, 820]);
          this.tone(95, 50, 0.09, 0.2, 'sine');
        }
        break;
      case 'explosion':
        this.boom();
        break;
      case 'boing':
        this.boing();
        break;
      case 'impale':
        this.gore(1.1, gore);
        break;
      case 'npc':
        if (e.what === 'hit') this.voice(430, 820, 0.3, 0.38, [1000, 1700]);
        else this.gore(1.1, gore);
        break;
      case 'prop':
        if (e.what === 'burst') {
          if (e.kind === 'cooler') this.burst({ gain: 0.5, decay: 0.4, freq: 4200, sweep: 900, type: 'highpass' });
          else if (e.kind === 'crate') {
            this.burst({ gain: 0.6, decay: 0.2, freq: 700, type: 'bandpass', q: 1 });
            this.clunk(0.7);
          } else this.burst({ gain: 0.45, decay: 0.14, freq: 420, type: 'bandpass', q: 0.8 });
        } else if (e.speed > 2.5 && now - this.lastImpact > 0.06) {
          this.lastImpact = now;
          const v = clamp(e.speed / 12, 0.1, 1);
          if (e.kind === 'cone' || e.kind === 'ball') this.tone(320, 150, 0.09, 0.22 * v, 'triangle');
          else if (e.kind === 'barrel' || e.kind === 'tnt' || e.kind === 'bin' || e.kind === 'cart') this.tone(240, 90, 0.16, 0.3 * v, 'square');
          else this.burst({ gain: 0.3 * v, decay: 0.09, freq: 380, type: 'bandpass', q: 0.8 });
        }
        break;
      case 'sparks':
        this.burst({ gain: 0.3, decay: 0.09, freq: 5200, type: 'bandpass', q: 6 });
        break;
      case 'mech':
        if (e.what === 'clunk' || e.what === 'arrive') this.clunk(0.8);
        else if (e.what === 'release') {
          this.clunk(1);
          this.tone(620, 300, 0.1, 0.2, 'square', now + 0.05);
        } else if (e.what === 'break') {
          this.burst({ gain: 0.55, decay: 0.24, freq: 1200, type: 'bandpass', q: 1 });
          this.clunk(1);
        } else if (e.what === 'slam') {
          this.tone(85, 34, 0.34, 0.6, 'sine');
          this.burst({ gain: 0.34, decay: 0.2, freq: 500, type: 'lowpass' });
        } else if (e.what === 'warn') {
          this.tone(740, 740, 0.12, 0.13, 'square');
          this.tone(740, 740, 0.12, 0.13, 'square', now + 0.18);
        } else if (e.what === 'shutter') {
          this.burst({ gain: 0.2, decay: 0.5, freq: 700, type: 'bandpass', q: 3 });
        }
        break;
      case 'tag':
        this.tone(980, 1320, 0.12, 0.2, 'triangle');
        this.tone(1320, 1320, 0.2, 0.16, 'triangle', now + 0.09);
        break;
      case 'checkpoint':
        this.tone(520, 520, 0.1, 0.2, 'square');
        this.tone(780, 780, 0.16, 0.18, 'square', now + 0.1);
        break;
      case 'finish':
        this.clunk(1);
        if (e.arrival === 'dead') {
          // The sad trombone, for the record.
          this.tone(294, 277, 0.3, 0.22, 'sawtooth', now + 0.1);
          this.tone(277, 262, 0.3, 0.22, 'sawtooth', now + 0.42);
          this.tone(262, 196, 0.75, 0.24, 'sawtooth', now + 0.74);
        } else {
          this.tone(1760, 1760, 0.32, 0.18, 'triangle', now + 0.08);
          if (e.arrival === 'loose') this.tone(2090, 2090, 0.32, 0.14, 'triangle', now + 0.24);
        }
        break;
      default:
        break;
    }
  }

  /** Sparse rhythm, varied a little by district. */
  startMusic(district: number) {
    this.musicDistrict = district;
    if (!this.ctx || this.musicTimer) return;
    this.nextBeat = this.ctx.currentTime + 0.1;
    this.beatIndex = 0;
    this.musicTimer = setInterval(() => this.scheduleBeats(), 90);
  }

  stopMusic() {
    if (this.musicTimer) clearInterval(this.musicTimer);
    this.musicTimer = null;
  }

  private scheduleBeats() {
    if (!this.ctx || this.ctx.state !== 'running') return;
    const bpm = [84, 96, 72][this.musicDistrict] ?? 84;
    const step = 60 / bpm / 2;
    while (this.nextBeat < this.ctx.currentTime + 0.25) {
      const i = this.beatIndex % 32;
      const t = this.nextBeat;
      const bus = this.music;
      const kick = this.musicDistrict === 1 ? i % 4 === 0 : i % 8 === 0 || i === 11 || i === 27;
      if (kick) this.tone(62, 34, 0.3, 0.42, 'sine', t, bus);
      if (i % 8 === 4) this.burst({ gain: 0.12, decay: 0.16, freq: 2600, type: 'bandpass', q: 7, at: t, bus });
      if (i === 14 || i === 30) this.tone(196, 190, 0.5, 0.06, 'triangle', t, bus);
      if (this.musicDistrict === 2 && i % 16 === 10) this.tone(147, 147, 0.9, 0.05, 'sawtooth', t, bus);
      this.nextBeat += step;
      this.beatIndex++;
    }
  }
}
