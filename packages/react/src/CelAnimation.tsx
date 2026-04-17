/**
 * @module CelAnimation
 * Drop-in React component for playing Cel ASCII animations.
 * Uses imperative DOM manipulation for 60fps performance.
 */

import { useEffect, useRef } from 'react';
import type { Scene, SampledSprite, Player, RenderTarget } from '@cel/core';
import { createPlayer, DEFAULT_CHAR_WIDTH, DEFAULT_LINE_HEIGHT } from '@cel/core';

export interface CelAnimationProps {
  /** The scene to play. */
  scene: Scene;
  /** Start playing immediately. Default: true. */
  autoplay?: boolean;
  /** Loop playback. Default: true. */
  loop?: boolean;
  /** Playback speed multiplier. Default: 1. */
  speed?: number;
  /** Container width in px. Default: computed from scene grid. */
  width?: number;
  /** Container height in px. Default: computed from scene grid. */
  height?: number;
  /** CSS class for the container div. */
  className?: string;
  /** Inline styles for the container div. */
  style?: React.CSSProperties;
  /** Called each frame with sampled sprites and current time. */
  onFrame?: (sprites: SampledSprite[], t: number) => void;
}

export function CelAnimation({
  scene,
  autoplay = true,
  loop = true,
  speed = 1,
  width,
  height,
  className,
  style,
  onFrame,
}: CelAnimationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const onFrameRef = useRef(onFrame);
  onFrameRef.current = onFrame;

  const CW = DEFAULT_CHAR_WIDTH;
  const LH = DEFAULT_LINE_HEIGHT;

  // Create player and DOM elements when scene changes
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Clear previous elements
    while (container.firstChild) container.removeChild(container.firstChild);

    const visibleSprites = scene.sprites.filter(s => !s.hidden);
    const elMap = new Map<string, HTMLSpanElement>();

    for (const sp of visibleSprites) {
      const el = document.createElement('span');
      el.style.cssText =
        'position:absolute;top:0;left:0;white-space:pre;line-height:1.375;font-family:ui-monospace,monospace';
      container.appendChild(el);
      elMap.set(sp.id, el);
    }

    const target: RenderTarget = {
      render(sprites: SampledSprite[], t: number) {
        for (const s of sprites) {
          const el = elMap.get(s.id);
          if (!el) continue;
          el.textContent = s.text;
          el.style.transform = `translate(${(s.x * CW).toFixed(1)}px,${(s.y * LH).toFixed(1)}px) rotate(${s.rotation.toFixed(1)}deg)`;
          el.style.opacity = s.opacity.toFixed(2);
          el.style.fontSize = `${Math.round(s.fontSize)}px`;
        }
        if (onFrameRef.current) onFrameRef.current(sprites, t);
      },
    };

    const player = createPlayer(scene, target);
    playerRef.current = player;
    player.setLooping(loop);
    player.setSpeed(speed);
    if (autoplay) player.play();

    return () => {
      player.destroy();
      playerRef.current = null;
    };
  }, [scene]); // eslint-disable-line react-hooks/exhaustive-deps

  // Sync props without recreating player
  useEffect(() => { playerRef.current?.setLooping(loop); }, [loop]);
  useEffect(() => { playerRef.current?.setSpeed(speed); }, [speed]);
  useEffect(() => {
    if (!playerRef.current) return;
    if (autoplay && !playerRef.current.playing) playerRef.current.play();
    if (!autoplay && playerRef.current.playing) playerRef.current.pause();
  }, [autoplay]);

  const computedWidth = width ?? (scene.grid?.cols ?? 60) * CW;
  const computedHeight = height ?? (scene.grid?.rows ?? 13) * LH;

  return (
    <div
      ref={containerRef}
      className={className}
      style={{
        position: 'relative',
        width: computedWidth,
        height: computedHeight,
        overflow: 'hidden',
        fontFamily: 'ui-monospace, monospace',
        ...style,
      }}
    />
  );
}
