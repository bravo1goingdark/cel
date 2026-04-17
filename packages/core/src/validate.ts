/**
 * @module validate
 * Schema validation for scene objects. Returns all errors, not just the first.
 * Every error includes a JSON pointer path and a stable error code.
 */

import type { ValidationError, ValidationResult } from './types';
import { CURRENT_VERSION } from './types';

const SPRITE_ID_RE = /^[a-zA-Z0-9_-]+$/;
const NAMED_EASINGS = new Set(['linear', 'in', 'out', 'inout']);

/** Validate an unknown input as a Scene. */
export function validate(input: unknown): ValidationResult {
  const errors: ValidationError[] = [];

  if (input === null || input === undefined || typeof input !== 'object' || Array.isArray(input)) {
    errors.push({ path: '', message: 'Scene must be a non-null object', code: 'SCHEMA_INVALID' });
    return { valid: false, errors };
  }

  const obj = input as Record<string, unknown>;

  // version
  if (!('version' in obj) || typeof obj['version'] !== 'number') {
    errors.push({ path: '/version', message: 'version must be a number', code: 'SCHEMA_INVALID' });
  } else if (!Number.isInteger(obj['version']) || obj['version'] < 1) {
    errors.push({ path: '/version', message: 'version must be a positive integer', code: 'SCHEMA_INVALID' });
  } else if (obj['version'] > CURRENT_VERSION) {
    errors.push({
      path: '/version',
      message: `Scene version ${obj['version']} is newer than supported ${CURRENT_VERSION}. Update the app.`,
      code: 'SCHEMA_VERSION_UNSUPPORTED',
    });
  }

  // duration
  if (!('duration' in obj) || typeof obj['duration'] !== 'number') {
    errors.push({ path: '/duration', message: 'duration must be a number', code: 'SCHEMA_INVALID' });
  } else if (!Number.isInteger(obj['duration']) || obj['duration'] <= 0) {
    errors.push({ path: '/duration', message: 'duration must be a positive integer', code: 'DURATION_INVALID' });
  }

  const duration = typeof obj['duration'] === 'number' && Number.isInteger(obj['duration']) ? obj['duration'] : null;

  // fps (optional)
  if ('fps' in obj && obj['fps'] !== undefined) {
    if (typeof obj['fps'] !== 'number') {
      errors.push({ path: '/fps', message: 'fps must be a number', code: 'SCHEMA_INVALID' });
    } else if (!Number.isInteger(obj['fps']) || obj['fps'] < 1 || obj['fps'] > 120) {
      errors.push({ path: '/fps', message: 'fps must be an integer in [1, 120]', code: 'FPS_OUT_OF_RANGE' });
    }
  }

  // grid (optional)
  if ('grid' in obj && obj['grid'] !== undefined) {
    validateGrid(obj['grid'], errors);
  }

  // sprites
  if (!('sprites' in obj) || !Array.isArray(obj['sprites'])) {
    errors.push({ path: '/sprites', message: 'sprites must be an array', code: 'SCHEMA_INVALID' });
  } else {
    validateSprites(obj['sprites'], duration, errors);
  }

  return { valid: errors.length === 0, errors };
}

function validateGrid(grid: unknown, errors: ValidationError[]): void {
  if (grid === null || typeof grid !== 'object' || Array.isArray(grid)) {
    errors.push({ path: '/grid', message: 'grid must be an object', code: 'SCHEMA_INVALID' });
    return;
  }
  const g = grid as Record<string, unknown>;

  if (typeof g['cols'] !== 'number' || !Number.isInteger(g['cols']) || g['cols'] <= 0) {
    errors.push({ path: '/grid/cols', message: 'grid.cols must be a positive integer', code: 'GRID_INVALID' });
  }
  if (typeof g['rows'] !== 'number' || !Number.isInteger(g['rows']) || g['rows'] <= 0) {
    errors.push({ path: '/grid/rows', message: 'grid.rows must be a positive integer', code: 'GRID_INVALID' });
  }
}

function validateSprites(
  sprites: unknown[],
  duration: number | null,
  errors: ValidationError[],
): void {
  const seenIds = new Set<string>();

  for (let si = 0; si < sprites.length; si++) {
    const sprite = sprites[si];
    const sp = `/sprites/${si}`;

    if (sprite === null || typeof sprite !== 'object' || Array.isArray(sprite)) {
      errors.push({ path: sp, message: 'sprite must be an object', code: 'SCHEMA_INVALID' });
      continue;
    }

    const s = sprite as Record<string, unknown>;

    // id
    if (typeof s['id'] !== 'string') {
      errors.push({ path: `${sp}/id`, message: 'sprite.id must be a string', code: 'SCHEMA_INVALID' });
    } else if (!SPRITE_ID_RE.test(s['id'])) {
      errors.push({
        path: `${sp}/id`,
        message: `sprite.id "${s['id']}" contains invalid characters (must match /^[a-zA-Z0-9_-]+$/)`,
        code: 'SPRITE_ID_INVALID',
      });
    } else if (seenIds.has(s['id'])) {
      errors.push({ path: `${sp}/id`, message: `duplicate sprite id "${s['id']}"`, code: 'SPRITE_DUPLICATE_ID' });
    } else {
      seenIds.add(s['id']);
    }

    // text
    if (typeof s['text'] !== 'string') {
      errors.push({ path: `${sp}/text`, message: 'sprite.text must be a string', code: 'SCHEMA_INVALID' });
    }

    // keyframes
    if (!Array.isArray(s['keyframes'])) {
      errors.push({ path: `${sp}/keyframes`, message: 'sprite.keyframes must be an array', code: 'SCHEMA_INVALID' });
    } else {
      validateKeyframes(s['keyframes'], duration, sp, errors);
    }
  }
}

function validateKeyframes(
  keyframes: unknown[],
  duration: number | null,
  spritePath: string,
  errors: ValidationError[],
): void {
  const seenTimes = new Set<number>();

  for (let ki = 0; ki < keyframes.length; ki++) {
    const kf = keyframes[ki];
    const kp = `${spritePath}/keyframes/${ki}`;

    if (kf === null || typeof kf !== 'object' || Array.isArray(kf)) {
      errors.push({ path: kp, message: 'keyframe must be an object', code: 'SCHEMA_INVALID' });
      continue;
    }

    const k = kf as Record<string, unknown>;

    // t (required)
    if (typeof k['t'] !== 'number') {
      errors.push({ path: `${kp}/t`, message: 'keyframe.t must be a number', code: 'SCHEMA_INVALID' });
    } else if (!Number.isInteger(k['t'])) {
      errors.push({ path: `${kp}/t`, message: 'keyframe.t must be an integer', code: 'SCHEMA_INVALID' });
    } else {
      if (k['t'] < 0) {
        errors.push({ path: `${kp}/t`, message: 'keyframe.t must be >= 0', code: 'SCHEMA_INVALID' });
      }
      if (duration !== null && k['t'] > duration) {
        errors.push({
          path: `${kp}/t`,
          message: `keyframe.t (${k['t']}) exceeds scene duration (${duration})`,
          code: 'SCHEMA_INVALID',
        });
      }
      if (seenTimes.has(k['t'])) {
        errors.push({
          path: `${kp}/t`,
          message: `duplicate keyframe time ${k['t']}`,
          code: 'KEYFRAME_DUPLICATE_TIME',
        });
      } else {
        seenTimes.add(k['t']);
      }
    }

    // numeric properties
    validateFiniteNumber(k, 'x', kp, errors);
    validateFiniteNumber(k, 'y', kp, errors);
    validateFiniteNumber(k, 'rotation', kp, errors);

    // opacity [0, 1]
    if ('opacity' in k && k['opacity'] !== undefined) {
      if (typeof k['opacity'] !== 'number' || !Number.isFinite(k['opacity'])) {
        errors.push({ path: `${kp}/opacity`, message: 'opacity must be a finite number', code: 'SCHEMA_INVALID' });
      } else if (k['opacity'] < 0 || k['opacity'] > 1) {
        errors.push({ path: `${kp}/opacity`, message: 'opacity must be in [0, 1]', code: 'OPACITY_OUT_OF_RANGE' });
      }
    }

    // fontSize (positive)
    if ('fontSize' in k && k['fontSize'] !== undefined) {
      if (typeof k['fontSize'] !== 'number' || !Number.isFinite(k['fontSize'])) {
        errors.push({ path: `${kp}/fontSize`, message: 'fontSize must be a finite number', code: 'SCHEMA_INVALID' });
      } else if (k['fontSize'] <= 0) {
        errors.push({ path: `${kp}/fontSize`, message: 'fontSize must be positive', code: 'FONT_SIZE_INVALID' });
      }
    }

    // color (optional string)
    if ('color' in k && k['color'] !== undefined) {
      if (typeof k['color'] !== 'string') {
        errors.push({ path: `${kp}/color`, message: 'color must be a string', code: 'SCHEMA_INVALID' });
      }
    }

    // text (optional string)
    if ('text' in k && k['text'] !== undefined) {
      if (typeof k['text'] !== 'string') {
        errors.push({ path: `${kp}/text`, message: 'keyframe.text must be a string', code: 'SCHEMA_INVALID' });
      }
    }

    // easing (optional)
    if ('easing' in k && k['easing'] !== undefined) {
      validateEasing(k['easing'], `${kp}/easing`, errors);
    }
  }
}

function validateFiniteNumber(
  obj: Record<string, unknown>,
  prop: string,
  basePath: string,
  errors: ValidationError[],
): void {
  if (prop in obj && obj[prop] !== undefined) {
    if (typeof obj[prop] !== 'number' || !Number.isFinite(obj[prop])) {
      errors.push({
        path: `${basePath}/${prop}`,
        message: `${prop} must be a finite number`,
        code: 'SCHEMA_INVALID',
      });
    }
  }
}

function validateEasing(easing: unknown, path: string, errors: ValidationError[]): void {
  if (typeof easing === 'string') {
    if (!NAMED_EASINGS.has(easing)) {
      errors.push({ path, message: `unknown easing "${easing}"`, code: 'EASING_INVALID' });
    }
    return;
  }

  if (easing !== null && typeof easing === 'object' && !Array.isArray(easing)) {
    const e = easing as Record<string, unknown>;
    if (!Array.isArray(e['cubic']) || e['cubic'].length !== 4) {
      errors.push({ path, message: 'bezier easing must have cubic: [x1, y1, x2, y2]', code: 'EASING_INVALID' });
      return;
    }
    for (let i = 0; i < 4; i++) {
      const v = e['cubic'][i];
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 1) {
        errors.push({
          path: `${path}/cubic/${i}`,
          message: `bezier control point ${i} must be a number in [0, 1]`,
          code: 'EASING_INVALID',
        });
      }
    }
    return;
  }

  errors.push({ path, message: 'easing must be a string or bezier object', code: 'EASING_INVALID' });
}
