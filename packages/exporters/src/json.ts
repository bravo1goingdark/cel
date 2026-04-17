import { serialize } from '@ascii-anim/core';
import type { Exporter } from './types';

export const jsonExporter: Exporter<object> = {
  id: 'json',
  name: 'Raw Scene',
  description: 'Identity export — deterministic .aanim JSON.',
  extension: '.aanim',
  mimeType: 'application/vnd.ascii-anim+json',
  defaultOpts: {},

  async run(scene, _opts) {
    const content = serialize(scene);
    return {
      content,
      warnings: [],
      meta: {
        sizeBytes: content.length,
        elapsed: 0,
      },
    };
  },
};
