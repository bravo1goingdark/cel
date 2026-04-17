import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createPlayer } from '../src/player';
import type { RenderTarget } from '../src/player';
import type { SampledSprite, Scene } from '../src/types';

function testScene(): Scene {
  return {
    version: 1,
    duration: 2000,
    fps: 60,
    sprites: [
      {
        id: 'a',
        text: 'hello',
        keyframes: [
          { t: 0, x: 0 },
          { t: 2000, x: 100 },
        ],
      },
    ],
  };
}

function mockTarget(): RenderTarget & { calls: Array<{ sprites: SampledSprite[]; t: number }> } {
  const calls: Array<{ sprites: SampledSprite[]; t: number }> = [];
  return {
    calls,
    render(sprites, t) {
      calls.push({ sprites: [...sprites], t });
    },
  };
}

// Simulate requestAnimationFrame manually for tick coverage
let rafCallbacks: Map<number, (now: number) => void>;
let rafId: number;

function setupRAFMock(): void {
  rafCallbacks = new Map();
  rafId = 0;

  vi.stubGlobal('requestAnimationFrame', (cb: (now: number) => void) => {
    const id = ++rafId;
    rafCallbacks.set(id, cb);
    return id;
  });

  vi.stubGlobal('cancelAnimationFrame', (id: number) => {
    rafCallbacks.delete(id);
  });
}

function flushRAF(now: number): void {
  // Take a snapshot of current callbacks so new ones from this tick don't run yet
  const cbs = [...rafCallbacks.entries()];
  rafCallbacks.clear();
  for (const [, cb] of cbs) {
    cb(now);
  }
}

describe('createPlayer', () => {
  beforeEach(() => {
    setupRAFMock();
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('starts paused at t=0', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    expect(player.playing).toBe(false);
    expect(player.currentTime).toBe(0);
    player.destroy();
  });

  it('renders initial frame on creation', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    expect(target.calls.length).toBe(1);
    expect(target.calls[0]!.t).toBe(0);
    player.destroy();
  });

  it('seek updates currentTime and renders', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    player.seek(1000);
    expect(player.currentTime).toBe(1000);
    expect(target.calls.length).toBe(2);
    expect(target.calls[1]!.t).toBe(1000);
    player.destroy();
  });

  it('seek clamps to [0, duration]', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);

    player.seek(-100);
    expect(player.currentTime).toBe(0);

    player.seek(5000);
    expect(player.currentTime).toBe(2000);

    player.destroy();
  });

  it('play starts playback and schedules rAF', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    player.play();
    expect(player.playing).toBe(true);
    expect(rafCallbacks.size).toBe(1);
    player.destroy();
  });

  it('tick advances time and renders', () => {
    const target = mockTarget();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const player = createPlayer(testScene(), target);
    player.play();

    // Simulate 100ms passing
    flushRAF(100);
    expect(player.currentTime).toBeGreaterThan(0);
    expect(player.currentTime).toBeLessThan(2000);
    // 1 initial render + at least 1 tick render
    expect(target.calls.length).toBeGreaterThanOrEqual(2);

    player.destroy();
  });

  it('loops when looping is enabled and time exceeds duration', () => {
    const target = mockTarget();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const player = createPlayer(testScene(), target);
    player.setLooping(true);
    player.play();

    // Simulate a large dt that exceeds duration
    flushRAF(2500);
    expect(player.playing).toBe(true);
    expect(player.currentTime).toBeLessThan(2000);

    player.destroy();
  });

  it('stops at duration when not looping', () => {
    // Use a very short scene so one clamped tick (100ms) exceeds it
    const shortScene: Scene = {
      version: 1,
      duration: 50,
      sprites: [{ id: 'a', text: 'x', keyframes: [{ t: 0, x: 0 }, { t: 50, x: 10 }] }],
    };
    const target = mockTarget();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const player = createPlayer(shortScene, target);
    player.setLooping(false);
    player.play();

    // dt = min(100 - 0, 100) = 100 > duration (50), so player stops
    flushRAF(100);
    expect(player.playing).toBe(false);
    expect(player.currentTime).toBe(50);

    player.destroy();
  });

  it('speed multiplier affects dt', () => {
    const target = mockTarget();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const player = createPlayer(testScene(), target);
    player.setSpeed(2);
    player.play();

    flushRAF(100);
    // At 2x speed, 100ms wall time = 200ms scene time
    expect(player.currentTime).toBeCloseTo(200, -1);

    player.destroy();
  });

  it('pause stops playback and cancels rAF', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    player.play();
    expect(rafCallbacks.size).toBe(1);
    player.pause();
    expect(player.playing).toBe(false);
    expect(rafCallbacks.size).toBe(0);
    player.destroy();
  });

  it('destroy stops everything and cancels rAF', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    player.play();
    player.destroy();
    expect(player.playing).toBe(false);
    expect(rafCallbacks.size).toBe(0);
  });

  it('play is idempotent', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    player.play();
    player.play(); // should not double-schedule
    expect(rafCallbacks.size).toBe(1);
    player.destroy();
  });

  it('destroy prevents further play', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    player.destroy();
    player.play();
    expect(player.playing).toBe(false);
    expect(rafCallbacks.size).toBe(0);
  });

  it('multiple ticks advance continuously', () => {
    const target = mockTarget();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const player = createPlayer(testScene(), target);
    player.play();

    flushRAF(50);
    const t1 = player.currentTime;
    flushRAF(100);
    const t2 = player.currentTime;
    expect(t2).toBeGreaterThan(t1);

    player.destroy();
  });

  it('loops correctly with modulo on short scene', () => {
    const shortScene: Scene = {
      version: 1,
      duration: 50,
      sprites: [{ id: 'a', text: 'x', keyframes: [{ t: 0, x: 0 }, { t: 50, x: 10 }] }],
    };
    const target = mockTarget();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const player = createPlayer(shortScene, target);
    player.setLooping(true);
    player.play();

    // tick with 80ms > duration, looping wraps
    flushRAF(80);
    expect(player.playing).toBe(true);
    expect(player.currentTime).toBeLessThan(50);
    expect(player.currentTime).toBeGreaterThanOrEqual(0);

    player.destroy();
  });

  it('clamps dt to 100ms max to prevent time jumps', () => {
    const target = mockTarget();
    vi.spyOn(performance, 'now').mockReturnValue(0);
    const player = createPlayer(testScene(), target);
    player.play();

    // Simulate a 500ms pause (e.g., tab was backgrounded)
    // dt should be clamped to 100ms
    flushRAF(500);
    expect(player.currentTime).toBeLessThanOrEqual(100);

    player.destroy();
  });
});

describe('createPlayer (setTimeout fallback)', () => {
  let origRAF: typeof globalThis.requestAnimationFrame;
  let origCAF: typeof globalThis.cancelAnimationFrame;

  beforeEach(() => {
    origRAF = globalThis.requestAnimationFrame;
    origCAF = globalThis.cancelAnimationFrame;
    // Remove rAF to trigger setTimeout fallback
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).requestAnimationFrame = undefined;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (globalThis as any).cancelAnimationFrame = undefined;
    vi.useFakeTimers();
    vi.spyOn(performance, 'now').mockReturnValue(0);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
    globalThis.requestAnimationFrame = origRAF;
    globalThis.cancelAnimationFrame = origCAF;
  });

  it('falls back to setTimeout when rAF is unavailable', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    player.play();
    expect(player.playing).toBe(true);

    // Advance fake timers to trigger the setTimeout callback
    vi.spyOn(performance, 'now').mockReturnValue(50);
    vi.advanceTimersByTime(20);
    expect(target.calls.length).toBeGreaterThanOrEqual(2);

    player.destroy();
  });

  it('cancels setTimeout on pause', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    player.play();
    player.pause();
    expect(player.playing).toBe(false);
    player.destroy();
  });

  it('cancels setTimeout on destroy', () => {
    const target = mockTarget();
    const player = createPlayer(testScene(), target);
    player.play();
    player.destroy();
    expect(player.playing).toBe(false);
  });
});
