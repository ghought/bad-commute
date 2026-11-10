import '@fontsource/big-shoulders-display/latin-700';
import '@fontsource/big-shoulders-display/latin-800';
import '@fontsource/big-shoulders-display/latin-900';
import '@fontsource/ibm-plex-mono/latin-400.css';
import '@fontsource/ibm-plex-mono/latin-500.css';
import './style.css';
import { AudioEngine } from './audio/AudioEngine';
import { Game, type Bridge } from './game/Game';
import { Renderer } from './render/Renderer';
import { ProgressStore } from './store/progress';
import { UI } from './ui/UI';
import { createRouter } from './ui/router';

declare global {
  interface Window {
    PcktBridge?: { init(options: Record<string, unknown>): Bridge };
    /** Development-only handle for automated play. Absent from production builds. */
    __badCommute?: Game;
  }
}

function fatal(message: string) {
  const el = document.createElement('div');
  el.id = 'fatal';
  el.innerHTML = `<div><h1 class="stamp big">Bad Commute</h1><p></p></div>`;
  el.querySelector('p')!.textContent = message;
  document.body.appendChild(el);
}

function boot() {
  const canvas = document.getElementById('game') as HTMLCanvasElement;
  const root = document.getElementById('ui') as HTMLElement;

  let game: Game | null = null;
  const noop: Bridge = { embedded: false, canonicalUrl: () => null, playStarted() {}, roundEnded() {}, score() {}, error() {} };
  const bridge: Bridge =
    window.PcktBridge?.init({
      gameId: 'bad-commute',
      allowedParents: ['https://pckt.up.railway.app'],
      capabilities: { pause: true, mute: true, restart: true },
      onPause() { game?.pauseFromHost(); },
      onResume() { game?.resumeFromHost(); },
      onMute(muted: boolean) { game?.setMuted(muted); },
      onRestart() { game?.restartFromHost(); },
    }) ?? noop;

  let renderer: Renderer;
  try {
    renderer = new Renderer(canvas);
  } catch (e) {
    bridge.error(`Canvas failed: ${e}`);
    fatal('This game needs a browser with canvas support.');
    return;
  }

  const store = new ProgressStore();
  const audio = new AudioEngine();
  const ui = new UI(root);
  const g = new Game(renderer, audio, store, bridge);
  game = g;
  g.ui = ui;
  ui.bind(g);

  // Layout. Changes wait until no finger is down, so browser chrome collapsing
  // mid-ride cannot slide a button out from under a thumb.
  let pendingLayout = false;
  const dpr = () => Math.min(window.devicePixelRatio || 1, renderer.settings.quality === 'low' ? 1.25 : 2);
  const layout = () => {
    const w = window.innerWidth;
    const h = window.innerHeight;
    document.documentElement.style.setProperty('--app-h', `${h}px`);
    renderer.resize(w, h, dpr());
    ui.touch.measure();
    pendingLayout = false;
    const portraitPhone = h > w && ui.touch.isTouchDevice();
    const blocked = portraitPhone && g.fsm.inLevel;
    ui.setPortrait(blocked);
    if (blocked) g.handleInterruption();
  };
  const requestLayout = () => {
    if (g.input.activePointers() > 0) {
      pendingLayout = true;
      return;
    }
    layout();
  };
  window.addEventListener('resize', requestLayout);
  window.addEventListener('pointerup', () => {
    if (pendingLayout && g.input.activePointers() === 0) layout();
  });
  window.addEventListener('orientationchange', () => {
    g.input.clear();
    layout();
  });
  ui.resizeNow = layout;

  // Anything that takes attention away pauses and lets go of every input.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) g.handleInterruption();
  });
  window.addEventListener('blur', () => g.handleInterruption());
  window.addEventListener('pagehide', () => g.handleInterruption());

  const unlockAudio = () => audio.unlock();
  window.addEventListener('pointerdown', unlockAudio, { capture: true });
  window.addEventListener('keydown', unlockAudio, { capture: true });

  window.addEventListener('keydown', (e) => {
    if (ui.captureRebind(e.code)) {
      e.preventDefault();
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    const state = g.state;

    if (state === 'ready' || state === 'playing' || state === 'crashed' || state === 'finished') {
      if (g.input.isBound(e.code) || e.code === 'Space') {
        const onMenu = (state === 'crashed' || state === 'finished') && e.code === 'Space';
        if (!onMenu) e.preventDefault();
      }
      if (!e.repeat && (state === 'ready' || state === 'playing')) g.input.keyDown(e.code);
      if (e.repeat) return;
      if (e.code === 'KeyR') {
        g.restartFull();
        return;
      }
      if (e.code === 'Escape' && state !== 'finished') {
        g.pause('player');
        return;
      }
      const down = state === 'playing' && g.sim?.riderState() === 'dead';
      if (e.code === 'Enter' && (state === 'crashed' || down)) {
        e.preventDefault();
        g.retry();
      }
      return;
    }
    if (state === 'paused') {
      if (e.code === 'Escape' && !e.repeat) {
        if (ui.screen === 'settings') ui.backOut();
        else g.resume();
      } else if (e.code === 'KeyR' && !e.repeat) g.restartFull();
      return;
    }
    if (state === 'menu' && e.code === 'Escape') ui.backOut();
  });
  window.addEventListener('keyup', (e) => {
    g.input.keyUp(e.code);
  });

  window.addEventListener('contextmenu', (e) => e.preventDefault());
  document.addEventListener('gesturestart', (e) => e.preventDefault());

  const router = createRouter(g, ui);
  ui.onNavigate = router.navigate;

  layout();
  g.start();
  router.begin();

  if (import.meta.env.DEV) {
    window.__badCommute = g;
    void import('./dev/overlay').then((m) => m.installDevTools(g, ui));
  }
}

function start() {
  try {
    boot();
  } catch (e) {
    console.error(e);
    fatal('Something went wrong starting the game.');
  }
}

start();
