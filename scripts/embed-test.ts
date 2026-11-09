// Loads the production build the way the arcade does: a sandboxed cross-origin
// iframe on the real hub origin, from a subpath, then plays it with real input
// and drives the bridge. `npm run build && npm run test:embed`

import { existsSync, readFileSync, statSync } from 'node:fs';
import { extname, join } from 'node:path';
import { chromium, type BrowserContext, type Frame, type Page } from 'playwright-core';

const DIST = new URL('../dist/', import.meta.url).pathname;
const SUB = '/games/bad-commute/';
const ORIGIN = 'https://game.bad-commute.test';
const LIVE = process.env.GAME_URL;
const GAME = LIVE ?? `${ORIGIN}${SUB}`;
const TYPES: Record<string, string> = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff' };

async function serveGame(ctx: BrowserContext) {
  if (LIVE) return;
  await ctx.route(`${ORIGIN}/**`, (route) => {
    const path = new URL(route.request().url()).pathname;
    if (!path.startsWith(SUB)) return route.fulfill({ status: 404 });
    let file = join(DIST, path.slice(SUB.length) || 'index.html');
    if (!existsSync(file) || statSync(file).isDirectory()) file = join(DIST, 'index.html');
    return route.fulfill({ body: readFileSync(file), contentType: TYPES[extname(file)] ?? 'application/octet-stream', headers: { 'access-control-allow-origin': '*' } });
  });
}

let failures = 0;
const check = (name: string, ok: unknown, extra = '') => {
  console.log(`${ok ? 'pass' : 'FAIL'}  ${name} ${extra}`);
  if (!ok) failures++;
};

const HOST = `<!doctype html><html><body style="margin:0;background:#222">
<iframe id="g" sandbox="allow-scripts allow-same-origin" src="${GAME}" style="width:844px;height:390px;border:0"></iframe>
<script>
  const f = document.getElementById('g');
  const session = 's-' + Math.random().toString(36).slice(2);
  window.msgs = [];
  window.send = (type, payload) => f.contentWindow.postMessage({ namespace: 'pckt-games', version: 1, gameId: 'bad-commute', sessionId: session, eventId: Math.random().toString(36), type, payload }, new URL(f.src).origin);
  window.addEventListener('message', (e) => { if (e.data && e.data.namespace === 'pckt-games') window.msgs.push(e.data); });
  f.addEventListener('load', () => {
    const t = setInterval(() => {
      if (window.msgs.some((m) => m.type === 'READY')) return clearInterval(t);
      window.send('INIT', { canonicalUrl: 'https://pckt.up.railway.app/games/bad-commute' });
    }, 150);
  });
</script></body></html>`;

const browser = await chromium.launch({ channel: 'chrome', headless: true });

async function hostPage(block?: boolean) {
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  await serveGame(ctx);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  page.on('dialog', (d) => {
    errors.push(`dialog: ${d.message()}`);
    void d.dismiss();
  });
  if (block) {
    await page.addInitScript(() => {
      Object.defineProperty(window, 'localStorage', {
        get() {
          throw new DOMException('denied', 'SecurityError');
        },
      });
    });
  }
  await page.route('https://pckt.up.railway.app/**', (r) => r.fulfill({ contentType: 'text/html', body: HOST }));
  await page.goto('https://pckt.up.railway.app/games/bad-commute');
  await page.waitForFunction(() => (window as unknown as { msgs: { type: string }[] }).msgs.some((m) => m.type === 'READY'), null, { timeout: 15000 });
  const frame = page.frames().find((f) => f.url().startsWith(GAME))!;
  return { page, frame, errors, ctx };
}

type Msg = { type: string; payload?: Record<string, unknown> };
const msgs = (p: Page) => p.evaluate(() => (window as unknown as { msgs: Msg[] }).msgs);
const send = (p: Page, type: string, payload?: unknown) =>
  p.evaluate(([t, d]) => (window as unknown as { send(t: unknown, d: unknown): void }).send(t, d), [type, payload] as const);

async function startFirstLevel(frame: Frame) {
  await frame.locator('[data-act="notice-continue"]').click();
  await frame.locator('[data-act="continue"]').click();
  await frame.locator('#hud').waitFor({ state: 'visible' });
}

/** Holds throttle and lean back until the rider loops out. Real input, real frames. */
async function crashOut(page: Page, frame: Frame) {
  await page.keyboard.down('KeyW');
  await page.keyboard.down('KeyA');
  await frame.locator('#crash:not([hidden])').waitFor({ timeout: 20000 });
  await page.keyboard.up('KeyA');
  await page.keyboard.up('KeyW');
}

{
  console.log('\n-- In the arcade --');
  const { page, frame, errors, ctx } = await hostPage();
  let m = await msgs(page);
  const ready = m.find((x) => x.type === 'READY');
  check('READY arrives with the real capabilities', JSON.stringify(ready?.payload) === '{"capabilities":{"pause":true,"mute":true,"restart":true}}', JSON.stringify(ready?.payload));
  check('The content notice shows first', (await frame.locator('[data-screen="notice"]').count()) === 1);

  const fontsOk = await frame.evaluate(async () => {
    await document.fonts.ready;
    return document.fonts.check('800 20px "Big Shoulders Display"');
  });
  check('Fonts load from a subpath', fontsOk);

  await startFirstLevel(frame);
  check('Level link keeps the subpath', frame.url().includes(`${SUB}#/level/rc-01`), frame.url());

  await page.keyboard.down('KeyW');
  await page.waitForTimeout(400);
  m = await msgs(page);
  check('PLAY_STARTED on the first riding input', m.some((x) => x.type === 'PLAY_STARTED'));

  await send(page, 'PAUSE');
  await page.waitForTimeout(200);
  m = await msgs(page);
  check('PAUSE is answered with PAUSED', m.some((x) => x.type === 'PAUSED'));
  check('The pause menu shows', (await frame.locator('[data-screen="pause"]').count()) === 1);
  const clock1 = await frame.locator('#timer').textContent();
  await page.waitForTimeout(400);
  check('The clock stops while paused', (await frame.locator('#timer').textContent()) === clock1, String(clock1));
  await page.keyboard.up('KeyW');

  await send(page, 'RESUME');
  await page.waitForTimeout(200);
  m = await msgs(page);
  check('RESUME is answered with resumed PLAY_STARTED', m.some((x) => x.type === 'PLAY_STARTED' && x.payload?.resumed));
  check('The pause menu closes', (await frame.locator('[data-screen="pause"]').count()) === 0);

  await send(page, 'SET_MUTED', { muted: true });
  await page.waitForTimeout(100);
  const muted = await frame.evaluate(() => JSON.parse(localStorage.getItem('bad-commute.save') ?? '{}').settings?.muted);
  check('SET_MUTED reaches the game and persists', muted === true);

  await send(page, 'RESTART');
  await page.waitForTimeout(250);
  check('RESTART returns to the start line', (await frame.locator('#timer').textContent()) === '0:00.00', String(await frame.locator('#timer').textContent()));

  await frame.locator('canvas').click({ position: { x: 300, y: 60 } });
  await crashOut(page, frame);
  m = await msgs(page);
  const end = m.find((x) => x.type === 'ROUND_ENDED');
  check('ROUND_ENDED on a crash, with a numeric score', end && typeof end.payload?.score === 'number', JSON.stringify(end?.payload));
  check('Failure copy shows immediately', (await frame.locator('.crash-card h1').textContent())?.toLowerCase().includes('shift interrupted'));

  const before = Date.now();
  await page.keyboard.press('KeyR');
  await frame.locator('#crash').waitFor({ state: 'hidden', timeout: 1000 });
  check('R restarts without waiting', Date.now() - before < 400, `${Date.now() - before}ms`);

  // Ride level 1 to the finish on real input and frames.
  await frame.locator('canvas').click({ position: { x: 300, y: 60 } });
  await page.keyboard.down('KeyW');
  await frame.locator('[data-screen="results"]').waitFor({ timeout: 30000 });
  await page.keyboard.up('KeyW');
  check('Level 1 can be finished with the keyboard', (await frame.locator('.results h1').textContent())?.toLowerCase().includes('arrived'));
  check('The results label a full run', (await frame.locator('.run-type').textContent())?.includes('Full run'));

  await frame.locator('[data-act="next"]').click();
  await frame.locator('#hud').waitFor({ state: 'visible' });
  check('Next goes straight to level 2', frame.url().includes('#/level/rc-02'), frame.url());

  await frame.evaluate(() => {
    location.hash = '#/level/ra-20';
  });
  await frame.locator('[data-screen="levels"]').waitFor({ timeout: 3000 });
  check('A locked level explains itself', (await frame.locator('.note').textContent())?.includes('locked'));
  check('Level select shows the completed course', (await frame.locator('.card.done').count()) >= 1);
  check('No errors or dialogs', errors.length === 0, errors.join(' | '));

  await frame.evaluate(() => location.reload());
  await page.waitForTimeout(800);
  const reloaded = page.frames().find((f) => f.url().startsWith(GAME))!;
  await reloaded.locator('[data-screen="levels"], [data-screen="title"]').first().waitFor({ timeout: 5000 });
  const done = await reloaded.evaluate(() => Object.keys(JSON.parse(localStorage.getItem('bad-commute.save') ?? '{}').levels ?? {}));
  check('Progress survives a refresh', done.includes('rc-01'), done.join(','));
  await ctx.close();
}

{
  console.log('\n-- Storage denied --');
  const { page, frame, errors, ctx } = await hostPage(true);
  await startFirstLevel(frame);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  check('Plays with localStorage throwing', errors.length === 0, errors.join(' | '));
  check('Says progress cannot be saved', await frame.locator('#save-warn').isVisible());
  await ctx.close();
}

{
  console.log('\n-- On its own URL --');
  const ctx = await browser.newContext({ viewport: { width: 844, height: 390 } });
  await serveGame(ctx);
  const page = await ctx.newPage();
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => {
    if (m.type() === 'error') errors.push(m.text());
  });
  await page.goto(GAME);
  await startFirstLevel(page.mainFrame());
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(300);
  await page.keyboard.up('KeyW');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(250);
  const canvas = await page.evaluate(() => (document.getElementById('game') as HTMLCanvasElement).clientWidth);
  check('Resizing keeps the game going', canvas === 1280 && (await page.locator('#hud').isVisible()), String(canvas));
  check('Plays standalone with no errors', errors.length === 0, errors.join(' | '));
  await ctx.close();
}

{
  console.log('\n-- Portrait phone --');
  const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
  await serveGame(ctx);
  const page = await ctx.newPage();
  await page.goto(GAME);
  await page.locator('[data-act="notice-continue"]').tap();
  check('Menus work in portrait', await page.locator('[data-act="continue"]').isVisible());
  await page.locator('[data-act="continue"]').tap();
  await page.waitForTimeout(250);
  check('Gameplay in portrait asks to rotate', await page.locator('#rotate').isVisible());
  check('Gameplay in portrait is paused', (await page.locator('[data-screen="pause"]').count()) === 1);
  await page.setViewportSize({ width: 844, height: 390 });
  await page.waitForTimeout(250);
  check('Rotating removes the prompt', !(await page.locator('#rotate').isVisible()));
  await page.locator('[data-act="resume"]').tap();
  await page.waitForTimeout(150);
  check('Touch controls appear in landscape', await page.locator('.tbtn.throttle').isVisible());
  const box = await page.locator('.tbtn[data-action="leanBack"]').boundingBox();
  check('Touch targets are at least 56px', (box?.width ?? 0) >= 56 && (box?.height ?? 0) >= 56, `${box?.width}x${box?.height}`);
  await ctx.close();
}

await browser.close();
console.log(failures ? `\n${failures} failed` : '\nAll embed checks passed.');
process.exit(failures ? 1 : 0);
