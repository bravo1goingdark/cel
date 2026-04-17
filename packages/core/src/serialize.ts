/**
 * @module serialize
 * Deterministic serialization and deserialization for .aanim scene files.
 * Identical input always produces byte-identical output.
 */

import type { Scene } from './types';
import { SCHEMA_URL } from './types';
import { migrate } from './migrate';
import { validate } from './validate';

/**
 * Serialize a Scene to a deterministic JSON string.
 * Follows the .aanim file format spec (section 5.5):
 * - Alphabetical key ordering
 * - Keyframes sorted by t ascending
 * - Numeric precision: x/y/opacity → 2 decimals, rotation → 1, fontSize/t → integer
 * - Undefined values stripped
 * - 2-space indent, trailing LF newline
 * - $schema field included
 */
export function serialize(scene: Scene): string {
  const clean = sortAndRound(scene);
  return JSON.stringify(clean, null, 2) + '\n';
}

/**
 * Deserialize a JSON string into a validated Scene.
 * Runs migration and validation; throws on invalid input.
 */
export function deserialize(json: string): Scene {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    throw new Error('Invalid JSON: failed to parse');
  }

  const scene = migrate(parsed);
  const result = validate(scene);
  if (!result.valid) {
    const messages = result.errors.map((e) => `${e.path}: ${e.message}`).join('; ');
    throw new Error(`Invalid scene: ${messages}`);
  }

  return scene;
}

/**
 * Deep-clone and normalize a scene for deterministic serialization.
 */
function sortAndRound(scene: Scene): Record<string, unknown> {
  const out: Record<string, unknown> = {};

  out['$schema'] = SCHEMA_URL;
  out['duration'] = scene.duration;
  if (scene.fps !== undefined) out['fps'] = scene.fps;

  if (scene.grid) {
    out['grid'] = sortKeys({ cols: scene.grid.cols, rows: scene.grid.rows });
  }

  if (scene.meta) {
    out['meta'] = sortKeys(stripUndefined(scene.meta as Record<string, unknown>));
  }

  out['sprites'] = scene.sprites.map((sprite) => {
    const s: Record<string, unknown> = {};
    if (sprite.hidden) s['hidden'] = true;
    s['id'] = sprite.id;
    s['keyframes'] = [...sprite.keyframes]
      .sort((a, b) => a.t - b.t)
      .map((kf) => roundKeyframe(kf as unknown as Record<string, unknown>));
    s['text'] = sprite.text;
    return s;
  });

  out['version'] = scene.version;

  return out;
}

/** Round and sort a single keyframe for serialization. */
function roundKeyframe(kf: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  const keys = Object.keys(kf).sort();

  for (const key of keys) {
    const val = kf[key];
    if (val === undefined) continue;

    switch (key) {
      case 't':
      case 'fontSize':
        out[key] = Math.round(val as number);
        break;
      case 'x':
      case 'y':
      case 'opacity':
        out[key] = roundTo(val as number, 2);
        break;
      case 'rotation':
        out[key] = roundTo(val as number, 1);
        break;
      case 'easing':
        out[key] = val;
        break;
      default:
        out[key] = val;
        break;
    }
  }

  return out;
}

/** Round a number to a given number of decimal places. */
function roundTo(value: number, decimals: number): number {
  const factor = 10 ** decimals;
  return Math.round(value * factor) / factor;
}

/** Sort object keys alphabetically. */
function sortKeys(obj: Record<string, unknown>): Record<string, unknown> {
  const sorted: Record<string, unknown> = {};
  for (const key of Object.keys(obj).sort()) {
    sorted[key] = obj[key];
  }
  return sorted;
}

/** Strip undefined values from a shallow object. */
function stripUndefined(obj: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [key, val] of Object.entries(obj)) {
    if (val !== undefined) out[key] = val;
  }
  return out;
}
