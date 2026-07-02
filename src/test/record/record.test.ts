import * as assert from 'assert';

import { buildRecords } from '../../record';
import type { Generator, GenerateOptions } from '../../catalog';

// buildRecords composes selected generators into one record string per shape:
// json (object / array of objects, JSON.stringify escaping, keys = generator id),
// sql (INSERT INTO <table> …; single-quote values, '' doubling, one stmt per record),
// csv (comma-joined, "…" quoting only when a value has a comma / quote / newline).
// bulkCount stacks records per shape; field order follows the fields array (catalog order).

function field(id: string, value: string): Generator {
  return { id, label: id, group: 'G', generate: () => value };
}
const OPTS = { bulkCount: 1, sqlTable: 'table' };

describe('buildRecords — json', () => {
  it('renders a single object keyed by generator id', () => {
    assert.strictEqual(
      buildRecords([ field('fullName', 'Jane Doe'), field('email', 'j@x.com') ], 'json', OPTS),
      '{ "fullName": "Jane Doe", "email": "j@x.com" }',
    );
  });

  it('renders a JSON array of objects when bulkCount > 1', () => {
    assert.strictEqual(
      buildRecords([ field('n', 'A') ], 'json', { ...OPTS, bulkCount: 2 }),
      '[ { "n": "A" }, { "n": "A" } ]',
    );
  });

  it('escapes quotes so the result parses as JSON', () => {
    const out = buildRecords([ field('q', 'say "hi"') ], 'json', OPTS);
    assert.strictEqual(out, '{ "q": "say \\"hi\\"" }');
    assert.doesNotThrow(() => JSON.parse(out));
  });
});

describe('buildRecords — sql', () => {
  it('renders an INSERT with the configured table', () => {
    assert.strictEqual(
      buildRecords([ field('name', 'Jane'), field('age', '42') ], 'sql', { ...OPTS, sqlTable: 'users' }),
      "INSERT INTO users (name, age) VALUES ('Jane', '42');",
    );
  });

  it("doubles an embedded single quote (O'Brien)", () => {
    assert.strictEqual(
      buildRecords([ field('name', "O'Brien") ], 'sql', OPTS),
      "INSERT INTO table (name) VALUES ('O''Brien');",
    );
  });

  it('emits one statement per record, newline-separated', () => {
    assert.strictEqual(
      buildRecords([ field('n', 'A') ], 'sql', { ...OPTS, bulkCount: 2 }),
      "INSERT INTO table (n) VALUES ('A');\nINSERT INTO table (n) VALUES ('A');",
    );
  });
});

describe('buildRecords — csv', () => {
  it('joins values with commas', () => {
    assert.strictEqual(buildRecords([ field('a', 'x'), field('b', 'y') ], 'csv', OPTS), 'x,y');
  });

  it('quotes and doubles quotes for values with a comma or quote', () => {
    assert.strictEqual(
      buildRecords([ field('a', 'x,y'), field('b', 'he "said"') ], 'csv', OPTS),
      '"x,y","he ""said"""',
    );
  });

  it('emits one line per record', () => {
    assert.strictEqual(buildRecords([ field('n', 'A') ], 'csv', { ...OPTS, bulkCount: 2 }), 'A\nA');
  });

  it('quotes values containing a newline or carriage return', () => {
    // The other two csvEscape triggers — an unquoted line break would split the record across CSV rows.
    assert.strictEqual(buildRecords([ field('a', 'x\ny') ], 'csv', OPTS), '"x\ny"');
    assert.strictEqual(buildRecords([ field('a', 'x\ry') ], 'csv', OPTS), '"x\ry"');
  });
});

describe('buildRecords — bulkCount clamping', () => {
  // json makes the clamp observable: exactly one record renders as a bare object, never an array.
  it('clamps 0 and negatives up to a single record', () => {
    assert.strictEqual(buildRecords([ field('n', 'A') ], 'json', { ...OPTS, bulkCount: 0 }), '{ "n": "A" }');
    assert.strictEqual(buildRecords([ field('n', 'A') ], 'json', { ...OPTS, bulkCount: -3 }), '{ "n": "A" }');
  });

  it('floors a fractional count (2.9 → 2 records, not 3)', () => {
    assert.strictEqual(
      buildRecords([ field('n', 'A') ], 'json', { ...OPTS, bulkCount: 2.9 }),
      '[ { "n": "A" }, { "n": "A" } ]',
    );
  });
});

describe('buildRecords — dateFormat threading', () => {
  // Records draw from the same generators as single-type inserts, so a Time field must honor the
  // dateFormat setting here too. A probe field records what each draw received.
  function probe(): { generator: Generator; seen: unknown[] } {
    const seen: unknown[] = [];
    return {
      seen,
      generator: { id: 'p', label: 'P', group: 'G', generate: (opts?: GenerateOptions) => { seen.push(opts?.dateFormat); return 'x'; } },
    };
  }

  it('passes opts.dateFormat into every field draw (all records)', () => {
    const { generator, seen } = probe();
    buildRecords([ generator ], 'json', { ...OPTS, bulkCount: 2, dateFormat: 'isoDate' });
    assert.deepStrictEqual(seen, [ 'isoDate', 'isoDate' ]);
  });

  it('passes no format when the option is unset', () => {
    const { generator, seen } = probe();
    buildRecords([ generator ], 'csv', OPTS);
    assert.deepStrictEqual(seen, [ undefined ]);
  });
});

describe('buildRecords — field order', () => {
  it('follows the fields array (caller passes catalog order)', () => {
    assert.strictEqual(buildRecords([ field('first', '1'), field('second', '2') ], 'csv', OPTS), '1,2');
  });
});

describe('buildRecords — dataset mode (records → file)', () => {
  // dataset: true renders the same records as a STANDALONE FILE for Generate Dataset…:
  // csv gains a header row of field keys, json is always an array (one record per line, so a
  // 100k-row file stays scrollable), and the text ends with a trailing newline. At-cursor
  // records never pass the flag — the headerless/bare-object pins above are the other half
  // of this contract.

  it('csv leads with a header row of field keys and ends with a newline', () => {
    assert.strictEqual(
      buildRecords([ field('a', 'x'), field('b', 'y') ], 'csv', { ...OPTS, dataset: true }),
      'a,b\nx,y\n',
    );
  });

  it('csv header cells are escaped (a custom-list name can hold a comma)', () => {
    assert.strictEqual(
      buildRecords([ field('name, formal', 'x') ], 'csv', { ...OPTS, dataset: true }),
      '"name, formal"\nx\n',
    );
  });

  it('csv stacks one line per record under the single header', () => {
    assert.strictEqual(
      buildRecords([ field('n', 'A') ], 'csv', { ...OPTS, bulkCount: 3, dataset: true }),
      'n\nA\nA\nA\n',
    );
  });

  it('json is an array even for a single record, one record per line', () => {
    assert.strictEqual(
      buildRecords([ field('n', 'A') ], 'json', { ...OPTS, dataset: true }),
      '[\n  { "n": "A" }\n]\n',
    );
  });

  it('json stacks records one per line and stays parseable', () => {
    const out = buildRecords([ field('n', 'A') ], 'json', { ...OPTS, bulkCount: 2, dataset: true });
    assert.strictEqual(out, '[\n  { "n": "A" },\n  { "n": "A" }\n]\n');
    const parsed = JSON.parse(out);
    assert.ok(Array.isArray(parsed) && parsed.length === 2);
  });

  it('sql keeps its one-statement-per-line body, plus the trailing newline', () => {
    assert.strictEqual(
      buildRecords([ field('n', 'A') ], 'sql', { ...OPTS, bulkCount: 2, dataset: true }),
      "INSERT INTO table (n) VALUES ('A');\nINSERT INTO table (n) VALUES ('A');\n",
    );
  });

  it('an explicit dataset: false behaves exactly like the at-cursor default', () => {
    assert.strictEqual(buildRecords([ field('a', 'x') ], 'csv', { ...OPTS, dataset: false }), 'x');
    assert.strictEqual(buildRecords([ field('n', 'A') ], 'json', { ...OPTS, dataset: false }), '{ "n": "A" }');
  });
});
