import { describe, it, expect } from 'vitest';
import {
  isColorToken,
  parseHexToRgb,
  lerpRgb,
  interpolateColor,
} from '../src/color';
import type { ColorResolver, ColorToken } from '../src/types';

describe('isColorToken', () => {
  it('returns true for all 7 named tokens', () => {
    const tokens: ColorToken[] = [
      'primary', 'secondary', 'tertiary', 'info', 'success', 'warning', 'danger',
    ];
    for (const t of tokens) {
      expect(isColorToken(t)).toBe(true);
    }
  });

  it('returns false for hex strings', () => {
    expect(isColorToken('#ff0000')).toBe(false);
    expect(isColorToken('#abc')).toBe(false);
  });

  it('returns false for arbitrary strings', () => {
    expect(isColorToken('red')).toBe(false);
    expect(isColorToken('rgb(1,2,3)')).toBe(false);
    expect(isColorToken('')).toBe(false);
  });
});

describe('rgb() string interpolation', () => {
  it('interpolates between rgb() strings', () => {
    const result = interpolateColor('rgb(0, 0, 0)', 'rgb(255, 255, 255)', 0.5);
    expect(result).toBe('rgb(128,128,128)');
  });

  it('returns a when rgb string is invalid', () => {
    expect(interpolateColor('notacolor', '#ff0000', 0.5)).toBe('#ff0000');
  });

  it('step-functions between unresolvable strings', () => {
    expect(interpolateColor('notacolor', 'alsonotacolor', 0.3)).toBe('notacolor');
    expect(interpolateColor('notacolor', 'alsonotacolor', 0.7)).toBe('alsonotacolor');
  });
});

describe('parseHexToRgb', () => {
  it('parses 3-digit hex', () => {
    expect(parseHexToRgb('#f00')).toEqual([255, 0, 0]);
    expect(parseHexToRgb('#abc')).toEqual([170, 187, 204]);
  });

  it('parses 6-digit hex', () => {
    expect(parseHexToRgb('#ff0000')).toEqual([255, 0, 0]);
    expect(parseHexToRgb('#00ff00')).toEqual([0, 255, 0]);
    expect(parseHexToRgb('#0000ff')).toEqual([0, 0, 255]);
  });

  it('parses 8-digit hex (ignores alpha)', () => {
    expect(parseHexToRgb('#ff000080')).toEqual([255, 0, 0]);
  });

  it('returns null for invalid input', () => {
    expect(parseHexToRgb('ff0000')).toBeNull();  // no #
    expect(parseHexToRgb('#fg')).toBeNull();      // too short
    expect(parseHexToRgb('#12345')).toBeNull();   // wrong length
    expect(parseHexToRgb('#gggggg')).toBeNull();  // invalid chars
    expect(parseHexToRgb('')).toBeNull();
  });
});

describe('lerpRgb', () => {
  it('returns a at t=0', () => {
    expect(lerpRgb([255, 0, 0], [0, 255, 0], 0)).toBe('rgb(255,0,0)');
  });

  it('returns b at t=1', () => {
    expect(lerpRgb([255, 0, 0], [0, 255, 0], 1)).toBe('rgb(0,255,0)');
  });

  it('returns midpoint at t=0.5', () => {
    expect(lerpRgb([0, 0, 0], [100, 200, 50], 0.5)).toBe('rgb(50,100,25)');
  });

  it('rounds to integers', () => {
    expect(lerpRgb([0, 0, 0], [1, 1, 1], 0.5)).toBe('rgb(1,1,1)');
  });
});

describe('interpolateColor', () => {
  it('returns the color unchanged when both are identical', () => {
    expect(interpolateColor('#ff0000', '#ff0000', 0.5)).toBe('#ff0000');
    expect(interpolateColor('primary', 'primary', 0.5)).toBe('primary');
  });

  it('lerps between two hex colors through RGB', () => {
    const result = interpolateColor('#000000', '#ffffff', 0.5);
    expect(result).toBe('rgb(128,128,128)');
  });

  it('lerps hex colors at t=0 and t=1', () => {
    expect(interpolateColor('#ff0000', '#00ff00', 0)).toBe('rgb(255,0,0)');
    expect(interpolateColor('#ff0000', '#00ff00', 1)).toBe('rgb(0,255,0)');
  });

  it('step-functions between tokens without a resolver', () => {
    expect(interpolateColor('primary', 'danger', 0.3)).toBe('primary');
    expect(interpolateColor('primary', 'danger', 0.7)).toBe('danger');
  });

  it('lerps tokens when a resolver is provided', () => {
    const resolver: ColorResolver = {
      resolve(token: ColorToken) {
        if (token === 'primary') return [0, 0, 0];
        if (token === 'danger') return [255, 0, 0];
        return [128, 128, 128];
      },
    };
    const result = interpolateColor('primary', 'danger', 0.5, resolver);
    expect(result).toBe('rgb(128,0,0)');
  });

  it('returns resolvable color when only one side is resolvable', () => {
    expect(interpolateColor('primary', '#ff0000', 0.5)).toBe('#ff0000');
    expect(interpolateColor('#ff0000', 'primary', 0.5)).toBe('#ff0000');
  });
});
