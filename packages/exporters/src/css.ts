import type { Scene, Easing, BezierEasing } from '@cel/core';
import { DEFAULT_TRANSFORM, DEFAULT_CHAR_WIDTH, DEFAULT_LINE_HEIGHT } from '@cel/core';
import type { Exporter } from './types';

export interface CssOpts {
  prefix?: string;
}

/** Map a named easing or cubic bezier to a CSS timing function. */
function easingToCss(easing?: Easing): string {
  if (!easing || easing === 'linear') return 'linear';
  if (easing === 'in') return 'cubic-bezier(0.42, 0, 1, 1)';
  if (easing === 'out') return 'cubic-bezier(0, 0, 0.58, 1)';
  if (easing === 'inout') return 'cubic-bezier(0.42, 0, 0.58, 1)';
  if (typeof easing === 'object' && 'cubic' in easing) {
    const [x1, y1, x2, y2] = (easing as BezierEasing).cubic;
    return `cubic-bezier(${x1}, ${y1}, ${x2}, ${y2})`;
  }
  return 'linear';
}

export const cssExporter: Exporter<CssOpts> = {
  id: 'css',
  name: 'CSS Keyframes',
  description: 'Pure CSS animation using @keyframes with easing support.',
  extension: '.css',
  mimeType: 'text/css',
  defaultOpts: { prefix: 'cel' },

  async run(scene, opts) {
    const prefix = opts.prefix ?? 'cel';
    const warnings: string[] = [];
    const D = DEFAULT_TRANSFORM;
    const CW = DEFAULT_CHAR_WIDTH;
    const LH = DEFAULT_LINE_HEIGHT;
    const lines: string[] = [];

    for (const sprite of scene.sprites) {
      if (sprite.hidden) continue;

      const textChanges = sprite.keyframes.filter((kf) => kf.text !== undefined);
      if (textChanges.length > 1) {
        warnings.push(
          `Sprite "${sprite.id}": text animation not supported in CSS export. Default text used throughout.`,
        );
      }

      lines.push(`/* sprite: ${sprite.id} */`);
      lines.push(`@keyframes ${prefix}-${sprite.id} {`);

      for (const kf of sprite.keyframes) {
        const pct = scene.duration > 0 ? ((kf.t / scene.duration) * 100).toFixed(1) : '0';
        const x = ((kf.x ?? D.x) * CW).toFixed(1);
        const y = ((kf.y ?? D.y) * LH).toFixed(1);
        const rot = (kf.rotation ?? D.rotation).toFixed(1);
        const op = (kf.opacity ?? D.opacity).toFixed(2);
        const fs = Math.round(kf.fontSize ?? D.fontSize);
        const timing = easingToCss(kf.easing);

        lines.push(`  ${pct}% {`);
        lines.push(`    transform: translate(${x}px, ${y}px) rotate(${rot}deg);`);
        lines.push(`    opacity: ${op};`);
        lines.push(`    font-size: ${fs}px;`);
        if (timing !== 'linear') {
          lines.push(`    animation-timing-function: ${timing};`);
        }
        lines.push('  }');
      }

      lines.push('}');
      lines.push('');

      lines.push(`.${prefix}-${sprite.id} {`);
      lines.push('  position: absolute;');
      lines.push('  top: 0;');
      lines.push('  left: 0;');
      lines.push('  white-space: pre;');
      lines.push('  line-height: 1.375;');
      lines.push('  font-family: ui-monospace, monospace;');
      lines.push(`  animation: ${prefix}-${sprite.id} ${scene.duration}ms linear infinite;`);
      lines.push('}');
      lines.push('');
    }

    const content = lines.join('\n');
    return {
      content,
      warnings,
      meta: { sizeBytes: content.length, elapsed: 0 },
    };
  },
};
