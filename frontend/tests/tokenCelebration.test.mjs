import test from 'node:test';
import assert from 'node:assert/strict';
import { watchTokenCelebration } from '../src/lib/tokenCelebration.ts';

async function setup(t, { reduced = false, complete = true, observer = true } = {}) {
  const saved = new Map(['window', 'document', 'IntersectionObserver'].map((key) => [key, Object.getOwnPropertyDescriptor(globalThis, key)]));
  const timers = new Map();
  let nextId = 0;
  let intersection;
  let rect = { top: 100, bottom: 360, left: 200, right: 460, width: 260, height: 260 };
  const classes = new Set(['mission-token-reveal--pending']);
  const reward = {
    getBoundingClientRect: () => rect,
    classList: { add: (name) => classes.add(name), remove: (...names) => names.forEach((name) => classes.delete(name)) },
    offsetWidth: 260,
  };
  const image = new EventTarget();
  image.complete = complete;
  image.decode = () => Promise.resolve();
  const motion = new EventTarget();
  motion.matches = reduced;
  const window = new EventTarget();
  Object.assign(window, {
    innerHeight: 800, innerWidth: 1280,
    matchMedia: () => motion,
    setTimeout: (fn) => { timers.set(++nextId, fn); return nextId; },
    clearTimeout: (id) => timers.delete(id),
  });
  const canvases = [];
  const document = new EventTarget();
  document.visibilityState = 'visible';
  document.createElement = () => ({ setAttribute() {}, remove() { this.removed = true; } });
  document.body = { appendChild: (canvas) => canvases.push(canvas) };
  globalThis.window = window;
  globalThis.document = document;
  globalThis.IntersectionObserver = observer ? class {
    constructor(callback) { intersection = callback; }
    observe() {}
    disconnect() { intersection = undefined; }
  } : undefined;
  const shots = [];
  let resets = 0;
  const create = () => Object.assign((options) => {
    shots.push(options);
    return Promise.resolve(null);
  }, { reset: () => { resets++; } });
  const cleanup = watchTokenCelebration(reward, image, create);
  t.after(() => {
    cleanup();
    for (const [key, descriptor] of saved) {
      if (descriptor) Object.defineProperty(globalThis, key, descriptor);
      else delete globalThis[key];
    }
  });
  await Promise.resolve();
  await Promise.resolve();
  return {
    shots, canvases, classes, cleanup, image, window, document, motion,
    get resets() { return resets; },
    get pending() { return timers.size; },
    visible: (isIntersecting = true, intersectionRatio = 1) => intersection?.([{ isIntersecting, intersectionRatio }]),
    hide() { document.visibilityState = 'hidden'; document.dispatchEvent(new Event('visibilitychange')); },
    show() { document.visibilityState = 'visible'; document.dispatchEvent(new Event('visibilitychange')); },
    offscreen() { rect = { ...rect, top: 900, bottom: 1160 }; },
    tick() { const due = [...timers.entries()]; for (const [id, fn] of due) if (timers.delete(id)) fn(); },
  };
}

test('fires once after the token image is ready and visible', async (t) => {
  const app = await setup(t);
  assert.equal(app.shots.length, 0);
  app.visible();
  assert.equal(app.pending, 1);
  app.tick();
  assert.equal(app.shots.length, 1);
  assert.equal(app.shots[0].particleCount, 100);
  assert.equal(app.canvases.length, 1);
  app.visible(); app.show(); app.tick();
  assert.equal(app.shots.length, 1);
});

test('regression: hiding the tab before the burst retries on return', async (t) => {
  const app = await setup(t);
  app.visible();
  app.hide();
  app.tick();
  assert.equal(app.shots.length, 0);
  app.show();
  app.tick();
  assert.equal(app.shots.length, 1);
});

test('regression: a hidden timer firing without a visibility event does not consume the burst', async (t) => {
  const app = await setup(t);
  app.visible();
  app.document.visibilityState = 'hidden';
  app.tick();
  app.show(); app.tick();
  assert.equal(app.shots.length, 1);
});

test('moving the token offscreen before the burst defers until it is visible again', async (t) => {
  const app = await setup(t);
  app.visible(); app.visible(false); app.tick();
  assert.equal(app.shots.length, 0);
  app.visible(); app.tick();
  assert.equal(app.shots.length, 1);
});

test('a partially visible token below the old 35 percent threshold can celebrate', async (t) => {
  const app = await setup(t);
  app.visible(true, 0.2); app.tick();
  assert.equal(app.shots.length, 1);
});

test('waits for uncached image load and reveals even when image loading fails', async (t) => {
  const app = await setup(t, { complete: false });
  app.visible(); app.tick();
  assert.equal(app.shots.length, 0);
  app.image.dispatchEvent(new Event('error'));
  app.tick();
  assert.equal(app.shots.length, 1);
});

test('reduced-motion preference reveals the token without confetti', async (t) => {
  const app = await setup(t, { reduced: true });
  app.visible(); app.tick();
  assert.equal(app.shots.length, 0);
  assert.equal(app.canvases.length, 0);
  assert.equal(app.classes.has('mission-token-reveal--pending'), false);
});

test('enabling reduced motion during the delay cancels confetti', async (t) => {
  const app = await setup(t);
  app.visible();
  app.motion.matches = true;
  app.motion.dispatchEvent(new Event('change'));
  app.tick();
  assert.equal(app.shots.length, 0);
});

test('unmount cancels a pending burst and removes its listeners', async (t) => {
  const app = await setup(t);
  app.visible(); app.cleanup(); app.show(); app.tick();
  assert.equal(app.shots.length, 0);
  assert.equal(app.pending, 0);
});

test('unmount cleans the canvas and running animation', async (t) => {
  const app = await setup(t);
  app.visible(); app.tick(); app.cleanup();
  assert.equal(app.resets, 1);
  assert.equal(app.canvases[0].removed, true);
});

test('fallback works without IntersectionObserver', async (t) => {
  const app = await setup(t, { observer: false });
  app.tick();
  assert.equal(app.shots.length, 1);
});
