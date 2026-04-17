import { describe, it, expect } from 'vitest';
import { migrate } from '../src/migrate';

describe('migrate', () => {
  it('passes through a v1 scene unchanged', () => {
    const scene = { version: 1, duration: 1000, sprites: [] };
    const result = migrate(scene);
    expect(result).toBe(scene); // same reference, not cloned
  });

  it('throws on null input', () => {
    expect(() => migrate(null)).toThrow('not an object');
  });

  it('throws on undefined input', () => {
    expect(() => migrate(undefined)).toThrow('not an object');
  });

  it('throws on array input', () => {
    expect(() => migrate([])).toThrow('not an object');
  });

  it('throws on string input', () => {
    expect(() => migrate('scene')).toThrow('not an object');
  });

  it('throws on missing version (version 0)', () => {
    expect(() => migrate({ duration: 1000, sprites: [] })).toThrow('missing or invalid version');
  });

  it('throws on non-number version (treated as 0)', () => {
    expect(() => migrate({ version: '1', duration: 1000, sprites: [] })).toThrow(
      'missing or invalid version',
    );
  });

  it('throws on future version', () => {
    expect(() => migrate({ version: 99, duration: 1000, sprites: [] })).toThrow(
      'newer than supported',
    );
  });

  it('throws on version 2 (no migration exists yet)', () => {
    expect(() => migrate({ version: 2, duration: 1000, sprites: [] })).toThrow(
      'newer than supported',
    );
  });
});
