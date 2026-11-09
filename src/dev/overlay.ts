import type { Game } from '../game/Game';
import type { UI } from '../ui/UI';
import type { Simulation } from '../sim/Simulation';
import { CircleShape, ChainShape, EdgeShape, PolygonShape, type Body } from 'planck';
import { MOTORBIKE } from '../vehicles/motorbike/definition';
import { SANDBOX } from './sandbox';

export interface DebugOptions {
  collision: boolean;
}

function paint(g: CanvasRenderingContext2D, sim: Simulation) {
  g.lineWidth = 0.025;
  for (let b: Body | null = sim.world.getBodyList(); b; b = b.getNext()) {
    const p = b.getPosition();
    g.save();
    g.translate(p.x, p.y);
    g.rotate(b.getAngle());
    for (let f = b.getFixtureList(); f; f = f.getNext()) {
      const shape = f.getShape();
      g.strokeStyle = f.isSensor() ? '#00e5ff' : b.isDynamic() ? '#39ff14' : b.isKinematic() ? '#ff00d4' : '#ffee00';
      g.beginPath();
      if (shape instanceof CircleShape) {
        const c = shape.getCenter();
        g.arc(c.x, c.y, shape.getRadius(), 0, Math.PI * 2);
      } else if (shape instanceof PolygonShape) {
        shape.m_vertices.forEach((v, i) => (i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y)));
        g.closePath();
      } else if (shape instanceof ChainShape) {
        shape.m_vertices.forEach((v, i) => (i ? g.lineTo(v.x, v.y) : g.moveTo(v.x, v.y)));
      } else if (shape instanceof EdgeShape) {
        g.moveTo(shape.m_vertex1.x, shape.m_vertex1.y);
        g.lineTo(shape.m_vertex2.x, shape.m_vertex2.y);
      }
      g.stroke();
    }
    g.restore();
  }
  g.strokeStyle = '#ff3b3b';
  for (const k of sim.level.killRegions) g.strokeRect(k.x0, k.y0, k.x1 - k.x0, k.y1 - k.y0);
  for (const m of sim.mechanisms) {
    const z = m.crushZone();
    if (z) {
      g.fillStyle = 'rgba(255,0,0,.3)';
      g.fillRect(z.x0, z.y0, z.x1 - z.x0, z.y1 - z.y0);
    }
  }
}

interface TuneRow {
  label: string;
  get: () => number;
  set: (v: number) => void;
  min: number;
  max: number;
  step: number;
}

/** Backtick toggles the panel. Only ever loaded by the dev server. */
export function installDevTools(game: Game, ui: UI) {
  const perf = document.createElement('div');
  perf.style.cssText = 'position:fixed;left:8px;bottom:8px;font:11px monospace;color:#fff;background:rgba(0,0,0,.6);padding:2px 6px;pointer-events:none;z-index:20';
  document.body.appendChild(perf);
  ui.enablePerf(perf);

  const phys = MOTORBIKE.physics as unknown as {
    engine: { peakTorque: number; topSpeed: number };
    lean: { groundTorque: number; wheelieTorque: number; airTorque: number; maxPitchRate: number; wheelieRate: number };
    suspension: { rearHz: number; frontHz: number; damping: number };
  };
  const row = (label: string, obj: Record<string, number>, key: string, min: number, max: number, step: number): TuneRow => ({
    label,
    get: () => obj[key],
    set: (v) => (obj[key] = v),
    min,
    max,
    step,
  });
  const rows: TuneRow[] = [
    row('torque', phys.engine, 'peakTorque', 100, 500, 5),
    row('top speed', phys.engine, 'topSpeed', 10, 30, 0.5),
    row('lean ground', phys.lean, 'groundTorque', 0, 900, 10),
    row('lean wheelie', phys.lean, 'wheelieTorque', 0, 900, 10),
    row('lean air', phys.lean, 'airTorque', 0, 400, 5),
    row('pitch rate', phys.lean, 'maxPitchRate', 1, 8, 0.1),
    row('wheelie rate', phys.lean, 'wheelieRate', 0.5, 4, 0.05),
    row('rear hz', phys.suspension, 'rearHz', 2, 12, 0.1),
    row('front hz', phys.suspension, 'frontHz', 2, 12, 0.1),
    row('damping', phys.suspension, 'damping', 0.2, 4, 0.05),
  ];

  const panel = document.createElement('div');
  panel.style.cssText = 'position:fixed;right:8px;top:70px;background:rgba(0,0,0,.82);color:#fff;font:11px monospace;padding:8px;z-index:30;display:none;width:240px';
  panel.innerHTML =
    `<label><input type="checkbox" id="dev-col"> collision + triggers</label><div id="dev-rows"></div>
     <div>Sandbox: ${SANDBOX.map((_l, i) => `<button data-sb="${i}">${i + 1}</button>`).join(' ')}</div>
     <div id="dev-points"></div>
     <div>Handling changes apply on restart (R).</div>`;
  document.body.appendChild(panel);

  const rowsEl = panel.querySelector('#dev-rows')!;
  for (const r of rows) {
    const el = document.createElement('label');
    el.style.cssText = 'display:grid;grid-template-columns:80px 1fr 36px;gap:4px;align-items:center';
    el.innerHTML = `<span>${r.label}</span><input type="range" min="${r.min}" max="${r.max}" step="${r.step}" value="${r.get()}"><b>${r.get()}</b>`;
    const input = el.querySelector('input')!;
    input.addEventListener('input', () => {
      r.set(Number(input.value));
      el.querySelector('b')!.textContent = input.value;
    });
    rowsEl.appendChild(el);
  }
  panel.querySelector<HTMLInputElement>('#dev-col')!.addEventListener('change', (e) => {
    game.renderer.debugPainter = (e.target as HTMLInputElement).checked ? paint : null;
  });
  const pointsEl = panel.querySelector('#dev-points')!;
  const loadSandbox = (i: number) => {
    const level = SANDBOX[i];
    game.enterLevel(level.data);
    pointsEl.innerHTML = Object.keys(level.points).map((n) => `<button data-pt="${n}">${n}</button>`).join(' ');
    pointsEl.querySelectorAll<HTMLElement>('[data-pt]').forEach((b) => {
      b.addEventListener('click', () => {
        const q = level.points[b.dataset.pt!];
        game.enterLevel({ ...level.data, spawn: { x: q[0], y: q[1] } });
      });
    });
  };
  panel.querySelectorAll<HTMLElement>('[data-sb]').forEach((b) => b.addEventListener('click', () => loadSandbox(Number(b.dataset.sb))));

  window.addEventListener('keydown', (e) => {
    if (e.code === 'Backquote') panel.style.display = panel.style.display === 'none' ? 'block' : 'none';
  });

  const match = location.hash.match(/^#\/sandbox\/(\d+)/);
  if (match) {
    game.store.data.noticeSeen = true;
    queueMicrotask(() => loadSandbox(Number(match[1]) - 1));
  }

  if (import.meta.hot) {
    import.meta.hot.on('vite:afterUpdate', () => {
      if (game.level) game.restartFull();
    });
  }
}
