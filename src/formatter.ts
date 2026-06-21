import type { Generator } from './catalog';

/** How a block of generated values is rendered. */
export type OutputFormat = 'plain' | 'jsonArray' | 'quotedList';

/** Everything {@link buildBlocks} needs to render values, derived from settings. */
export interface InsertOptions {
  /** Quote characters wrapped around each value ('' for none). */
  readonly quote: string;
  /** Trailing string after each block ('' or '\n'). */
  readonly newline: string;
  /** A fresh value per cursor (true) vs one value repeated across cursors (false). */
  readonly uniquePerCursor: boolean;
  /** How many values to generate at each cursor. */
  readonly bulkCount: number;
  /** How a block of values is rendered. */
  readonly outputFormat: OutputFormat;
}

/** Render the string inserted at one cursor: `bulkCount` fresh values, formatted. */
function formatBlock(generator: Generator, options: InsertOptions): string {
  const count = Math.max(1, Math.floor(options.bulkCount || 1));
  const values = Array.from({ length: count }, () => generator.generate());

  switch (options.outputFormat) {
    case 'jsonArray':
      // Each value is emitted as a JSON string (a number/boolean value stays quoted).
      return `[ ${values.map((value) => JSON.stringify(value)).join(', ')} ]${options.newline}`;
    case 'quotedList':
      return `${values.map((value) => `${options.quote}${value}${options.quote}`).join(', ')}${options.newline}`;
    case 'plain':
    default:
      // One wrapped value per line; the trailing newline is controlled by `newline`.
      return `${values.map((value) => `${options.quote}${value}${options.quote}`).join('\n')}${options.newline}`;
  }
}

/**
 * Build one rendered block per cursor. With `uniquePerCursor`, every block draws
 * fresh values — the core of multi-cursor fill. Pure by design: no editor and no
 * `vscode` import, so it can be exercised in isolation. The editor glue (mapping
 * these blocks onto `editor.selections`) lives in `extension.ts`.
 *
 * @param cursorCount one block is produced per cursor/selection
 */
export function buildBlocks(cursorCount: number, generator: Generator, options: InsertOptions): string[] {
  if (!options.uniquePerCursor) {
    const shared = formatBlock(generator, options);
    return Array.from({ length: cursorCount }, () => shared);
  }
  return Array.from({ length: cursorCount }, () => formatBlock(generator, options));
}
