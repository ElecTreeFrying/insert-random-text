import * as assert from 'assert';

import { faker, load, LOCALES, seed } from '../../engine';

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

// S8: load(locale) makes one of the six shipped locale instances active. In this headless run the
// test's own locale import resolves to the very module engine imports (one module cache), so identity
// assertions are exact; the seeded-draw comparisons additionally hold cross-instance (the Host tier
// re-checks them against the bundled copy).
describe('engine — locale switching', function () {
  this.timeout(15000);

  after(async () => {
    await load('en'); // the instance is a process-wide singleton — leave later suites on English data.
  });

  it("load('de') swaps the active instance to the German data set", async () => {
    const { faker: fakerDE } = await import('@faker-js/faker/locale/de');
    await load('de');
    assert.strictEqual(faker(), fakerDE, 'faker() should hand out the de instance');
    seed(7);
    const drawn = faker().person.firstName();
    fakerDE.seed(7);
    assert.strictEqual(drawn, fakerDE.person.firstName(), 'the active instance should draw de data');
  });

  it('bare load() defaults to en', async () => {
    const { faker: fakerEN } = await import('@faker-js/faker/locale/en');
    await load();
    assert.strictEqual(faker(), fakerEN);
  });

  it('locale instances are cached — re-loading reuses the same instance', async () => {
    await load('de');
    const first = faker();
    await load('en');
    assert.notStrictEqual(faker(), first, 'en and de must be distinct instances');
    await load('de');
    assert.strictEqual(faker(), first, 'a second load(de) must reuse the cached instance');
  });

  it('the same seed draws different data under different locales (a real swap, not a relabel)', async () => {
    await load('en');
    seed(7);
    const en = faker().person.firstName();
    await load('ja');
    seed(7);
    const ja = faker().person.firstName();
    assert.notStrictEqual(en, ja, 'ja names should not match en names under the same seed');
  });

  it('every shipped locale loads and draws', async () => {
    for (const locale of LOCALES) {
      await load(locale);
      assert.ok(faker().person.firstName().length > 0, `locale '${locale}' should draw a first name`);
    }
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
