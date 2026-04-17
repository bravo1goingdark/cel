import type { Scene } from 'cel-core';
import { DEFAULT_TRANSFORM } from 'cel-core';
import type { Exporter } from './types';
import {
  RUNTIME_DEFAULTS,
  RUNTIME_EASE,
  RUNTIME_LERP,
  RUNTIME_SAMPLE_TERMINAL,
  RUNTIME_TEXT_AT,
} from './runtime';

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
    const clear = opts.clearScreen !== false;

    const content = `#!/usr/bin/env node
// Cel — Terminal playback script
// Usage: node ${scene.meta?.title ?? 'animation'}.js

const SCENE = ${JSON.stringify(scene, null, 2)};
${RUNTIME_DEFAULTS}

${RUNTIME_EASE}
${RUNTIME_LERP}
${RUNTIME_SAMPLE_TERMINAL}
${RUNTIME_TEXT_AT}

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
