/**
 * @module color
 * Color parsing, token detection, and interpolation through RGB space.
 * No DOM dependencies — the core engine works in any JS runtime.
 */

import type { Color, ColorResolver, ColorToken } from './types';
import { COLOR_TOKENS } from './types';

/** Check whether a string is a named color token. */
export function isColorToken(c: string): c is ColorToken {
  return (COLOR_TOKENS as readonly string[]).includes(c);
}

/** Parse a hex color string (#RGB, #RRGGBB, or #RRGGBBAA) to [R, G, B]. */
export function parseHexToRgb(hex: string): [number, number, number] | null {
  if (!hex.startsWith('#')) return null;
  const h = hex.slice(1);

  if (h.length === 3) {
    const r = parseInt(h[0]! + h[0]!, 16);
    const g = parseInt(h[1]! + h[1]!, 16);
    const b = parseInt(h[2]! + h[2]!, 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }

  if (h.length === 6 || h.length === 8) {
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    if (isNaN(r) || isNaN(g) || isNaN(b)) return null;
    return [r, g, b];
  }

  return null;
}

/** Parse an rgb(...) or rgba(...) string to [R, G, B]. */
function parseRgbString(str: string): [number, number, number] | null {
  const m = str.match(/rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/);
  if (!m) return null;
  return [Number(m[1]), Number(m[2]), Number(m[3])];
}

/** Resolve a Color value to an RGB triplet, using the optional resolver for tokens. */
function resolveToRgb(
  c: Color,
  resolver?: ColorResolver,
): [number, number, number] | null {
  if (isColorToken(c)) {
    return resolver ? resolver.resolve(c) : null;
  }
  if (c.startsWith('#')) return parseHexToRgb(c);
  if (c.startsWith('rgb')) return parseRgbString(c);
  return null;
}

/** Linearly interpolate between two RGB triplets and return an rgb() string. */
export function lerpRgb(
  a: [number, number, number],
  b: [number, number, number],
  t: number,
): string {
  const r = Math.round(a[0] + (b[0] - a[0]) * t);
  const g = Math.round(a[1] + (b[1] - a[1]) * t);
  const bl = Math.round(a[2] + (b[2] - a[2]) * t);
  return `rgb(${r},${g},${bl})`;
}

/**
 * Interpolate between two color values at parameter t.
 *
 * - Hex/rgb colors always lerp through RGB space.
 * - Named tokens use the optional ColorResolver if provided.
 * - Without a resolver, unresolvable tokens fall back to a step function
 *   (returns a when t < 0.5, b otherwise).
 * - If both colors are identical, returns that color unchanged.
 */
export function interpolateColor(
  a: Color,
  b: Color,
  t: number,
  resolver?: ColorResolver,
): Color {
  if (a === b) return a;

  const rgbA = resolveToRgb(a, resolver);
  const rgbB = resolveToRgb(b, resolver);

  if (rgbA && rgbB) return lerpRgb(rgbA, rgbB, t);
  if (!rgbA && !rgbB) return t < 0.5 ? a : b;
  if (!rgbA) return b;
  return a;
}
