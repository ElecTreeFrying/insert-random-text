import * as assert from 'assert';

import { faker, load, seed } from '../../engine';

// engine owns the faker lifecycle: a lazy, idempotent load(); the faker() accessor; and seed(). We skip
// the "faker() throws before load()" guard on purpose — the loaded instance is a module-level singleton
// shared across the whole test process, and another suite loads it first, so that guard can't be
// observed here in isolation.
describe('engine — faker lifecycle', function () {
  this.timeout(15000);

  before(async () => {
    await load();
  });

  it('faker() returns a usable instance after load()', () => {
    assert.strictEqual(typeof faker().person.firstName, 'function');
  });

  it('load() is idempotent — a second load keeps the same instance', async () => {
    const instance = faker();
    await load();
    assert.strictEqual(faker(), instance);
  });

  it('seed(n) makes the next draw reproducible', () => {
    seed(123);
    const first = faker().string.uuid();
    seed(123);
    const second = faker().string.uuid();
    assert.strictEqual(first, second);
  });
});

describe('engine — faker() before load()', () => {
  it('throws when called before load() has resolved', () => {
    // The loaded instance is a module-level singleton shared across the whole test process, so once any
    // other suite has called load() this guard can't be observed directly. Re-require a *fresh* copy of
    // the module (its `instance` still undefined) to exercise the guard, then restore the loaded module
    // in require.cache so nothing else in the run is disturbed.
    const key = require.resolve('../../engine');
    const saved = require.cache[key];
    delete require.cache[key];
    try {
      const fresh = require('../../engine');
      assert.throws(() => fresh.faker(), /before load/);
    } finally {
      if (saved) { require.cache[key] = saved; } else { delete require.cache[key]; }
    }
  });
});
