/**
 * @module player
 * Optional playback helper. Tree-shakeable — consumers who only need
 * sampleSprite do not pay for this module.
 */

import type { ColorResolver, SampledSprite, Scene } from './types';
import { sampleScene } from './sample';

/** Callback target that receives sampled sprites each frame. */
export interface RenderTarget {
  render(sprites: SampledSprite[], t: number): void;
}

/** Playback controller returned by createPlayer. */
export interface Player {
  play(): void;
  pause(): void;
  seek(t: number): void;
  setSpeed(speed: number): void;
  setLooping(loop: boolean): void;
  destroy(): void;
  readonly playing: boolean;
  readonly currentTime: number;
}

/**
 * Create a playback controller for a scene.
 * Uses requestAnimationFrame when available, setTimeout fallback otherwise.
 */
export function createPlayer(
  scene: Scene,
  target: RenderTarget,
  resolver?: ColorResolver,
): Player {
  let t = 0;
  let playing = false;
  let looping = true;
  let speed = 1;
  let lastTimestamp = 0;
  let frameId: number | undefined;
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  let destroyed = false;

  const hasRAF = typeof requestAnimationFrame === 'function';
  const fps = scene.fps ?? 60;
  const frameDuration = 1000 / fps;

  function renderFrame(): void {
    const sampled = sampleScene(scene, t, resolver);
    target.render(sampled, t);
  }

  function tick(now: number): void {
    if (destroyed || !playing) return;

    const dt = Math.min(now - lastTimestamp, 100) * speed;
    lastTimestamp = now;

    const next = t + dt;
    if (next >= scene.duration) {
      if (looping) {
        t = next % scene.duration;
      } else {
        t = scene.duration;
        playing = false;
        renderFrame();
        return;
      }
    } else {
      t = next;
    }

    renderFrame();
    scheduleNext();
  }

  function scheduleNext(): void {
    if (destroyed || !playing) return;
    if (hasRAF) {
      frameId = requestAnimationFrame(tick);
    } else {
      timeoutId = setTimeout(() => tick(performance.now()), frameDuration);
    }
  }

  function cancelScheduled(): void {
    if (frameId !== undefined) {
      cancelAnimationFrame(frameId);
      frameId = undefined;
    }
    if (timeoutId !== undefined) {
      clearTimeout(timeoutId);
      timeoutId = undefined;
    }
  }

  const player: Player = {
    get playing() {
      return playing;
    },

    get currentTime() {
      return t;
    },

    play() {
      if (destroyed || playing) return;
      playing = true;
      lastTimestamp = performance.now();
      scheduleNext();
    },

    pause() {
      playing = false;
      cancelScheduled();
    },

    seek(newT: number) {
      t = Math.max(0, Math.min(scene.duration, newT));
      renderFrame();
    },

    setSpeed(s: number) {
      speed = s;
    },

    setLooping(loop: boolean) {
      looping = loop;
    },

    destroy() {
      destroyed = true;
      playing = false;
      cancelScheduled();
    },
  };

  // Render the initial frame
  renderFrame();

  return player;
}
