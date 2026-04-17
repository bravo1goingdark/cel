import { describe, it, expect } from 'vitest';
import { sampleSprite, sampleScene } from '../src/sample';
import type { Scene, Sprite } from '../src/types';
import { DEFAULT_TRANSFORM } from '../src/types';

function makeSprite(overrides: Partial<Sprite> = {}): Sprite {
  return {
    id: 'test',
    text: 'hello',
    keyframes: [],
    ...overrides,
  };
}

describe('sampleSprite', () => {
  describe('empty keyframes', () => {
    it('returns default transform values', () => {
      const sprite = makeSprite();
      const result = sampleSprite(sprite, 500);
      expect(result.id).toBe('test');
      expect(result.text).toBe('hello');
      expect(result.x).toBe(DEFAULT_TRANSFORM.x);
      expect(result.y).toBe(DEFAULT_TRANSFORM.y);
      expect(result.opacity).toBe(DEFAULT_TRANSFORM.opacity);
      expect(result.fontSize).toBe(DEFAULT_TRANSFORM.fontSize);
      expect(result.rotation).toBe(DEFAULT_TRANSFORM.rotation);
      expect(result.color).toBe(DEFAULT_TRANSFORM.color);
    });
  });

  describe('single keyframe', () => {
    it('returns keyframe values for any t', () => {
      const sprite = makeSprite({
        keyframes: [{ t: 100, x: 10, y: 20, opacity: 0.5, fontSize: 24, rotation: 45 }],
      });

      const before = sampleSprite(sprite, 0);
      expect(before.x).toBe(10);
      expect(before.y).toBe(20);

      const at = sampleSprite(sprite, 100);
      expect(at.x).toBe(10);
      expect(at.opacity).toBe(0.5);

      const after = sampleSprite(sprite, 500);
      expect(after.x).toBe(10);
      expect(after.fontSize).toBe(24);
    });
  });

  describe('two keyframes with linear easing', () => {
    const sprite = makeSprite({
      keyframes: [
        { t: 0, x: 0, y: 0, opacity: 0, fontSize: 10, rotation: 0, color: '#000000' },
        { t: 1000, x: 100, y: 50, opacity: 1, fontSize: 20, rotation: 360, color: '#ffffff' },
      ],
    });

    it('returns first keyframe values at t=0', () => {
      const result = sampleSprite(sprite, 0);
      expect(result.x).toBe(0);
      expect(result.y).toBe(0);
      expect(result.opacity).toBe(0);
    });

    it('returns last keyframe values at t=1000', () => {
      const result = sampleSprite(sprite, 1000);
      expect(result.x).toBe(100);
      expect(result.opacity).toBe(1);
    });

    it('interpolates linearly at midpoint', () => {
      const result = sampleSprite(sprite, 500);
      expect(result.x).toBeCloseTo(50, 6);
      expect(result.y).toBeCloseTo(25, 6);
      expect(result.opacity).toBeCloseTo(0.5, 6);
      expect(result.fontSize).toBeCloseTo(15, 6);
      expect(result.rotation).toBeCloseTo(180, 6);
    });

    it('interpolates at quarter point', () => {
      const result = sampleSprite(sprite, 250);
      expect(result.x).toBeCloseTo(25, 6);
      expect(result.opacity).toBeCloseTo(0.25, 6);
    });
  });

  describe('easing variations', () => {
    it('applies "in" easing (slower at start)', () => {
      const sprite = makeSprite({
        keyframes: [
          { t: 0, x: 0 },
          { t: 1000, x: 100, easing: 'in' },
        ],
      });
      const result = sampleSprite(sprite, 500);
      // in: t*t => 0.5*0.5 = 0.25, so x = 25
      expect(result.x).toBeCloseTo(25, 6);
    });

    it('applies "out" easing (faster at start)', () => {
      const sprite = makeSprite({
        keyframes: [
          { t: 0, x: 0 },
          { t: 1000, x: 100, easing: 'out' },
        ],
      });
      const result = sampleSprite(sprite, 500);
      // out: 1-(1-0.5)^2 = 0.75, so x = 75
      expect(result.x).toBeCloseTo(75, 6);
    });

    it('applies "inout" easing', () => {
      const sprite = makeSprite({
        keyframes: [
          { t: 0, x: 0 },
          { t: 1000, x: 100, easing: 'inout' },
        ],
      });
      const result = sampleSprite(sprite, 500);
      expect(result.x).toBeCloseTo(50, 6);

      const quarter = sampleSprite(sprite, 250);
      // inout at 0.25: 2 * 0.25^2 = 0.125 => x = 12.5
      expect(quarter.x).toBeCloseTo(12.5, 6);
    });
  });

  describe('sparse keyframes (missing properties use defaults)', () => {
    it('uses defaults for unset properties', () => {
      const sprite = makeSprite({
        keyframes: [
          { t: 0, x: 10 },
          { t: 1000, x: 20 },
        ],
      });
      const result = sampleSprite(sprite, 500);
      expect(result.x).toBeCloseTo(15, 6);
      expect(result.y).toBe(DEFAULT_TRANSFORM.y);
      expect(result.opacity).toBe(DEFAULT_TRANSFORM.opacity);
      expect(result.fontSize).toBe(DEFAULT_TRANSFORM.fontSize);
    });
  });

  describe('text resolution', () => {
    it('uses sprite default text when no keyframe overrides', () => {
      const sprite = makeSprite({
        text: 'default',
        keyframes: [{ t: 0, x: 5 }, { t: 1000, x: 10 }],
      });
      expect(sampleSprite(sprite, 500).text).toBe('default');
    });

    it('uses keyframe text override at the right time', () => {
      const sprite = makeSprite({
        text: 'A',
        keyframes: [
          { t: 0, x: 0 },
          { t: 500, x: 5, text: 'B' },
          { t: 1000, x: 10, text: 'C' },
        ],
      });
      expect(sampleSprite(sprite, 0).text).toBe('A');
      expect(sampleSprite(sprite, 250).text).toBe('A');
      expect(sampleSprite(sprite, 500).text).toBe('B');
      expect(sampleSprite(sprite, 750).text).toBe('B');
      expect(sampleSprite(sprite, 1000).text).toBe('C');
    });
  });

  describe('clamping behavior', () => {
    it('returns first keyframe values for t before first keyframe', () => {
      const sprite = makeSprite({
        keyframes: [
          { t: 100, x: 10 },
          { t: 200, x: 20 },
        ],
      });
      const result = sampleSprite(sprite, 0);
      expect(result.x).toBe(10);
    });

    it('returns last keyframe values for t after last keyframe', () => {
      const sprite = makeSprite({
        keyframes: [
          { t: 100, x: 10 },
          { t: 200, x: 20 },
        ],
      });
      const result = sampleSprite(sprite, 1000);
      expect(result.x).toBe(20);
    });
  });

  describe('binary search correctness with many keyframes', () => {
    it('correctly samples across 100 evenly spaced keyframes', () => {
      const keyframes = Array.from({ length: 100 }, (_, i) => ({
        t: i * 100,
        x: i,
      }));
      const sprite = makeSprite({ keyframes });

      // Sample at each segment midpoint
      for (let i = 0; i < 99; i++) {
        const t = i * 100 + 50;
        const result = sampleSprite(sprite, t);
        expect(result.x).toBeCloseTo(i + 0.5, 6);
      }
    });
  });
});

describe('sampleScene', () => {
  it('returns sampled sprites for all visible sprites', () => {
    const scene: Scene = {
      version: 1,
      duration: 1000,
      sprites: [
        { id: 'a', text: 'A', keyframes: [{ t: 0, x: 0 }] },
        { id: 'b', text: 'B', keyframes: [{ t: 0, x: 10 }] },
      ],
    };
    const result = sampleScene(scene, 0);
    expect(result).toHaveLength(2);
    expect(result[0]!.id).toBe('a');
    expect(result[1]!.id).toBe('b');
  });

  it('excludes hidden sprites', () => {
    const scene: Scene = {
      version: 1,
      duration: 1000,
      sprites: [
        { id: 'visible', text: 'V', keyframes: [{ t: 0, x: 0 }] },
        { id: 'hidden', text: 'H', keyframes: [{ t: 0, x: 10 }], hidden: true },
      ],
    };
    const result = sampleScene(scene, 0);
    expect(result).toHaveLength(1);
    expect(result[0]!.id).toBe('visible');
  });

  it('returns empty array for scene with no sprites', () => {
    const scene: Scene = { version: 1, duration: 1000, sprites: [] };
    expect(sampleScene(scene, 0)).toEqual([]);
  });
});
