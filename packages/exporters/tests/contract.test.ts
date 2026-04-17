import { describe, it, expect } from 'vitest';
import { exporters } from '../src/index';
import type { Scene } from '@cel/core';

const referenceScene: Scene = {
  version: 1,
  duration: 4000,
  fps: 60,
  grid: { cols: 60, rows: 13 },
  sprites: [
    {
      id: 'face',
      text: '( -_- )',
      keyframes: [
        { t: 0, x: 5.5, y: 5, opacity: 1, fontSize: 22, rotation: 0, color: 'secondary', easing: 'inout' },
        { t: 2000, x: 5.5, y: 5.6, opacity: 1, fontSize: 22, rotation: -1, color: 'secondary', easing: 'inout' },
        { t: 4000, x: 5.5, y: 5, opacity: 1, fontSize: 22, rotation: 0, color: 'secondary', easing: 'inout' },
      ],
    },
  ],
};

describe.each(exporters)('$name exporter', (exporter) => {
  it('has required metadata fields', () => {
    expect(exporter.id).toBeTruthy();
    expect(exporter.name).toBeTruthy();
    expect(exporter.description).toBeTruthy();
    expect(exporter.extension).toMatch(/^\./);
    expect(exporter.mimeType).toBeTruthy();
    expect(exporter.defaultOpts).toBeDefined();
  });

  it('produces output when run', async () => {
    const result = await exporter.run(referenceScene, exporter.defaultOpts);
    expect(result).toBeDefined();
    expect(result.content).toBeDefined();
    expect(result.warnings).toBeDefined();
    expect(Array.isArray(result.warnings)).toBe(true);
  });

  it('completes within 5 seconds', async () => {
    const start = performance.now();
    await exporter.run(referenceScene, exporter.defaultOpts);
    expect(performance.now() - start).toBeLessThan(5000);
  });
});

describe('json exporter produces valid scene output', () => {
  it('returns non-empty string content', async () => {
    const json = exporters.find((e) => e.id === 'json')!;
    const result = await json.run(referenceScene, json.defaultOpts);
    expect(typeof result.content).toBe('string');
    expect((result.content as string).length).toBeGreaterThan(0);
    expect(result.warnings).toEqual([]);
  });
});

describe('all exporters are registered', () => {
  it('has exactly 7 exporters', () => {
    expect(exporters).toHaveLength(7);
  });

  it('covers all expected IDs', () => {
    const ids = exporters.map((e) => e.id).sort();
    expect(ids).toEqual(['ansi', 'css', 'gif', 'html', 'jsmodule', 'json', 'react']);
  });
});
