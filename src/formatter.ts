import type { DateFormat, Generator } from './catalog';
import type { EscapeStyle } from './quotePolicy';

/** How a block of generated values is rendered. */
export type OutputFormat = 'plain' | 'jsonArray' | 'quotedList';

/** Everything {@link buildBlocks} needs to render values, derived from settings. */
export interface InsertOptions {
  /** Quote characters wrapped around each value ('' for none). */
  readonly quote: string;
  /** How the quote character is escaped inside a value (default 'backslash'). */
  readonly escape?: EscapeStyle;
  /** Trailing string after each block ('' or '\n'). */
  readonly newline: string;
  /** A fresh value per cursor (true) vs one value repeated across cursors (false). */
  readonly uniquePerCursor: boolean;
  /** How many values to generate at each cursor. */
  readonly bulkCount: number;
  /** How a block of values is rendered. */
  readonly outputFormat: OutputFormat;
  /** Timestamp rendering, handed through to each generate() (Time generators read it). */
  readonly dateFormat?: DateFormat;
  /** Re-draw duplicates so values meant to differ within one insert really do (bounded). */
  readonly strictUnique?: boolean;
}

/**
 * Wrap one value in `quote`, escaping the quote character inside it so the result
 * is a valid string literal. Two escape styles:
 *
 * - `backslash` (default) — backslash-escape any `\`, then the quote char:
 *   `O'Brien` → `'O\'Brien'` (JS/TS, Python, JSON, …).
 * - `sqlDouble` — double the quote char, no backslashing: `O'Brien` → `'O''Brien'`
 *   (SQL string literals).
 *
 * With no quote (`quote === ''`) the value is returned untouched. `jsonArray`
 * skips this entirely and uses `JSON.stringify`, which escapes on its own.
 */
function wrap(value: string, quote: string, escape: EscapeStyle): string {
  if (!quote) { return value; }
  if (escape === 'sqlDouble') {
    const escaped = value.split(quote).join(`${quote}${quote}`);
    return `${quote}${escaped}${quote}`;
  }
  const escaped = value.split('\\').join('\\\\').split(quote).join(`\\${quote}`);
  return `${quote}${escaped}${quote}`;
}

/**
 * Re-draw budget per value under `strictUnique`. Bounded so a small value pool
 * (booleans, weekdays) exhausts and keeps its duplicate instead of hanging.
 * Every re-draw consumes RNG state, so this number is part of the seeded-output
 * contract — changing it shifts every seeded strict-unique sequence.
 */
const UNIQUE_RETRIES = 25;

/**
 * Draw through the operation's seen-set: a value already produced is re-drawn, up
 * to {@link UNIQUE_RETRIES} times; on exhaustion the duplicate is kept — never a
 * hang, never an error.
 */
function uniqueDraw(draw: () => string, seen: Set<string>): string {
  let value = draw();
  for (let retry = 0; retry < UNIQUE_RETRIES && seen.has(value); retry++) {
    value = draw();
  }
  seen.add(value);
  return value;
}

/** Render the string inserted at one cursor: `bulkCount` fresh values, formatted. */
function formatBlock(generator: Generator, options: InsertOptions, seen?: Set<string>): string {
  const count = Math.max(1, Math.floor(options.bulkCount || 1));
  const draw = () => generator.generate({ dateFormat: options.dateFormat });
  const values = Array.from({ length: count }, () => (seen ? uniqueDraw(draw, seen) : draw()));
  const escape = options.escape ?? 'backslash';

  switch (options.outputFormat) {
    case 'jsonArray':
      // Each value is emitted as a JSON string (a number/boolean value stays quoted).
      return `[ ${values.map((value) => JSON.stringify(value)).join(', ')} ]${options.newline}`;
    case 'quotedList':
      return `${values.map((value) => wrap(value, options.quote, escape)).join(', ')}${options.newline}`;
    case 'plain':
    default:
      // One wrapped value per line; the trailing newline is controlled by `newline`.
      return `${values.map((value) => wrap(value, options.quote, escape)).join('\n')}${options.newline}`;
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
  // One seen-set per insert operation: with uniquePerCursor it spans every cursor's
  // block; without, cursors repeat one block by design, so it covers only the values
  // inside that shared block — strict unique never applies to values meant to match.
  const seen = options.strictUnique ? new Set<string>() : undefined;
  if (!options.uniquePerCursor) {
    const shared = formatBlock(generator, options, seen);
    return Array.from({ length: cursorCount }, () => shared);
  }
  return Array.from({ length: cursorCount }, () => formatBlock(generator, options, seen));
}
