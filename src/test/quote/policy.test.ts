import * as assert from 'assert';

import { resolveQuotePolicy } from '../../quotePolicy';

// resolveQuotePolicy IS the automatic-quoting logic: given a languageId and withQuote it picks the
// quote char + escape style. Two buckets: (1) SQL keeps single quotes but uses sqlDouble escaping;
// (2) EVERYTHING else — JS/TS, Python, JSON, Go, unlisted, no editor — gets double quotes with
// backslash escaping. withQuote=false means no wrapping at all.
const ON = { withQuote: true };

describe('resolveQuotePolicy — SQL bucket', () => {
  for (const id of [ 'sql', 'mysql', 'pgsql', 'plsql', 'sqlite' ]) {
    it(`${id} uses single quotes with sqlDouble escaping`, () => {
      const policy = resolveQuotePolicy(id, ON);
      assert.strictEqual(policy.quote, "'");
      assert.strictEqual(policy.escape, 'sqlDouble');
    });
  }
});

describe('resolveQuotePolicy — everything else gets double quotes', () => {
  for (const id of [ 'json', 'jsonc', 'go', 'java', 'cpp', 'csharp', 'rust', 'javascript', 'typescript', 'python', 'ruby', 'php', 'some-exotic-lang' ]) {
    it(`${id} uses double quotes with backslash escaping`, () => {
      const policy = resolveQuotePolicy(id, ON);
      assert.strictEqual(policy.quote, '"');
      assert.strictEqual(policy.escape, 'backslash');
    });
  }

  it('undefined languageId (no active editor) → double quotes', () => {
    const policy = resolveQuotePolicy(undefined, ON);
    assert.strictEqual(policy.quote, '"');
    assert.strictEqual(policy.escape, 'backslash');
  });
});

describe('resolveQuotePolicy — withQuote off', () => {
  it('withQuote=false → no wrapping, regardless of language', () => {
    assert.strictEqual(resolveQuotePolicy('json', { withQuote: false }).quote, '');
    assert.strictEqual(resolveQuotePolicy('sql', { withQuote: false }).quote, '');
  });
});
