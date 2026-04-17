import { describe, it, expect } from 'vitest';
import { validate } from '../src/validate';
import type { Scene } from '../src/types';

function validScene(): Scene {
  return {
    version: 1,
    duration: 4000,
    fps: 60,
    grid: { cols: 60, rows: 13 },
    sprites: [
      {
        id: 'face',
        text: '( -_- )',
        keyframes: [
          { t: 0, x: 5, y: 5, opacity: 1, fontSize: 22, rotation: 0, color: 'secondary' },
          { t: 2000, x: 5, y: 6, opacity: 1, fontSize: 22, rotation: 0, color: 'secondary' },
        ],
      },
    ],
  };
}

describe('validate', () => {
  describe('valid scenes', () => {
    it('accepts a complete valid scene', () => {
      const result = validate(validScene());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
    });

    it('accepts a minimal valid scene', () => {
      const result = validate({ version: 1, duration: 1000, sprites: [] });
      expect(result.valid).toBe(true);
    });

    it('accepts scene without optional fields', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{ id: 'a', text: '', keyframes: [] }],
      });
      expect(result.valid).toBe(true);
    });
  });

  describe('top-level errors', () => {
    it('rejects null', () => {
      const result = validate(null);
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('SCHEMA_INVALID');
    });

    it('rejects arrays', () => {
      const result = validate([]);
      expect(result.valid).toBe(false);
    });

    it('rejects non-objects', () => {
      expect(validate('string').valid).toBe(false);
      expect(validate(42).valid).toBe(false);
    });
  });

  describe('version validation', () => {
    it('rejects missing version', () => {
      const result = validate({ duration: 1000, sprites: [] });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path === '/version')).toBe(true);
    });

    it('rejects non-number version', () => {
      const result = validate({ version: '1', duration: 1000, sprites: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects version 0', () => {
      const result = validate({ version: 0, duration: 1000, sprites: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects future version', () => {
      const result = validate({ version: 99, duration: 1000, sprites: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('SCHEMA_VERSION_UNSUPPORTED');
    });
  });

  describe('duration validation', () => {
    it('rejects missing duration', () => {
      const result = validate({ version: 1, sprites: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects zero duration', () => {
      const result = validate({ version: 1, duration: 0, sprites: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('DURATION_INVALID');
    });

    it('rejects negative duration', () => {
      const result = validate({ version: 1, duration: -100, sprites: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects float duration', () => {
      const result = validate({ version: 1, duration: 1.5, sprites: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects NaN duration', () => {
      const result = validate({ version: 1, duration: NaN, sprites: [] });
      expect(result.valid).toBe(false);
    });
  });

  describe('fps validation', () => {
    it('rejects fps = 0', () => {
      const result = validate({ version: 1, duration: 1000, fps: 0, sprites: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('FPS_OUT_OF_RANGE');
    });

    it('rejects fps > 120', () => {
      const result = validate({ version: 1, duration: 1000, fps: 121, sprites: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects float fps', () => {
      const result = validate({ version: 1, duration: 1000, fps: 29.97, sprites: [] });
      expect(result.valid).toBe(false);
    });

    it('rejects non-number fps', () => {
      const result = validate({ version: 1, duration: 1000, fps: 'sixty', sprites: [] });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.path).toBe('/fps');
    });

    it('accepts fps = 1', () => {
      const result = validate({ version: 1, duration: 1000, fps: 1, sprites: [] });
      expect(result.valid).toBe(true);
    });

    it('accepts fps = 120', () => {
      const result = validate({ version: 1, duration: 1000, fps: 120, sprites: [] });
      expect(result.valid).toBe(true);
    });
  });

  describe('grid validation', () => {
    it('rejects zero cols', () => {
      const result = validate({
        version: 1, duration: 1000, grid: { cols: 0, rows: 10 }, sprites: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('GRID_INVALID');
    });

    it('rejects non-object grid', () => {
      const result = validate({
        version: 1, duration: 1000, grid: 'not an object', sprites: [],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('SCHEMA_INVALID');
    });

    it('rejects array grid', () => {
      const result = validate({
        version: 1, duration: 1000, grid: [60, 13], sprites: [],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects negative rows', () => {
      const result = validate({
        version: 1, duration: 1000, grid: { cols: 10, rows: -1 }, sprites: [],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('sprite validation', () => {
    it('rejects duplicate sprite IDs', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [
          { id: 'dup', text: 'a', keyframes: [] },
          { id: 'dup', text: 'b', keyframes: [] },
        ],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'SPRITE_DUPLICATE_ID')).toBe(true);
    });

    it('rejects invalid sprite ID characters', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{ id: 'has spaces', text: '', keyframes: [] }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('SPRITE_ID_INVALID');
    });

    it('accepts valid sprite ID patterns', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [
          { id: 'abc-123_XYZ', text: '', keyframes: [] },
        ],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects non-string text', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{ id: 'a', text: 123, keyframes: [] }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects non-object sprite (null)', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [null],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('SCHEMA_INVALID');
    });

    it('rejects array as sprite', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [[]],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects non-string sprite id', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{ id: 123, text: '', keyframes: [] }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects non-array keyframes', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{ id: 'a', text: '', keyframes: 'not array' }],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('keyframe structural validation', () => {
    it('rejects non-object keyframe', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [42],
        }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects null keyframe', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [null],
        }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects non-number t', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 'zero' }],
        }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects float t', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 1.5 }],
        }],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('keyframe validation', () => {
    it('rejects duplicate keyframe times', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [
            { t: 500, x: 0 },
            { t: 500, x: 10 },
          ],
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.code === 'KEYFRAME_DUPLICATE_TIME')).toBe(true);
    });

    it('rejects keyframe t exceeding duration', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 2000, x: 0 }],
        }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects negative keyframe t', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: -1 }],
        }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects opacity out of range', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, opacity: 1.5 }],
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('OPACITY_OUT_OF_RANGE');
    });

    it('rejects negative opacity', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, opacity: -0.1 }],
        }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects zero fontSize', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, fontSize: 0 }],
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('FONT_SIZE_INVALID');
    });

    it('rejects NaN numeric properties', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, x: NaN }],
        }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects Infinity', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, y: Infinity }],
        }],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('easing validation', () => {
    it('accepts valid named easings', () => {
      for (const easing of ['linear', 'in', 'out', 'inout']) {
        const result = validate({
          version: 1,
          duration: 1000,
          sprites: [{
            id: 'a', text: '', keyframes: [{ t: 0, easing }],
          }],
        });
        expect(result.valid).toBe(true);
      }
    });

    it('rejects unknown easing name', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, easing: 'bounce' }],
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('EASING_INVALID');
    });

    it('accepts valid bezier easing', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [
            { t: 0, easing: { cubic: [0.42, 0, 0.58, 1] } },
          ],
        }],
      });
      expect(result.valid).toBe(true);
    });

    it('rejects bezier with out-of-range control points', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [
            { t: 0, easing: { cubic: [0.42, 0, 1.5, 1] } },
          ],
        }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects bezier with wrong number of points', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [
            { t: 0, easing: { cubic: [0.42, 0] } },
          ],
        }],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('keyframe color/text type validation', () => {
    it('rejects non-string color', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, color: 123 }],
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('color'))).toBe(true);
    });

    it('rejects non-string keyframe text', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, text: 42 }],
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.path.includes('text'))).toBe(true);
    });

    it('rejects non-string/non-object easing (number)', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, easing: 42 }],
        }],
      });
      expect(result.valid).toBe(false);
      expect(result.errors[0]!.code).toBe('EASING_INVALID');
    });

    it('rejects non-finite fontSize', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, fontSize: Infinity }],
        }],
      });
      expect(result.valid).toBe(false);
    });

    it('rejects non-finite opacity', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a', text: '', keyframes: [{ t: 0, opacity: NaN }],
        }],
      });
      expect(result.valid).toBe(false);
    });
  });

  describe('multiple errors', () => {
    it('returns all errors, not just the first', () => {
      const result = validate({
        version: 99,
        duration: -1,
        fps: 0,
        sprites: 'not an array',
      });
      expect(result.valid).toBe(false);
      expect(result.errors.length).toBeGreaterThanOrEqual(3);
    });
  });

  describe('JSON pointer paths', () => {
    it('includes correct paths for nested errors', () => {
      const result = validate({
        version: 1,
        duration: 1000,
        sprites: [{
          id: 'a',
          text: '',
          keyframes: [
            { t: 0 },
            { t: 500, opacity: 2 },
          ],
        }],
      });
      expect(result.valid).toBe(false);
      const opacityError = result.errors.find((e) => e.code === 'OPACITY_OUT_OF_RANGE');
      expect(opacityError!.path).toBe('/sprites/0/keyframes/1/opacity');
    });
  });
});
