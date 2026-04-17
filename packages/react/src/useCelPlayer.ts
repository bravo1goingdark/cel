/**
 * @module useCelPlayer
 * Lower-level hook for advanced users who want direct player access
 * with a custom RenderTarget.
 */

import { useEffect, useRef } from 'react';
import type { Scene, Player, RenderTarget, ColorResolver } from '@cel/core';
import { createPlayer } from '@cel/core';

/**
 * Create and manage a Cel player tied to a React component lifecycle.
 * Returns the Player instance (null during initial render).
 */
export function useCelPlayer(
  scene: Scene,
  target: RenderTarget,
  resolver?: ColorResolver,
): Player | null {
  const playerRef = useRef<Player | null>(null);

  useEffect(() => {
    const player = createPlayer(scene, target, resolver);
    playerRef.current = player;
    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [scene, target, resolver]);

  return playerRef.current;
}
