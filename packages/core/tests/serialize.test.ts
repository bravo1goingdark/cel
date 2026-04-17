import { describe, it, expect } from 'vitest';
import { serialize, deserialize } from '../src/serialize';
import type { Scene } from '../src/types';
import { SCHEMA_URL } from '../src/types';

function minimalScene(): Scene {
  return {
    version: 1,
    duration: 1000,
    sprites: [],
  };
}

function fullScene(): Scene {
  return {
    version: 1,
    duration: 4000,
    fps: 60,
    grid: { cols: 60, rows: 13 },
    meta: { title: 'Test', author: 'test', created: '2026-01-01T00:00:00Z' },
    sprites: [
      {
        id: 'face',
        text: '( -_- )',
        keyframes: [
          { t: 0, x: 5.5, y: 5.0, opacity: 1, fontSize: 22, rotation: 0, color: 'secondary', easing: 'inout' },
          { t: 2000, x: 5.5, y: 5.6, opacity: 1, fontSize: 22, rotation: -1, color: 'secondary', easing: 'inout' },
        ],
      },
    ],
  };
}

describe('serialize', () => {
  it('includes $schema field', () => {
    const json = serialize(minimalScene());
    const parsed = JSON.parse(json);
    expect(parsed['$schema']).toBe(SCHEMA_URL);
  });

  it('ends with a trailing newline', () => {
    const json = serialize(minimalScene());
    expect(json.endsWith('\n')).toBe(true);
  });

  it('uses 2-space indentation', () => {
    const json = serialize(minimalScene());
    const lines = json.split('\n');
    // The second line should have 2-space indent
    expect(lines[1]).toMatch(/^ {2}/);
  });

  it('sorts object keys alphabetically', () => {
    const json = serialize(fullScene());
    const parsed = JSON.parse(json);
    const keys = Object.keys(parsed);
    expect(keys).toEqual([...keys].sort());
  });

  it('sorts keyframe keys alphabetically', () => {
    const json = serialize(fullScene());
    const parsed = JSON.parse(json);
    const kfKeys = Object.keys(parsed.sprites[0].keyframes[0]);
    expect(kfKeys).toEqual([...kfKeys].sort());
  });

  it('sorts keyframes by t ascending', () => {
    const scene = fullScene();
    // Deliberately reverse the keyframes
    scene.sprites[0]!.keyframes.reverse();
    const json = serialize(scene);
    const parsed = JSON.parse(json);
    const times = parsed.sprites[0].keyframes.map((kf: { t: number }) => kf.t);
    expect(times).toEqual([...times].sort((a: number, b: number) => a - b));
  });

  it('rounds x, y, opacity to 2 decimal places', () => {
    const scene: Scene = {
      version: 1,
      duration: 1000,
      sprites: [{
        id: 'a',
        text: '',
        keyframes: [{ t: 0, x: 5.555, y: 3.1415, opacity: 0.333 }],
      }],
    };
    const json = serialize(scene);
    const parsed = JSON.parse(json);
    const kf = parsed.sprites[0].keyframes[0];
    expect(kf.x).toBe(5.56);
    expect(kf.y).toBe(3.14);
    expect(kf.opacity).toBe(0.33);
  });

  it('rounds rotation to 1 decimal place', () => {
    const scene: Scene = {
      version: 1,
      duration: 1000,
      sprites: [{
        id: 'a',
        text: '',
        keyframes: [{ t: 0, rotation: 45.678 }],
      }],
    };
    const json = serialize(scene);
    const parsed = JSON.parse(json);
    expect(parsed.sprites[0].keyframes[0].rotation).toBe(45.7);
  });

  it('rounds fontSize and t to integers', () => {
    const scene: Scene = {
      version: 1,
      duration: 1000,
      sprites: [{
        id: 'a',
        text: '',
        keyframes: [{ t: 100.7, fontSize: 18.4 }],
      }],
    };
    const json = serialize(scene);
    const parsed = JSON.parse(json);
    expect(parsed.sprites[0].keyframes[0].t).toBe(101);
    expect(parsed.sprites[0].keyframes[0].fontSize).toBe(18);
  });

  it('strips undefined values', () => {
    const scene: Scene = {
      version: 1,
      duration: 1000,
      sprites: [{
        id: 'a',
        text: '',
        keyframes: [{ t: 0, x: 5 }],
      }],
    };
    const json = serialize(scene);
    const parsed = JSON.parse(json);
    const kf = parsed.sprites[0].keyframes[0];
    expect('y' in kf).toBe(false);
    expect('opacity' in kf).toBe(false);
  });

  it('produces identical output for identical input (deterministic)', () => {
    const a = serialize(fullScene());
    const b = serialize(fullScene());
    expect(a).toBe(b);
  });

  it('includes hidden flag when true', () => {
    const scene: Scene = {
      version: 1,
      duration: 1000,
      sprites: [{
        id: 'a',
        text: '',
        keyframes: [],
        hidden: true,
      }],
    };
    const json = serialize(scene);
    const parsed = JSON.parse(json);
    expect(parsed.sprites[0].hidden).toBe(true);
  });
});

describe('deserialize', () => {
  it('round-trips a valid scene', () => {
    const scene = fullScene();
    const json = serialize(scene);
    const result = deserialize(json);
    // After deserialization, $schema is present in the raw parse
    // but migrate/validate may not include it.
    // The core fields should match.
    expect(result.version).toBe(1);
    expect(result.duration).toBe(scene.duration);
    expect(result.sprites.length).toBe(scene.sprites.length);
  });

  it('throws on invalid JSON', () => {
    expect(() => deserialize('not json')).toThrow('Invalid JSON');
  });

  it('throws on invalid scene data', () => {
    expect(() => deserialize('{"version": 99, "duration": 1000, "sprites": []}')).toThrow();
  });

  it('throws on non-object JSON', () => {
    expect(() => deserialize('"string"')).toThrow();
  });

  it('throws with validation details on invalid scene structure', () => {
    const json = JSON.stringify({ version: 1, duration: -1, sprites: [] });
    expect(() => deserialize(json)).toThrow('Invalid scene');
  });
});
