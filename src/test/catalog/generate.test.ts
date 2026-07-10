import * as assert from 'assert';

import { generators, getGenerator } from '../../catalog';
import { load, seed } from '../../engine';

// Behavioral coverage for the whole registry: every generator must actually produce output. faker is
// loaded once up front (it's vscode-free, so this runs under plain node too). The non-empty check is
// data-driven, so a newly-added generator is exercised the moment it joins `generators`.
describe('catalog generators — output', function () {
  this.timeout(15000);

  before(async () => {
    await load();
  });

  it('every generator yields a non-empty string', () => {
    // Seed up front so a failure is reproducible; the property (a non-empty string) holds for any seed.
    seed(20260701);
    for (const g of generators) {
      const value = g.generate();
      assert.strictEqual(typeof value, 'string', `'${g.id}' returned a non-string`);
      assert.ok(value.length > 0, `'${g.id}' returned an empty string`);
    }
  });

  it('the same seed reproduces the same value', () => {
    const uuid = getGenerator('uuid')!;
    seed(7);
    const first = uuid.generate();
    seed(7);
    const second = uuid.generate();
    assert.strictEqual(first, second);
  });

  it('draws a fresh value on each call — no memoization', () => {
    seed(1);
    const uuid = getGenerator('uuid')!;
    const values = new Set(Array.from({ length: 5 }, () => uuid.generate()));
    assert.ok(values.size > 1, 'expected distinct values across repeated calls');
  });
});
