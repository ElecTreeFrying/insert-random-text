import * as assert from 'assert';

import { buildBlocks, InsertOptions } from '../../formatter';
import type { Generator } from '../../catalog';

// The formatter's private wrap() gained a second escape style (sqlDouble). Rather than reach into the
// private function, drive it through the public buildBlocks — that also proves the new
// InsertOptions.escape field actually threads through to the wrapping. A fixed-value generator makes
// the output exact and deterministic.
function fixed(value: string): Generator {
  return { id: 't', label: 'T', group: 'G', generate: () => value };
}

const BASE: InsertOptions = {
  quote: "'",
  newline: '',
  uniquePerCursor: false,
  bulkCount: 1,
  outputFormat: 'plain',
};

describe('formatter escape — backslash (default)', () => {
  it("backslash-escapes the quote char: O'Brien → 'O\\'Brien'", () => {
    const [ block ] = buildBlocks(1, fixed("O'Brien"), { ...BASE, quote: "'", escape: 'backslash' });
    assert.strictEqual(block, "'O\\'Brien'");
  });

  it('escape defaults to backslash when the field is omitted', () => {
    const [ block ] = buildBlocks(1, fixed("O'Brien"), BASE);
    assert.strictEqual(block, "'O\\'Brien'");
  });

  it('a double-quote value in double quotes is backslash-escaped', () => {
    const [ block ] = buildBlocks(1, fixed('a"b'), { ...BASE, quote: '"', escape: 'backslash' });
    assert.strictEqual(block, '"a\\"b"');
  });

  it('doubles a literal backslash in the value (a\\b → a\\\\b)', () => {
    // The counterpart of the sqlDouble "leaves backslashes untouched" test below: backslash style must
    // escape the escape character itself, or the wrapped literal would swallow the character after it.
    const [ block ] = buildBlocks(1, fixed('a\\b'), { ...BASE, quote: "'", escape: 'backslash' });
    assert.strictEqual(block, "'a\\\\b'");
  });
});

describe('formatter escape — sqlDouble', () => {
  it("doubles the quote char, no backslash: O'Brien → 'O''Brien'", () => {
    const [ block ] = buildBlocks(1, fixed("O'Brien"), { ...BASE, quote: "'", escape: 'sqlDouble' });
    assert.strictEqual(block, "'O''Brien'");
  });

  it('leaves backslashes untouched (SQL does not backslash-escape)', () => {
    const [ block ] = buildBlocks(1, fixed('a\\b'), { ...BASE, quote: "'", escape: 'sqlDouble' });
    assert.strictEqual(block, "'a\\b'");
  });
});

describe('formatter escape — no quote', () => {
  it('quote="" returns the bare value even with an escape style set', () => {
    const [ block ] = buildBlocks(1, fixed("O'Brien"), { ...BASE, quote: '', escape: 'sqlDouble' });
    assert.strictEqual(block, "O'Brien");
  });
});
