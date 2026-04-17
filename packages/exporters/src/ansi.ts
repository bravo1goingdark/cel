import type { Scene } from '@ascii-anim/core';
import { DEFAULT_TRANSFORM } from '@ascii-anim/core';
import type { Exporter } from './types';

export interface AnsiOpts {
  clearScreen?: boolean;
}

export const ansiExporter: Exporter<AnsiOpts> = {
  id: 'ansi',
  name: 'Terminal Script',
  description: 'Node.js script that plays the animation using ANSI escape sequences.',
  extension: '.js',
  mimeType: 'application/javascript',
  defaultOpts: { clearScreen: true },

  async run(scene, opts) {
    const D = DEFAULT_TRANSFORM;
    const clear = opts.clearScreen !== false;

    const content = `#!/usr/bin/env node
// ASCII Anim — Terminal playback script
// Usage: node ${scene.meta?.title ?? 'animation'}.js

const SCENE = ${JSON.stringify(scene, null, 2)};
const D = { x: ${D.x}, y: ${D.y}, op: ${D.opacity}, fs: ${D.fontSize}, rot: ${D.rotation} };

function ease(t, e) {
  if (!e || e === 'linear') return t;
  if (e === 'in') return t * t;
  if (e === 'out') return 1 - (1 - t) ** 2;
  if (e === 'inout') return t < 0.5 ? 2 * t * t : 1 - 2 * (1 - t) ** 2;
  return t;
}

function lerp(a, b, t) { return a + (b - a) * t; }

function sample(kfs, t) {
  if (!kfs.length) return { x: D.x, y: D.y, op: D.op };
  if (t <= kfs[0].t) { const k = kfs[0]; return { x: k.x ?? D.x, y: k.y ?? D.y, op: k.opacity ?? D.op }; }
  const l = kfs[kfs.length - 1];
  if (t >= l.t) return { x: l.x ?? D.x, y: l.y ?? D.y, op: l.opacity ?? D.op };
  let i = 0; while (i < kfs.length - 1 && kfs[i + 1].t <= t) i++;
  const a = kfs[i], b = kfs[i + 1], p = ease((t - a.t) / (b.t - a.t), b.easing);
  return { x: lerp(a.x ?? D.x, b.x ?? D.x, p), y: lerp(a.y ?? D.y, b.y ?? D.y, p), op: lerp(a.opacity ?? D.op, b.opacity ?? D.op, p) };
}

function textAt(sp, t) {
  let r = sp.text;
  for (const k of sp.keyframes) { if (k.t > t) break; if (k.text != null) r = k.text; }
  return r;
}

const cols = SCENE.grid?.cols ?? 60;
const rows = SCENE.grid?.rows ?? 13;
const fps = SCENE.fps ?? 30;
const dt = 1000 / fps;
let t = 0;

${clear ? 'process.stdout.write("\\x1b[2J");' : ''}
process.stdout.write("\\x1b[?25l"); // hide cursor

process.on('SIGINT', () => {
  process.stdout.write("\\x1b[?25h\\n"); // show cursor
  process.exit(0);
});

setInterval(() => {
  process.stdout.write("\\x1b[H"); // home
  const grid = Array.from({ length: rows }, () => Array(cols).fill(' '));

  for (const sp of SCENE.sprites) {
    if (sp.hidden) continue;
    const p = sample(sp.keyframes, t);
    if (p.op < 0.1) continue;
    const text = textAt(sp, t);
    const col = Math.round(p.x);
    const row = Math.round(p.y);
    for (let i = 0; i < text.length; i++) {
      const c = col + i;
      if (row >= 0 && row < rows && c >= 0 && c < cols) {
        grid[row][c] = text[i];
      }
    }
  }

  const frame = grid.map(r => r.join('')).join('\\n');
  process.stdout.write(frame);
  t += dt;
  if (t >= SCENE.duration) t = 0;
}, dt);
`;

    return {
      content,
      warnings: [],
      meta: { sizeBytes: content.length, elapsed: 0 },
    };
  },
};
