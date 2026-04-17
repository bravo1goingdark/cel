import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sampleSprite, sampleScene } from '../src/sample';
import { validate } from '../src/validate';
import { deserialize } from '../src/serialize';
import type { Scene } from '../src/types';

const FIXTURES_DIR = join(__dirname, 'fixtures');

function loadFixture(name: string): Scene {
  const json = readFileSync(join(FIXTURES_DIR, name), 'utf-8');
  return deserialize(json);
}

const FIXTURES = ['sleeping.aanim', 'spinner.aanim', 'heartbeat.aanim', 'minimal.aanim', 'edge-cases.aanim'];

describe('golden-file validation', () => {
  it.each(FIXTURES)('%s passes schema validation', (name) => {
    const json = readFileSync(join(FIXTURES_DIR, name), 'utf-8');
    const parsed = JSON.parse(json);
    const result = validate(parsed);
    expect(result.valid).toBe(true);
    expect(result.errors).toEqual([]);
  });
});

describe('golden-file sampling', () => {
  describe('sleeping.aanim', () => {
    const scene = loadFixture('sleeping.aanim');

    it('face sprite at t=0 has correct position', () => {
      const face = scene.sprites.find((s) => s.id === 'face')!;
      const sampled = sampleSprite(face, 0);
      expect(sampled.x).toBeCloseTo(5.5, 6);
      expect(sampled.y).toBeCloseTo(5, 6);
      expect(sampled.opacity).toBeCloseTo(1, 6);
      expect(sampled.fontSize).toBeCloseTo(22, 6);
      expect(sampled.rotation).toBeCloseTo(0, 6);
    });

    it('face sprite at t=1500 has moved down with rotation', () => {
      const face = scene.sprites.find((s) => s.id === 'face')!;
      const sampled = sampleSprite(face, 1500);
      expect(sampled.y).toBeCloseTo(5.6, 6);
      expect(sampled.rotation).toBeCloseTo(-1, 6);
    });

    it('z1 sprite is invisible at t=0', () => {
      const z1 = scene.sprites.find((s) => s.id === 'z1')!;
      const sampled = sampleSprite(z1, 0);
      expect(sampled.opacity).toBeCloseTo(0, 6);
    });

    it('sampleScene returns 4 sprites', () => {
      const sampled = sampleScene(scene, 500);
      expect(sampled).toHaveLength(4);
    });
  });

  describe('spinner.aanim', () => {
    const scene = loadFixture('spinner.aanim');

    it('text changes through the animation', () => {
      const spin = scene.sprites.find((s) => s.id === 'spin')!;
      expect(sampleSprite(spin, 0).text).toBe('|');
      expect(sampleSprite(spin, 200).text).toBe('/');
      expect(sampleSprite(spin, 400).text).toBe('\u2500');
      expect(sampleSprite(spin, 600).text).toBe('\\');
      expect(sampleSprite(spin, 800).text).toBe('|');
    });

    it('position stays constant', () => {
      const spin = scene.sprites.find((s) => s.id === 'spin')!;
      for (let t = 0; t <= 800; t += 100) {
        const sampled = sampleSprite(spin, t);
        expect(sampled.x).toBeCloseTo(12, 6);
        expect(sampled.y).toBeCloseTo(5, 6);
      }
    });
  });

  describe('heartbeat.aanim', () => {
    const scene = loadFixture('heartbeat.aanim');

    it('starts at fontSize 28', () => {
      const heart = scene.sprites.find((s) => s.id === 'heart')!;
      const sampled = sampleSprite(heart, 0);
      expect(sampled.fontSize).toBeCloseTo(28, 6);
    });

    it('peaks at t=100 with fontSize 44', () => {
      const heart = scene.sprites.find((s) => s.id === 'heart')!;
      const sampled = sampleSprite(heart, 100);
      expect(sampled.fontSize).toBeCloseTo(44, 6);
    });
  });

  describe('minimal.aanim', () => {
    const scene = loadFixture('minimal.aanim');

    it('has 1 sprite at position (10, 5)', () => {
      const sampled = sampleScene(scene, 0);
      expect(sampled).toHaveLength(1);
      expect(sampled[0]!.x).toBeCloseTo(10, 6);
      expect(sampled[0]!.y).toBeCloseTo(5, 6);
      expect(sampled[0]!.text).toBe('.');
    });
  });

  describe('edge-cases.aanim', () => {
    const scene = loadFixture('edge-cases.aanim');

    it('excludes hidden sprite from sampleScene', () => {
      const sampled = sampleScene(scene, 0);
      expect(sampled).toHaveLength(2);
      expect(sampled.every((s) => s.id !== 'hidden-sprite')).toBe(true);
    });

    it('texter sprite changes text at keyframe boundaries', () => {
      const texter = scene.sprites.find((s) => s.id === 'texter')!;
      expect(sampleSprite(texter, 0).text).toBe('frame-0');
      expect(sampleSprite(texter, 500).text).toBe('frame-0');
      expect(sampleSprite(texter, 1000).text).toBe('frame-1');
      expect(sampleSprite(texter, 2500).text).toBe('frame-2');
      expect(sampleSprite(texter, 5000).text).toBe('frame-5');
    });

    it('mover sprite interpolates smoothly across 15 keyframes', () => {
      const mover = scene.sprites.find((s) => s.id === 'mover')!;
      // At t=0: x=0
      expect(sampleSprite(mover, 0).x).toBeCloseTo(0, 6);
      // At t=5000: x=0 (returns to start)
      expect(sampleSprite(mover, 5000).x).toBeCloseTo(0, 6);
      // At t=2000: x=40 (midpoint peak)
      expect(sampleSprite(mover, 2000).x).toBeCloseTo(40, 6);
    });
  });
});
