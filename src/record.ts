/**
 * Multi-field records: compose selected catalog generators into one structured
 * record — a JSON object, a SQL INSERT row, or a CSV line — with shape-driven
 * escaping. Pure (no `vscode` import) so it can be unit-tested in isolation.
 *
 * A record's escaping is decided by its **shape**, not by the file's language:
 * `json` uses `JSON.stringify`, `sql` single-quotes with `''` doubling, `csv`
 * wraps only the values that need it. `bulkCount` stacks records per shape.
 * The `dataset` option renders the same records as a standalone file instead
 * of an at-cursor block: CSV gains a header row, JSON is always an array with
 * one record per line, and the text ends with a trailing newline.
 */
import type { DateFormat, Generator } from './catalog';

/** The structured shape a record renders as. */
export type RecordShape = 'json' | 'sql' | 'csv';

/** Options for {@link buildRecords}, derived from settings. */
export interface RecordOptions {
  /** How many records to emit (>1 stacks per shape). */
  readonly bulkCount: number;
  /** Table name for the `sql` shape. */
  readonly sqlTable: string;
  /** Timestamp rendering, handed through to each field draw (Time generators read it). */
  readonly dateFormat?: DateFormat;
  /** Render as a standalone dataset file rather than an at-cursor block: `csv`
   * gains a header row of field keys, `json` is always an array (one record per
   * line), and the text ends with a trailing newline. `sql` needs no change —
   * its `INSERT` statements already stand alone. */
  readonly dataset?: boolean;
}

/** One rendered field within a record. */
interface Field {
  readonly key: string;
  readonly value: string;
}

/** SQL string-literal escaping: double an embedded single quote (`'` → `''`). */
function sqlEscape(value: string): string {
  return value.split("'").join("''");
}

/** CSV field escaping: wrap in `"` and double internal `"` when the value
 * contains a comma, quote, CR, or LF; otherwise return it unchanged. */
function csvEscape(value: string): string {
  return /[",\n\r]/.test(value) ? `"${value.split('"').join('""')}"` : value;
}

function renderJson(records: Field[][], dataset: boolean): string {
  const objects = records.map((rec) => {
    const body = rec.map((f) => `${JSON.stringify(f.key)}: ${JSON.stringify(f.value)}`).join(', ');
    return `{ ${body} }`;
  });
  // A dataset file is always an array — its consumer iterates it — with one
  // record per line, so a 100k-row file stays scrollable (the editor's
  // tokenizer gives up on a single multi-megabyte line).
  if (dataset) { return `[\n${objects.map((object) => `  ${object}`).join(',\n')}\n]`; }
  return objects.length === 1 ? objects[0] : `[ ${objects.join(', ')} ]`;
}

function renderSql(records: Field[][], table: string): string {
  return records
    .map((rec) => {
      const cols = rec.map((f) => f.key).join(', ');
      const vals = rec.map((f) => `'${sqlEscape(f.value)}'`).join(', ');
      return `INSERT INTO ${table} (${cols}) VALUES (${vals});`;
    })
    .join('\n');
}

function renderCsv(records: Field[][], header?: readonly string[]): string {
  const rows = records.map((rec) => rec.map((f) => csvEscape(f.value)).join(','));
  // Header cells run through csvEscape too — a custom-list field key is a
  // user-chosen name that may itself contain a comma or quote.
  if (header) { rows.unshift(header.map((key) => csvEscape(key)).join(',')); }
  return rows.join('\n');
}

/**
 * Build the text for one record insert: `bulkCount` records, each a fresh draw
 * from every selected generator, rendered in `shape`. Field order follows the
 * order of `fields` (the caller passes them in catalog order).
 */
export function buildRecords(fields: Generator[], shape: RecordShape, opts: RecordOptions): string {
  const count = Math.max(1, Math.floor(opts.bulkCount || 1));
  const records: Field[][] = Array.from({ length: count }, () =>
    fields.map((f) => ({ key: f.id, value: f.generate({ dateFormat: opts.dateFormat }) })),
  );
  let body: string;
  switch (shape) {
    case 'sql': body = renderSql(records, opts.sqlTable); break;
    case 'csv': body = renderCsv(records, opts.dataset ? fields.map((f) => f.id) : undefined); break;
    case 'json':
    default:    body = renderJson(records, opts.dataset === true); break;
  }
  return opts.dataset ? `${body}\n` : body;
}
