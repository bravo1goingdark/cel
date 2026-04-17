/**
 * @module types
 * Exporter interfaces. Every exporter is a pure function: scene + opts → result.
 */

import type { Scene } from 'cel-core';

/** An exporter that converts a scene to a specific output format. */
export interface Exporter<Opts = object> {
  /** Unique identifier, e.g. 'html', 'react', 'gif'. */
  id: string;
  /** Human-readable name. */
  name: string;
  /** Short description. */
  description: string;
  /** Output file extension, e.g. '.html', '.tsx'. */
  extension: string;
  /** MIME type for the output. */
  mimeType: string;
  /** Default options for this exporter. */
  defaultOpts: Opts;
  /** Run the export. Pure function — no I/O inside. */
  run(scene: Scene, opts: Opts): Promise<ExportResult>;
}

/** Result of running an exporter. */
export interface ExportResult {
  /** Exported content (text or binary). */
  content: string | Uint8Array;
  /** Warnings about unsupported features or approximations. */
  warnings: string[];
  /** Optional metadata about the export. */
  meta?: {
    sizeBytes: number;
    elapsed: number;
  };
}
