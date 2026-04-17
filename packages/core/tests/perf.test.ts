import { describe, it, expect } from 'vitest';
import { sampleScene } from '../src/sample';
import type { Keyframe, Scene, Sprite } from '../src/types';

function generateLargeScene(): Scene {
  const sprites: Sprite[] = [];

  for (let si = 0; si < 100; si++) {
    const keyframes: Keyframe[] = [];
    for (let ki = 0; ki < 10; ki++) {
      keyframes.push({
        t: ki * 1000,
        x: Math.random() * 60,
        y: Math.random() * 13,
        opacity: Math.random(),
        fontSize: 10 + Math.random() * 20,
        rotation: Math.random() * 360,
        color: '#' + Math.floor(Math.random() * 0xffffff).toString(16).padStart(6, '0'),
      });
    }
    sprites.push({
      id: `sprite_${si}`,
      text: `S${si}`,
      keyframes,
    });
  }

  return {
    version: 1,
    duration: 9000,
    sprites,
  };
}

describe('performance benchmark', () => {
  it('samples 100 sprites x 10 keyframes in under 1ms average', () => {
    const scene = generateLargeScene();
    const iterations = 1000;

    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const t = (i / iterations) * scene.duration;
      sampleScene(scene, t);
    }
    const elapsed = performance.now() - start;
    const average = elapsed / iterations;

    // Should be well under 1ms per sampleScene call
    expect(average).toBeLessThan(1);

    // Log for reference
    console.log(
      `Performance: ${iterations} sampleScene calls in ${elapsed.toFixed(1)}ms ` +
      `(${average.toFixed(3)}ms avg, ${(elapsed / iterations * 1000).toFixed(0)}µs per call)`,
    );
  });

  it('sampling does not degrade with many keyframes per sprite', () => {
    // Single sprite with 100 keyframes
    const keyframes: Keyframe[] = [];
    for (let i = 0; i < 100; i++) {
      keyframes.push({
        t: i * 100,
        x: i,
        y: i * 0.5,
        opacity: 1,
        fontSize: 18,
        rotation: i * 3.6,
      });
    }

    const scene: Scene = {
      version: 1,
      duration: 9900,
      sprites: [{ id: 'many_kf', text: 'x', keyframes }],
    };

    const iterations = 10000;
    const start = performance.now();
    for (let i = 0; i < iterations; i++) {
      const t = (i / iterations) * scene.duration;
      sampleScene(scene, t);
    }
    const elapsed = performance.now() - start;
    const average = elapsed / iterations;

    // Binary search keeps this well under budget
    expect(average).toBeLessThan(0.1);
  });
});
