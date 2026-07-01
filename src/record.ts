/**
 * Multi-field records: compose selected catalog generators into one structured
 * record — a JSON object, a SQL INSERT row, or a CSV line — with shape-driven
 * escaping. Pure (no `vscode` import) so it can be unit-tested in isolation.
 *
 * A record's escaping is decided by its **shape**, not by the file's language:
 * `json` uses `JSON.stringify`, `sql` single-quotes with `''` doubling, `csv`
 * wraps only the values that need it. `bulkCount` stacks records per shape.
 */
import type { Generator } from './catalog';

/** The structured shape a record renders as. */
export type RecordShape = 'json' | 'sql' | 'csv';

/** Options for {@link buildRecords}, derived from settings. */
export interface RecordOptions {
  /** How many records to emit (>1 stacks per shape). */
  readonly bulkCount: number;
  /** Table name for the `sql` shape. */
  readonly sqlTable: string;
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

function renderJson(records: Field[][]): string {
  const objects = records.map((rec) => {
    const body = rec.map((f) => `${JSON.stringify(f.key)}: ${JSON.stringify(f.value)}`).join(', ');
    return `{ ${body} }`;
  });
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

function renderCsv(records: Field[][]): string {
  return records.map((rec) => rec.map((f) => csvEscape(f.value)).join(',')).join('\n');
}

/**
 * Build the text for one record insert: `bulkCount` records, each a fresh draw
 * from every selected generator, rendered in `shape`. Field order follows the
 * order of `fields` (the caller passes them in catalog order).
 */
export function buildRecords(fields: Generator[], shape: RecordShape, opts: RecordOptions): string {
  const count = Math.max(1, Math.floor(opts.bulkCount || 1));
  const records: Field[][] = Array.from({ length: count }, () =>
    fields.map((f) => ({ key: f.id, value: f.generate() })),
  );
  switch (shape) {
    case 'sql': return renderSql(records, opts.sqlTable);
    case 'csv': return renderCsv(records);
    case 'json':
    default:    return renderJson(records);
  }
}
