/**
 * cel-export — All exporters as pure functions.
 *
 * @packageDocumentation
 */

export type { Exporter, ExportResult } from './types';

export { htmlExporter } from './html';
export type { HtmlOpts } from './html';

export { reactExporter } from './react';
export type { ReactOpts } from './react';

export { cssExporter } from './css';
export type { CssOpts } from './css';

export { ansiExporter } from './ansi';
export type { AnsiOpts } from './ansi';

export { jsModuleExporter } from './jsmodule';
export type { JsModuleOpts } from './jsmodule';

export { jsonExporter } from './json';

export { gifExporter } from './gif';
export type { GifOpts } from './gif';

import type { Exporter } from './types';
import { htmlExporter } from './html';
import { reactExporter } from './react';
import { cssExporter } from './css';
import { ansiExporter } from './ansi';
import { jsModuleExporter } from './jsmodule';
import { jsonExporter } from './json';
import { gifExporter } from './gif';

/** All registered exporters. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export const exporters: Exporter<any>[] = [
  htmlExporter,
  reactExporter,
  cssExporter,
  ansiExporter,
  jsModuleExporter,
  jsonExporter,
  gifExporter,
];
