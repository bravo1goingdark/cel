/**
 * @module sample
 * Core sampling algorithm. Given a sprite and time t, produces the fully
 * resolved transform values by interpolating between keyframes.
 */

import type {
  Color,
  ColorResolver,
  Keyframe,
  SampledSprite,
  Scene,
  Sprite,
} from './types';
import { DEFAULT_TRANSFORM } from './types';
import { evaluateEasing } from './easing';
import { interpolateColor } from './color';

/** Linear interpolation. */
function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/**
 * Read a numeric keyframe property, falling back to the default transform.
 */
function kfNum(kf: Keyframe, prop: 'x' | 'y' | 'opacity' | 'fontSize' | 'rotation'): number {
  const v = kf[prop];
  return v !== undefined ? v : DEFAULT_TRANSFORM[prop];
}

/** Read the color from a keyframe, falling back to the default. */
function kfColor(kf: Keyframe): Color {
  return kf.color ?? DEFAULT_TRANSFORM.color;
}

/**
 * Find the last text value at or before time t by scanning keyframes.
 * Returns the sprite's default text if no keyframe overrides text before t.
 */
function textAt(sprite: Sprite, t: number): string {
  let last = sprite.text;
  for (const kf of sprite.keyframes) {
    if (kf.t > t) break;
    if (kf.text != null) last = kf.text;
  }
  return last;
}

/**
 * Binary search: find the rightmost keyframe index where kf.t <= t.
 * Precondition: keyframes sorted by t ascending, length >= 2.
 * Returns the index of the segment start (A in [A, B]).
 */
function findSegment(keyframes: Keyframe[], t: number): number {
  let lo = 0;
  let hi = keyframes.length - 2; // max valid segment start
  while (lo < hi) {
    const mid = (lo + hi + 1) >>> 1;
    if (keyframes[mid]!.t <= t) {
      lo = mid;
    } else {
      hi = mid - 1;
    }
  }
  return lo;
}

/**
 * Sample a single sprite at time t, producing a fully resolved SampledSprite.
 *
 * Algorithm (spec section 4.4):
 * 1. Empty keyframes → return default transform.
 * 2. t <= first keyframe → return first keyframe values.
 * 3. t >= last keyframe → return last keyframe values.
 * 4. Binary search for segment [A, B] where A.t <= t < B.t.
 * 5. Compute eased interpolation parameter.
 * 6. Lerp each property.
 * 7. Resolve text from last text-bearing keyframe at or before t.
 */
export function sampleSprite(
  sprite: Sprite,
  t: number,
  resolver?: ColorResolver,
): SampledSprite {
  const { keyframes } = sprite;
  const text = textAt(sprite, t);

  // Case 1: no keyframes
  if (keyframes.length === 0) {
    return {
      id: sprite.id,
      text,
      x: DEFAULT_TRANSFORM.x,
      y: DEFAULT_TRANSFORM.y,
      opacity: DEFAULT_TRANSFORM.opacity,
      fontSize: DEFAULT_TRANSFORM.fontSize,
      rotation: DEFAULT_TRANSFORM.rotation,
      color: DEFAULT_TRANSFORM.color,
    };
  }

  const first = keyframes[0]!;
  const last = keyframes[keyframes.length - 1]!;

  // Case 2: before or at first keyframe
  if (t <= first.t) {
    return {
      id: sprite.id,
      text,
      x: kfNum(first, 'x'),
      y: kfNum(first, 'y'),
      opacity: kfNum(first, 'opacity'),
      fontSize: kfNum(first, 'fontSize'),
      rotation: kfNum(first, 'rotation'),
      color: kfColor(first),
    };
  }

  // Case 3: at or after last keyframe
  if (t >= last.t) {
    return {
      id: sprite.id,
      text,
      x: kfNum(last, 'x'),
      y: kfNum(last, 'y'),
      opacity: kfNum(last, 'opacity'),
      fontSize: kfNum(last, 'fontSize'),
      rotation: kfNum(last, 'rotation'),
      color: kfColor(last),
    };
  }

  // Case 4: interpolate between two keyframes
  const i = findSegment(keyframes, t);
  const ka = keyframes[i]!;
  const kb = keyframes[i + 1]!;

  const p = (t - ka.t) / (kb.t - ka.t);
  const eased = evaluateEasing(p, kb.easing);

  return {
    id: sprite.id,
    text,
    x: lerp(kfNum(ka, 'x'), kfNum(kb, 'x'), eased),
    y: lerp(kfNum(ka, 'y'), kfNum(kb, 'y'), eased),
    opacity: lerp(kfNum(ka, 'opacity'), kfNum(kb, 'opacity'), eased),
    fontSize: lerp(kfNum(ka, 'fontSize'), kfNum(kb, 'fontSize'), eased),
    rotation: lerp(kfNum(ka, 'rotation'), kfNum(kb, 'rotation'), eased),
    color: interpolateColor(kfColor(ka), kfColor(kb), eased, resolver),
  };
}

/**
 * Sample all visible sprites in a scene at time t.
 * Hidden sprites are excluded from the result.
 */
export function sampleScene(
  scene: Scene,
  t: number,
  resolver?: ColorResolver,
): SampledSprite[] {
  const result: SampledSprite[] = [];
  for (const sprite of scene.sprites) {
    if (sprite.hidden) continue;
    result.push(sampleSprite(sprite, t, resolver));
  }
  return result;
}
