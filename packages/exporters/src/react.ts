import type { Scene } from '@cel/core';
import { DEFAULT_TRANSFORM } from '@cel/core';
import type { Exporter } from './types';
import {
  RUNTIME_DEFAULTS,
  RUNTIME_METRICS,
  RUNTIME_EASE,
  RUNTIME_LERP,
  RUNTIME_SAMPLE_FULL,
  RUNTIME_TEXT_AT,
} from './runtime';

export interface ReactOpts {
  componentName?: string;
}

export const reactExporter: Exporter<ReactOpts> = {
  id: 'react',
  name: 'React Component',
  description: 'Typed React component with embedded animation.',
  extension: '.tsx',
  mimeType: 'text/typescript',
  defaultOpts: { componentName: 'CelAnimation' },

  async run(scene, opts) {
    const name = opts.componentName ?? 'CelAnimation';

    const content = `import { useEffect, useRef } from 'react';

const SCENE = ${JSON.stringify(scene, null, 2)} as const;

export interface ${name}Props {
  width?: number;
  height?: number;
  autoplay?: boolean;
  loop?: boolean;
  speed?: number;
  className?: string;
  style?: React.CSSProperties;
}

interface KF { t: number; x?: number; y?: number; opacity?: number; fontSize?: number; rotation?: number; easing?: string; text?: string; }
interface SP { id: string; text: string; keyframes: KF[]; hidden?: boolean; }

${RUNTIME_DEFAULTS}
${RUNTIME_METRICS}

${RUNTIME_EASE}
${RUNTIME_LERP}
${RUNTIME_SAMPLE_FULL}
${RUNTIME_TEXT_AT}

export default function ${name}({
  width = 600,
  height = 240,
  autoplay = true,
  loop = true,
  speed = 1,
  className,
  style,
}: ${name}Props) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const container = ref.current;
    const sprites = (SCENE.sprites as SP[]).filter(s => !s.hidden);
    const els = sprites.map(sp => {
      const el = document.createElement('span');
      el.style.cssText = 'position:absolute;top:0;left:0;white-space:pre;line-height:1.375;font-family:ui-monospace,monospace';
      container.appendChild(el);
      return { sp, el };
    });

    let t = 0, last: number | null = null, raf = 0;
    const tick = (now: number) => {
      if (last === null) last = now;
      t += Math.min(now - last, 100) * speed;
      last = now;
      if (t >= SCENE.duration) {
        if (loop) t %= SCENE.duration;
        else { t = SCENE.duration; }
      }
      for (const { sp, el } of els) {
        const p = sample(sp.keyframes, t);
        el.textContent = textAt(sp, t);
        el.style.transform = \`translate(\${(p.x * CW).toFixed(1)}px,\${(p.y * LH).toFixed(1)}px) rotate(\${p.rot.toFixed(1)}deg)\`;
        el.style.opacity = p.op.toFixed(2);
        el.style.fontSize = Math.round(p.fs) + 'px';
      }
      if (autoplay && (loop || t < SCENE.duration)) raf = requestAnimationFrame(tick);
    };
    if (autoplay) raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf);
      while (container.firstChild) container.removeChild(container.firstChild);
    };
  }, [autoplay, loop, speed]);

  return (
    <div
      ref={ref}
      className={className}
      style={{ position: 'relative', width, height, overflow: 'hidden', fontFamily: 'ui-monospace, monospace', ...style }}
    />
  );
}
`;

    return {
      content,
      warnings: [],
      meta: { sizeBytes: content.length, elapsed: 0 },
    };
  },
};
