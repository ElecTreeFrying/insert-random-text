import * as assert from 'assert';

import { buildBlocks, InsertOptions } from '../../formatter';
import type { Generator } from '../../catalog';

// buildBlocks is the formatter's pure render core: it turns (cursorCount, generator, options) into one
// string block per cursor, each holding `bulkCount` values shaped by `outputFormat`, with
// `uniquePerCursor` deciding whether every cursor draws fresh or shares one block. quote/escape.test.ts
// already pins the quote-wrapping; this pins the surrounding block-shaping the editor glue in
// extension.ts relies on (multi-cursor fill, bulk count, output formats) — all without booting VS Code.

// A fixed value keeps output exact; a counter reveals how many times / how independently generate() ran.
function fixed(value: string): Generator {
  return { id: 't', label: 'T', group: 'G', generate: () => value };
}
function counter(): Generator {
  let n = 0;
  return { id: 'c', label: 'C', group: 'G', generate: () => String(n++) };
}

const BASE: InsertOptions = {
  quote: '',
  newline: '',
  uniquePerCursor: true,
  bulkCount: 1,
  outputFormat: 'plain',
};

describe('buildBlocks — one block per cursor', () => {
  it('produces an empty array for zero cursors', () => {
    assert.deepStrictEqual(buildBlocks(0, fixed('x'), BASE), []);
  });

  it('produces exactly one block per cursor', () => {
    assert.deepStrictEqual(buildBlocks(3, fixed('x'), BASE), [ 'x', 'x', 'x' ]);
  });
});

describe('buildBlocks — uniquePerCursor', () => {
  it('draws a fresh value at each cursor when true', () => {
    // counter yields 0,1,2 — proves each cursor calls generate() independently (the multi-cursor fill).
    assert.deepStrictEqual(buildBlocks(3, counter(), { ...BASE, uniquePerCursor: true }), [ '0', '1', '2' ]);
  });

  it('repeats one shared value at every cursor when false', () => {
    // The block is computed once, so the counter never advances past its first draw.
    assert.deepStrictEqual(buildBlocks(3, counter(), { ...BASE, uniquePerCursor: false }), [ '0', '0', '0' ]);
  });

  it('shares a full multi-value block across cursors when false', () => {
    // The shared block is built once (counter → 0,1,2), then repeated verbatim at every cursor.
    const blocks = buildBlocks(2, counter(), { ...BASE, uniquePerCursor: false, bulkCount: 3 });
    assert.deepStrictEqual(blocks, [ '0\n1\n2', '0\n1\n2' ]);
  });
});

describe('buildBlocks — bulkCount', () => {
  it('emits bulkCount values at a cursor (plain = newline-joined)', () => {
    const [ block ] = buildBlocks(1, counter(), { ...BASE, bulkCount: 3 });
    assert.strictEqual(block, '0\n1\n2');
  });

  it('clamps bulkCount 0 up to a single value', () => {
    assert.deepStrictEqual(buildBlocks(1, counter(), { ...BASE, bulkCount: 0 }), [ '0' ]);
  });

  it('clamps a negative bulkCount up to a single value', () => {
    assert.deepStrictEqual(buildBlocks(1, counter(), { ...BASE, bulkCount: -5 }), [ '0' ]);
  });

  it('floors a fractional bulkCount (1.9 → 1 value, not 2)', () => {
    assert.deepStrictEqual(buildBlocks(1, counter(), { ...BASE, bulkCount: 1.9 }), [ '0' ]);
  });
});

describe('buildBlocks — outputFormat', () => {
  it('plain joins values with newlines', () => {
    const [ block ] = buildBlocks(1, counter(), { ...BASE, outputFormat: 'plain', bulkCount: 3 });
    assert.strictEqual(block, '0\n1\n2');
  });

  it('jsonArray emits a JSON array (values JSON-stringified, quote option ignored)', () => {
    const [ block ] = buildBlocks(1, counter(), { ...BASE, outputFormat: 'jsonArray', bulkCount: 3 });
    assert.strictEqual(block, '[ "0", "1", "2" ]');
  });

  it('quotedList wraps each value and comma-joins them', () => {
    const [ block ] = buildBlocks(1, counter(), { ...BASE, outputFormat: 'quotedList', quote: '"', bulkCount: 3 });
    assert.strictEqual(block, '"0", "1", "2"');
  });
});

describe('buildBlocks — format + newline / list escaping', () => {
  it('jsonArray appends the trailing newline', () => {
    const [ block ] = buildBlocks(1, counter(), { ...BASE, outputFormat: 'jsonArray', bulkCount: 2, newline: '\n' });
    assert.strictEqual(block, '[ "0", "1" ]\n');
  });

  it('quotedList appends the trailing newline', () => {
    const [ block ] = buildBlocks(1, counter(), { ...BASE, outputFormat: 'quotedList', quote: '"', bulkCount: 2, newline: '\n' });
    assert.strictEqual(block, '"0", "1"\n');
  });

  it('quotedList backslash-escapes the quote char inside each value', () => {
    const [ block ] = buildBlocks(1, fixed("O'Brien"), { ...BASE, outputFormat: 'quotedList', quote: "'", escape: 'backslash', bulkCount: 2 });
    assert.strictEqual(block, "'O\\'Brien', 'O\\'Brien'");
  });

  it('quotedList sqlDouble-escapes the quote char inside each value', () => {
    const [ block ] = buildBlocks(1, fixed("O'Brien"), { ...BASE, outputFormat: 'quotedList', quote: "'", escape: 'sqlDouble', bulkCount: 2 });
    assert.strictEqual(block, "'O''Brien', 'O''Brien'");
  });
});

describe('buildBlocks — newline', () => {
  it('appends the newline string after each block', () => {
    const blocks = buildBlocks(2, fixed('x'), { ...BASE, uniquePerCursor: false, newline: '\n' });
    assert.deepStrictEqual(blocks, [ 'x\n', 'x\n' ]);
  });

  it('appends nothing when newline is empty', () => {
    assert.deepStrictEqual(buildBlocks(1, fixed('x'), { ...BASE, newline: '' }), [ 'x' ]);
  });
});
