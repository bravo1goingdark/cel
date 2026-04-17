/**
 * @module types
 * All type definitions for the ASCII Anim scene format.
 * This is a CLOSED set — adding a field is a breaking schema change.
 */

/** Schema version. Bump only on breaking changes to the file format. */
export const CURRENT_VERSION = 1;

/**
 * A named color token resolved by the host environment via CSS custom properties.
 */
export type ColorToken =
  | 'primary'
  | 'secondary'
  | 'tertiary'
  | 'info'
  | 'success'
  | 'warning'
  | 'danger';

/** All valid color token strings. */
export const COLOR_TOKENS: readonly ColorToken[] = [
  'primary',
  'secondary',
  'tertiary',
  'info',
  'success',
  'warning',
  'danger',
] as const;

/** A named color token OR any valid CSS color string. */
export type Color = ColorToken | string;

/**
 * Easing function applied to a keyframe segment.
 * The easing on keyframe B governs the segment from A to B.
 */
export type Easing = 'linear' | 'in' | 'out' | 'inout' | BezierEasing;

/** Cubic bezier control points [x1, y1, x2, y2]. */
export interface BezierEasing {
  cubic: [number, number, number, number];
}

/**
 * All animatable properties of a sprite.
 * This is a CLOSED set — adding a field is a breaking schema change.
 */
export interface Transform {
  /** Grid columns, fractional allowed. */
  x: number;
  /** Grid rows, fractional allowed. */
  y: number;
  /** Opacity, 0..1. */
  opacity: number;
  /** Font size in px, must be positive. */
  fontSize: number;
  /** Rotation in degrees, any real number. */
  rotation: number;
  /** Named color token or CSS color string. */
  color: Color;
}

/**
 * A keyframe. Sparse by design — only the properties present are set;
 * the rest inherit from the previous keyframe or defaults.
 */
export interface Keyframe extends Partial<Transform> {
  /** Time in ms, integer, >= 0. */
  t: number;
  /** If present, sprite.text changes at/after this keyframe. */
  text?: string;
  /** Easing applied on the segment ENDING at this keyframe. */
  easing?: Easing;
}

/**
 * A sprite. Has a stable id, default text, and an ordered list of keyframes.
 */
export interface Sprite {
  /** Unique within scene, matches /^[a-zA-Z0-9_-]+$/. */
  id: string;
  /** Default text if no keyframe overrides. */
  text: string;
  /** MUST be sorted by t ascending. */
  keyframes: Keyframe[];
  /** Excluded from rendering if true. */
  hidden?: boolean;
}

/** Canvas logical size in cells. */
export interface Grid {
  /** Positive integer. */
  cols: number;
  /** Positive integer. */
  rows: number;
}

/** Optional metadata. Never affects rendering. */
export interface SceneMeta {
  title?: string;
  author?: string;
  description?: string;
  /** ISO 8601 timestamp. */
  created?: string;
  /** ISO 8601 timestamp. */
  modified?: string;
  tags?: string[];
}

/** A complete scene. */
export interface Scene {
  /** Schema version, currently 1. */
  version: 1;
  /** Duration in ms, positive integer. */
  duration: number;
  /** Frames per second, range 1..120, default 60. */
  fps?: number;
  /** Canvas size, default { cols: 60, rows: 13 }. */
  grid?: Grid;
  /** Ordered list of sprites. */
  sprites: Sprite[];
  /** Optional metadata, never affects rendering. */
  meta?: SceneMeta;
}

/** Output of sampling a sprite at a given time. All properties resolved. */
export interface SampledSprite {
  id: string;
  text: string;
  x: number;
  y: number;
  opacity: number;
  fontSize: number;
  rotation: number;
  color: Color;
}

/** Result of schema validation. */
export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}

/** A single validation error with a JSON pointer path and stable error code. */
export interface ValidationError {
  /** JSON pointer, e.g. "/sprites/0/keyframes/2/t". */
  path: string;
  /** Human-readable message. */
  message: string;
  /** Stable error code, e.g. "SCHEMA_VERSION_UNSUPPORTED". */
  code: string;
}

/** Resolves named color tokens to RGB triplets. */
export interface ColorResolver {
  resolve(token: ColorToken): [number, number, number];
}

/** Default transform values for sprites with no keyframe overrides. */
export const DEFAULT_TRANSFORM: Readonly<Transform> = Object.freeze({
  x: 5,
  y: 5,
  opacity: 1,
  fontSize: 18,
  rotation: 0,
  color: 'secondary',
});

/** Default frames per second. */
export const DEFAULT_FPS = 60;

/** Default canvas grid size. */
export const DEFAULT_GRID: Readonly<Grid> = Object.freeze({
  cols: 60,
  rows: 13,
});

/** Published JSON Schema URL for .aanim files. */
export const SCHEMA_URL = 'https://ascii-anim.app/schema/v1.json';
