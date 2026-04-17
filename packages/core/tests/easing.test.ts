import { describe, it, expect } from 'vitest';
import { evaluateEasing } from '../src/easing';
import type { Easing } from '../src/types';

describe('evaluateEasing', () => {
  describe('boundary clamping', () => {
    const easings: (Easing | undefined)[] = [
      undefined, 'linear', 'in', 'out', 'inout',
      { cubic: [0.42, 0, 0.58, 1] },
    ];

    it.each(easings)('returns 0 for t <= 0 (easing: %j)', (easing) => {
      expect(evaluateEasing(0, easing)).toBe(0);
      expect(evaluateEasing(-1, easing)).toBe(0);
      expect(evaluateEasing(-0.5, easing)).toBe(0);
    });

    it.each(easings)('returns 1 for t >= 1 (easing: %j)', (easing) => {
      expect(evaluateEasing(1, easing)).toBe(1);
      expect(evaluateEasing(1.5, easing)).toBe(1);
      expect(evaluateEasing(100, easing)).toBe(1);
    });
  });

  describe('undefined / linear', () => {
    it('undefined easing returns t', () => {
      expect(evaluateEasing(0.25, undefined)).toBe(0.25);
      expect(evaluateEasing(0.5, undefined)).toBe(0.5);
      expect(evaluateEasing(0.75, undefined)).toBe(0.75);
    });

    it('linear easing returns t', () => {
      expect(evaluateEasing(0.25, 'linear')).toBe(0.25);
      expect(evaluateEasing(0.5, 'linear')).toBe(0.5);
      expect(evaluateEasing(0.75, 'linear')).toBe(0.75);
    });
  });

  describe('named easings', () => {
    it('in: t*t (quadratic ease-in)', () => {
      expect(evaluateEasing(0.5, 'in')).toBe(0.25);
      expect(evaluateEasing(0.25, 'in')).toBeCloseTo(0.0625, 10);
    });

    it('out: 1 - (1-t)^2 (quadratic ease-out)', () => {
      expect(evaluateEasing(0.5, 'out')).toBe(0.75);
      expect(evaluateEasing(0.25, 'out')).toBeCloseTo(0.4375, 10);
    });

    it('inout: piecewise quadratic', () => {
      expect(evaluateEasing(0.25, 'inout')).toBeCloseTo(0.125, 10);
      expect(evaluateEasing(0.5, 'inout')).toBe(0.5);
      expect(evaluateEasing(0.75, 'inout')).toBeCloseTo(0.875, 10);
    });
  });

  describe('unknown named easing falls back to linear', () => {
    it('returns t for unknown string', () => {
      expect(evaluateEasing(0.5, 'bogus' as Easing)).toBe(0.5);
    });
  });

  describe('cubic bezier', () => {
    it('[0,0,1,1] is linear', () => {
      const bezier: Easing = { cubic: [0, 0, 1, 1] };
      expect(evaluateEasing(0.25, bezier)).toBeCloseTo(0.25, 4);
      expect(evaluateEasing(0.5, bezier)).toBeCloseTo(0.5, 4);
      expect(evaluateEasing(0.75, bezier)).toBeCloseTo(0.75, 4);
    });

    it('[0.42, 0, 0.58, 1] (CSS ease-in-out equivalent)', () => {
      const bezier: Easing = { cubic: [0.42, 0, 0.58, 1] };
      const mid = evaluateEasing(0.5, bezier);
      expect(mid).toBeCloseTo(0.5, 2);
      // Should be slower at start
      expect(evaluateEasing(0.25, bezier)).toBeLessThan(0.25);
      // Should be faster past midpoint
      expect(evaluateEasing(0.75, bezier)).toBeGreaterThan(0.75);
    });

    it('[0.25, 0.1, 0.25, 1] (CSS ease)', () => {
      const bezier: Easing = { cubic: [0.25, 0.1, 0.25, 1] };
      const result = evaluateEasing(0.5, bezier);
      expect(result).toBeGreaterThan(0.5);
      expect(result).toBeLessThan(1);
    });

    it('output is always in [0,1] for valid control points', () => {
      const bezier: Easing = { cubic: [0.5, 0.5, 0.5, 0.5] };
      for (let i = 0; i <= 100; i++) {
        const t = i / 100;
        const v = evaluateEasing(t, bezier);
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(1);
      }
    });
  });
});
