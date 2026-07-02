import * as assert from 'assert';

import { buildBlocks, InsertOptions } from '../../formatter';
import { getGenerator } from '../../catalog';
import type { Generator, GenerateOptions } from '../../catalog';
import { load, seed } from '../../engine';

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

describe('buildBlocks — dateFormat threading', () => {
  // The formatter is the only caller of generate() on the insert path — it must hand the dateFormat
  // option through so the Time generators can render per the setting. A probe generator records what
  // each draw received.
  function probe(): { generator: Generator; seen: unknown[] } {
    const seen: unknown[] = [];
    return {
      seen,
      generator: { id: 'p', label: 'P', group: 'G', generate: (opts?: GenerateOptions) => { seen.push(opts?.dateFormat); return 'x'; } },
    };
  }

  it('passes options.dateFormat into every generate() call (all cursors, all bulk items)', () => {
    const { generator, seen } = probe();
    buildBlocks(2, generator, { ...BASE, bulkCount: 2, dateFormat: 'unixSeconds' });
    assert.deepStrictEqual(seen, [ 'unixSeconds', 'unixSeconds', 'unixSeconds', 'unixSeconds' ]);
  });

  it('passes no format when the option is unset (generators fall back to full ISO)', () => {
    const { generator, seen } = probe();
    buildBlocks(1, generator, BASE);
    assert.deepStrictEqual(seen, [ undefined ]);
  });
});

describe('buildBlocks — strictUnique (seen-set re-draws)', () => {
  // A scripted duplicating source: cycles through a fixed sequence, so both the duplicate draw and
  // the value a re-draw lands on are exact.
  function cycle(values: readonly string[]): Generator {
    let n = 0;
    return { id: 'y', label: 'Y', group: 'G', generate: () => values[n++ % values.length] };
  }

  it('is off by default: duplicate draws pass through', () => {
    const [ block ] = buildBlocks(1, cycle([ 'a', 'a', 'b' ]), { ...BASE, bulkCount: 3 });
    assert.strictEqual(block, 'a\na\nb');
  });

  it('explicit false behaves exactly like absent', () => {
    const [ block ] = buildBlocks(1, cycle([ 'a', 'a', 'b' ]), { ...BASE, bulkCount: 3, strictUnique: false });
    assert.strictEqual(block, 'a\na\nb');
  });

  it('re-draws a duplicate within a bulk block when on', () => {
    const [ block ] = buildBlocks(1, cycle([ 'a', 'a', 'b' ]), { ...BASE, bulkCount: 2, strictUnique: true });
    assert.strictEqual(block, 'a\nb');
  });

  it('spans every cursor when uniquePerCursor is on (cross-cursor values are meant to differ)', () => {
    assert.deepStrictEqual(
      buildBlocks(2, cycle([ 'a', 'a', 'b' ]), { ...BASE, strictUnique: true }),
      [ 'a', 'b' ],
    );
  });

  it('dedups only within the shared block when uniquePerCursor is off (cursors repeat by design)', () => {
    assert.deepStrictEqual(
      buildBlocks(2, cycle([ 'a', 'a', 'b' ]), { ...BASE, uniquePerCursor: false, bulkCount: 2, strictUnique: true }),
      [ 'a\nb', 'a\nb' ],
    );
  });

  it('keeps the duplicate once the re-draw budget is exhausted (never hangs)', () => {
    const [ block ] = buildBlocks(1, fixed('x'), { ...BASE, bulkCount: 3, strictUnique: true });
    assert.strictEqual(block, 'x\nx\nx');
  });

  it('spends exactly the 25-re-draw budget before keeping a duplicate', () => {
    // A single-value domain: the first draw is fresh; the second exhausts the budget (one draw +
    // 25 re-draws) and keeps the duplicate. The budget is part of the seeded-output contract —
    // changing it shifts every seeded strict-unique sequence, so update this pin deliberately.
    let draws = 0;
    const constant: Generator = { id: 'k', label: 'K', group: 'G', generate: () => { draws++; return 'x'; } };
    const [ block ] = buildBlocks(1, constant, { ...BASE, bulkCount: 2, strictUnique: true });
    assert.strictEqual(block, 'x\nx');
    assert.strictEqual(draws, 27, 'value 1: one draw; value 2: one draw + 25 re-draws');
  });

  it('hands dateFormat to re-draws too (every draw carries the same options)', () => {
    const seen: unknown[] = [];
    let n = 0;
    const values = [ 'a', 'a', 'b' ];
    const dupThenFresh: Generator = {
      id: 'd', label: 'D', group: 'G',
      generate: (opts?: GenerateOptions) => { seen.push(opts?.dateFormat); return values[n++]; },
    };
    const [ block ] = buildBlocks(1, dupThenFresh, { ...BASE, bulkCount: 2, strictUnique: true, dateFormat: 'isoDate' });
    assert.strictEqual(block, 'a\nb');
    assert.deepStrictEqual(seen, [ 'isoDate', 'isoDate', 'isoDate' ]);
  });
});

describe('buildBlocks — strictUnique with the real engine', function () {
  this.timeout(10000);
  before(async () => { await load(); });

  it('uuid × 200 in one bulk block → zero duplicates', () => {
    seed(1234);
    const uuid = getGenerator('uuid')!;
    const [ block ] = buildBlocks(1, uuid, { ...BASE, bulkCount: 200, strictUnique: true });
    const values = block.split('\n');
    assert.strictEqual(values.length, 200);
    assert.strictEqual(new Set(values).size, 200, 'strict unique must leave no duplicate among 200 uuids');
  });

  it('boolean × bulk 10 terminates, duplicates allowed once the domain is exhausted', () => {
    seed(1);
    const boolean = getGenerator('boolean')!;
    const [ block ] = buildBlocks(1, boolean, { ...BASE, bulkCount: 10, strictUnique: true });
    const values = block.split('\n');
    assert.strictEqual(values.length, 10, 'exhaustion must keep the duplicate and move on — all 10 values delivered');
    assert.ok(values.every((value) => value === 'true' || value === 'false'), `unexpected values: ${block}`);
  });

  it('weekday × 5 under a duplicate-bearing seed → five distinct values', () => {
    // Premise: seed 12345's natural weekday sequence repeats (Monday twice on faker 10.5) —
    // verified here so this test can never pass without a re-draw actually happening. If a faker
    // upgrade changes the sequence, pick a new duplicate-bearing seed.
    const weekday = getGenerator('weekday')!;
    seed(12345);
    const natural = Array.from({ length: 5 }, () => weekday.generate());
    assert.ok(new Set(natural).size < 5, 'premise broken: this seed no longer draws a duplicate — choose another');

    seed(12345);
    const [ block ] = buildBlocks(1, weekday, { ...BASE, bulkCount: 5, strictUnique: true });
    assert.strictEqual(new Set(block.split('\n')).size, 5, `expected five distinct weekdays, got: ${block}`);
  });

  it('same seed → same output with strict unique on (re-draws are deterministic)', () => {
    // 3 cursors × bulk 3 from a 7-value domain forces re-draws AND exhaustion — both must replay
    // identically under the same seed.
    const weekday = getGenerator('weekday')!;
    seed(42);
    const first = buildBlocks(3, weekday, { ...BASE, bulkCount: 3, strictUnique: true });
    seed(42);
    const second = buildBlocks(3, weekday, { ...BASE, bulkCount: 3, strictUnique: true });
    assert.deepStrictEqual(first, second);
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
