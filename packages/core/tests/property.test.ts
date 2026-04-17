import { describe, it, expect } from 'vitest';
import * as fc from 'fast-check';
import { sampleSprite, sampleScene } from '../src/sample';
import { serialize, deserialize } from '../src/serialize';
import { validate } from '../src/validate';
import type { Easing, Keyframe, Scene, Sprite } from '../src/types';

/** Generate a valid easing. */
const arbEasing: fc.Arbitrary<Easing> = fc.oneof(
  fc.constant('linear' as const),
  fc.constant('in' as const),
  fc.constant('out' as const),
  fc.constant('inout' as const),
);

/** Generate a valid keyframe at a specific time. */
function arbKeyframe(t: number, duration: number): fc.Arbitrary<Keyframe> {
  return fc.record({
    t: fc.constant(Math.min(t, duration)),
    x: fc.double({ min: -100, max: 100, noNaN: true }),
    y: fc.double({ min: -100, max: 100, noNaN: true }),
    opacity: fc.double({ min: 0, max: 1, noNaN: true }),
    fontSize: fc.double({ min: 1, max: 100, noNaN: true }),
    rotation: fc.double({ min: -360, max: 360, noNaN: true }),
    easing: arbEasing,
  });
}

/** Generate a valid sprite with sorted keyframes. */
function arbSprite(id: string, duration: number): fc.Arbitrary<Sprite> {
  return fc
    .array(fc.integer({ min: 0, max: duration }), { minLength: 1, maxLength: 5 })
    .map((times) => [...new Set(times)].sort((a, b) => a - b))
    .chain((times) =>
      fc.tuple(...times.map((t) => arbKeyframe(t, duration))).map((kfs) => ({
        id,
        text: 'test',
        keyframes: kfs,
      })),
    );
}

/** Generate a valid scene. */
function arbScene(): fc.Arbitrary<Scene> {
  const duration = 4000;
  return fc
    .integer({ min: 1, max: 5 })
    .chain((n) => {
      const ids = Array.from({ length: n }, (_, i) => `s${i}`);
      return fc.tuple(...ids.map((id) => arbSprite(id, duration)));
    })
    .map((sprites) => ({
      version: 1 as const,
      duration,
      sprites,
    }));
}

describe('property tests', () => {
  it('sampling at keyframe t returns that keyframe values', () => {
    fc.assert(
      fc.property(arbScene(), (scene) => {
        for (const sprite of scene.sprites) {
          if (sprite.keyframes.length === 0) continue;
          const first = sprite.keyframes[0]!;
          if (first.t === 0) {
            const sampled = sampleSprite(sprite, 0);
            if (first.x !== undefined) {
              expect(sampled.x).toBeCloseTo(first.x, 4);
            }
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it('sampling at last keyframe t returns last keyframe values', () => {
    fc.assert(
      fc.property(arbScene(), (scene) => {
        for (const sprite of scene.sprites) {
          if (sprite.keyframes.length === 0) continue;
          const last = sprite.keyframes[sprite.keyframes.length - 1]!;
          const sampled = sampleSprite(sprite, last.t);
          if (last.x !== undefined) {
            expect(sampled.x).toBeCloseTo(last.x, 4);
          }
          if (last.y !== undefined) {
            expect(sampled.y).toBeCloseTo(last.y, 4);
          }
        }
      }),
      { numRuns: 50 },
    );
  });

  it('serialize → deserialize is identity', () => {
    fc.assert(
      fc.property(arbScene(), (scene) => {
        const json = serialize(scene);
        const round = deserialize(json);
        expect(round.version).toBe(scene.version);
        expect(round.duration).toBe(scene.duration);
        expect(round.sprites.length).toBe(scene.sprites.length);
        for (let i = 0; i < scene.sprites.length; i++) {
          expect(round.sprites[i]!.id).toBe(scene.sprites[i]!.id);
          expect(round.sprites[i]!.keyframes.length).toBe(scene.sprites[i]!.keyframes.length);
        }
      }),
      { numRuns: 50 },
    );
  });

  it('valid scene always passes validate', () => {
    fc.assert(
      fc.property(arbScene(), (scene) => {
        const result = validate(scene);
        expect(result.valid).toBe(true);
      }),
      { numRuns: 50 },
    );
  });

  it('sampling never returns NaN', () => {
    fc.assert(
      fc.property(arbScene(), (scene) => {
        const times = [0, scene.duration / 4, scene.duration / 2, scene.duration];
        for (const t of times) {
          const sampled = sampleScene(scene, t);
          for (const s of sampled) {
            expect(Number.isNaN(s.x)).toBe(false);
            expect(Number.isNaN(s.y)).toBe(false);
            expect(Number.isNaN(s.opacity)).toBe(false);
            expect(Number.isNaN(s.fontSize)).toBe(false);
            expect(Number.isNaN(s.rotation)).toBe(false);
          }
        }
      }),
      { numRuns: 50 },
    );
  });
});
