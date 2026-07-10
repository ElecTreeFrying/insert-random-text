import * as assert from 'assert';

import { generators, getGenerator } from '../../catalog';

// The registry is the single source of truth that drives generation, the commands and the Quick Pick, so
// its shape is load-bearing. No faker here — these are pure structural invariants that hold for every
// entry, so they auto-cover each generator added to the list.

describe('catalog registry — structure', () => {
  it('every generator has a non-empty id, label, group and a generate function', () => {
    for (const g of generators) {
      assert.ok(typeof g.id === 'string' && g.id.length > 0, `bad id on ${JSON.stringify(g)}`);
      assert.ok(typeof g.label === 'string' && g.label.length > 0, `bad label on '${g.id}'`);
      assert.ok(typeof g.group === 'string' && g.group.length > 0, `bad group on '${g.id}'`);
      assert.strictEqual(typeof g.generate, 'function', `missing generate() on '${g.id}'`);
    }
  });

  it('ids are unique', () => {
    const ids = generators.map((g) => g.id);
    assert.strictEqual(new Set(ids).size, ids.length, 'duplicate generator id(s) in the registry');
  });

  it('getGenerator resolves every registered id back to its entry', () => {
    for (const g of generators) {
      assert.strictEqual(getGenerator(g.id), g, `getGenerator('${g.id}') did not return its entry`);
    }
  });

  it('getGenerator returns undefined for an unknown id', () => {
    assert.strictEqual(getGenerator('___no_such_generator___'), undefined);
  });

  it('hidden is set only on the legacy Lorem/Hash size variants', () => {
    const hidden = generators.filter((g) => g.hidden).map((g) => g.id).sort();
    assert.deepStrictEqual(
      hidden,
      [ 'hashLarge', 'hashMedium', 'hashSmall', 'loremLarge', 'loremMedium', 'loremSmall' ].sort(),
      'the hidden set drifted — a new hidden generator appeared, or a size variant lost its hidden flag',
    );
  });
});
