import type { Exporter } from './types';

export interface GifOpts {
  width?: number;
  height?: number;
  bgColor?: string;
}

export const gifExporter: Exporter<GifOpts> = {
  id: 'gif',
  name: 'Animated GIF',
  description: 'Rasterized GIF animation. Full implementation in Rust (Phase 4).',
  extension: '.gif',
  mimeType: 'image/gif',
  defaultOpts: { width: 600, height: 240, bgColor: '#f5f4f0' },

  async run(_scene, _opts) {
    return {
      content: new Uint8Array(0),
      warnings: ['GIF exporter not yet implemented — requires Rust backend'],
    };
  },
};
