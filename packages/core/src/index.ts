/**
 * cel-core — Zero-dependency TypeScript engine for ASCII character-grid animations.
 *
 * @packageDocumentation
 */

// Sampling
export { sampleSprite, sampleScene } from './sample';

// Validation and migration
export { validate } from './validate';
export { migrate } from './migrate';

// Serialization
export { serialize, deserialize } from './serialize';

// Easing
export { evaluateEasing } from './easing';

// Color utilities
export { interpolateColor, isColorToken, parseHexToRgb, lerpRgb } from './color';

// Playback (tree-shakeable)
export { createPlayer } from './player';
export type { Player, RenderTarget } from './player';

// Types and constants
export type {
  Scene,
  Sprite,
  Keyframe,
  Transform,
  SampledSprite,
  Grid,
  SceneMeta,
  Color,
  ColorToken,
  Easing,
  BezierEasing,
  ColorResolver,
  ValidationResult,
  ValidationError,
} from './types';

export {
  CURRENT_VERSION,
  DEFAULT_TRANSFORM,
  DEFAULT_FPS,
  DEFAULT_GRID,
  DEFAULT_CHAR_WIDTH,
  DEFAULT_LINE_HEIGHT,
  SCHEMA_URL,
  COLOR_TOKENS,
} from './types';
