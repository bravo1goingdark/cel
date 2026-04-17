/**
 * @module migrate
 * Forward-only migration framework for scene files.
 * Currently empty for v1 — only validates the version field.
 */

import type { Scene } from './types';
import { CURRENT_VERSION } from './types';

/**
 * Migration functions keyed by source version.
 * When v2 ships, add: 1: (v1Scene) => toV2(v1Scene)
 */
const MIGRATIONS: Record<number, (scene: unknown) => unknown> = {
  // intentionally empty for v1
};

/**
 * Migrate a scene object to the current schema version.
 * Throws on invalid input, missing migrations, or unsupported future versions.
 */
export function migrate(input: unknown): Scene {
  if (input === null || input === undefined || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Invalid scene: not an object');
  }

  const obj = input as Record<string, unknown>;
  let current: unknown = input;
  let version = typeof obj['version'] === 'number' ? obj['version'] : 0;

  if (version === 0) {
    throw new Error('Invalid scene: missing or invalid version');
  }

  if (version > CURRENT_VERSION) {
    throw new Error(
      `Scene version ${version} is newer than supported ${CURRENT_VERSION}. Update the app.`,
    );
  }

  /* v8 ignore start -- migration loop activates when v2+ migrations are added */
  while (version < CURRENT_VERSION) {
    const migrator = MIGRATIONS[version];
    if (!migrator) {
      throw new Error(`No migration from v${version}`);
    }
    current = migrator(current);
    version++;
  }
  /* v8 ignore stop */

  return current as Scene;
}
