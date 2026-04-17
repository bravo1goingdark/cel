/**
 * @module easing
 * Easing function evaluation. Named easings + cubic bezier via Newton-Raphson.
 */

import type { Easing } from './types';

const NEWTON_ITERATIONS = 8;
const NEWTON_MIN_SLOPE = 0.001;
const SUBDIVISION_PRECISION = 0.0000001;
const SUBDIVISION_MAX_ITERATIONS = 10;

/**
 * Evaluate an easing function at parameter t.
 * Returns a value in [0, 1] for valid inputs and control points.
 */
export function evaluateEasing(t: number, easing: Easing | undefined): number {
  if (t <= 0) return 0;
  if (t >= 1) return 1;

  if (easing === undefined || easing === 'linear') return t;

  if (typeof easing === 'object' && 'cubic' in easing) {
    return evaluateBezier(t, easing.cubic);
  }

  switch (easing) {
    case 'in':
      return t * t;
    case 'out':
      return 1 - (1 - t) ** 2;
    case 'inout':
      return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2;
    default:
      return t;
  }
}

/**
 * Cubic bezier evaluation using Newton-Raphson with bisection fallback.
 * Standard algorithm from the CSS transitions spec.
 * Control points: [x1, y1, x2, y2]. The curve goes from (0,0) to (1,1).
 */
function evaluateBezier(
  t: number,
  [x1, y1, x2, y2]: [number, number, number, number],
): number {
  // Linear shortcut
  if (x1 === y1 && x2 === y2) return t;

  // Find the parametric value s where bezierX(s) === t
  const s = solveCurveX(t, x1, x2);
  // Evaluate bezierY at that parameter
  return calcBezier(s, y1, y2);
}

/** Evaluate the cubic bezier polynomial at parameter s for a single axis. */
function calcBezier(s: number, a: number, b: number): number {
  return ((1 - 3 * b + 3 * a) * s + (3 * b - 6 * a)) * s * s + 3 * a * s;
}

/** Derivative of the cubic bezier polynomial. */
function calcSlope(s: number, a: number, b: number): number {
  return 3 * (1 - 3 * b + 3 * a) * s * s + 2 * (3 * b - 6 * a) * s + 3 * a;
}

/** Find the parametric value s such that bezierX(s) = x. */
function solveCurveX(x: number, x1: number, x2: number): number {
  // Newton-Raphson
  let s = x;
  for (let i = 0; i < NEWTON_ITERATIONS; i++) {
    const slope = calcSlope(s, x1, x2);
    if (Math.abs(slope) < NEWTON_MIN_SLOPE) break;
    const cx = calcBezier(s, x1, x2) - x;
    s -= cx / slope;
  }

  // If Newton didn't converge, fall back to bisection
  let lo = 0;
  let hi = 1;
  s = x;
  for (let i = 0; i < SUBDIVISION_MAX_ITERATIONS; i++) {
    const cx = calcBezier(s, x1, x2) - x;
    if (Math.abs(cx) < SUBDIVISION_PRECISION) return s;
    if (cx > 0) {
      hi = s;
    } else {
      lo = s;
    }
    s = (lo + hi) / 2;
  }
  return s;
}
