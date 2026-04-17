import type { Scene } from '@ascii-anim/core';
import { DEFAULT_TRANSFORM } from '@ascii-anim/core';
import type { Exporter } from './types';

export interface ReactOpts {
  componentName?: string;
}

export const reactExporter: Exporter<ReactOpts> = {
  id: 'react',
  name: 'React Component',
  description: 'Typed React component with embedded animation.',
  extension: '.tsx',
  mimeType: 'text/typescript',
  defaultOpts: { componentName: 'AsciiAnimation' },

  async run(scene, opts) {
    const name = opts.componentName ?? 'AsciiAnimation';
    const D = DEFAULT_TRANSFORM;

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

const D = { x: ${D.x}, y: ${D.y}, op: ${D.opacity}, fs: ${D.fontSize}, rot: ${D.rotation} };
const CW = 10.2, LH = 22;

function ease(t: number, e?: string): number {
  if (!e || e === 'linear') return t;
  if (e === 'in') return t * t;
  if (e === 'out') return 1 - (1 - t) ** 2;
  if (e === 'inout') return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2;
  return t;
}

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }

function sample(kfs: any[], t: number) {
  if (!kfs.length) return { x: D.x, y: D.y, op: D.op, fs: D.fs, rot: D.rot };
  if (t <= kfs[0].t) { const k = kfs[0]; return { x: k.x ?? D.x, y: k.y ?? D.y, op: k.opacity ?? D.op, fs: k.fontSize ?? D.fs, rot: k.rotation ?? D.rot }; }
  const l = kfs[kfs.length - 1];
  if (t >= l.t) return { x: l.x ?? D.x, y: l.y ?? D.y, op: l.opacity ?? D.op, fs: l.fontSize ?? D.fs, rot: l.rotation ?? D.rot };
  let i = 0; while (i < kfs.length - 1 && kfs[i + 1].t <= t) i++;
  const a = kfs[i], b = kfs[i + 1], p = ease((t - a.t) / (b.t - a.t), b.easing);
  return { x: lerp(a.x ?? D.x, b.x ?? D.x, p), y: lerp(a.y ?? D.y, b.y ?? D.y, p), op: lerp(a.opacity ?? D.op, b.opacity ?? D.op, p), fs: lerp(a.fontSize ?? D.fs, b.fontSize ?? D.fs, p), rot: lerp(a.rotation ?? D.rot, b.rotation ?? D.rot, p) };
}

function textAt(sp: any, t: number) {
  let r = sp.text;
  for (const k of sp.keyframes) { if (k.t > t) break; if (k.text != null) r = k.text; }
  return r;
}

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
    container.innerHTML = '';
    const sprites = SCENE.sprites.filter((s: any) => !s.hidden);
    const els = sprites.map((sp: any) => {
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
    return () => cancelAnimationFrame(raf);
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
