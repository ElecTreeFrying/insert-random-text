import * as assert from 'assert';

import { formatTimestamp, generators, getGenerator } from '../../catalog';
import { load, seed } from '../../engine';

// The dateFormat rendering seam: the timestamp-emitting Time generators accept
// generate({ dateFormat }) and render their drawn Date accordingly; weekday/month (and every other
// generator) ignore the option. formatTimestamp is the pure core — every ISO slice comes from the UTC
// toISOString(), never local-time getters, so a seeded run renders the same text on any machine.

// A fixed instant keeps the shape expectations exact: 2026-07-02T03:04:05.678Z.
const INSTANT = new Date(Date.UTC(2026, 6, 2, 3, 4, 5, 678));

describe('formatTimestamp — one Date, five renderings', () => {
  it("'iso' renders the full ISO 8601 timestamp", () => {
    assert.strictEqual(formatTimestamp(INSTANT, 'iso'), '2026-07-02T03:04:05.678Z');
  });

  it("'isoDate' renders YYYY-MM-DD", () => {
    assert.strictEqual(formatTimestamp(INSTANT, 'isoDate'), '2026-07-02');
  });

  it("'isoTime' renders HH:mm:ss", () => {
    assert.strictEqual(formatTimestamp(INSTANT, 'isoTime'), '03:04:05');
  });

  it("'unixSeconds' renders whole seconds since the epoch", () => {
    assert.strictEqual(formatTimestamp(INSTANT, 'unixSeconds'), String(Math.floor(INSTANT.getTime() / 1000)));
  });

  it("'unixMillis' renders milliseconds since the epoch", () => {
    assert.strictEqual(formatTimestamp(INSTANT, 'unixMillis'), String(INSTANT.getTime()));
  });

  it('defaults to the full ISO rendering when no format is given', () => {
    assert.strictEqual(formatTimestamp(INSTANT), INSTANT.toISOString());
  });

  it("'unixSeconds' floors pre-1970 instants toward -∞ (birthdate can draw them)", () => {
    // 1.5 s before the epoch is second -2 (POSIX floor semantics), not -1 (truncation).
    assert.strictEqual(formatTimestamp(new Date(-1500), 'unixSeconds'), '-2');
  });
});

const TIMESTAMP_GENERATORS = [ 'date', 'pastDate', 'futureDate', 'recentDate', 'soonDate', 'birthdate' ] as const;

describe('Time generators — generate({ dateFormat })', function () {
  this.timeout(15000);

  before(async () => {
    await load();
  });

  it('every timestamp generator exists in the catalog', () => {
    for (const id of TIMESTAMP_GENERATORS) {
      assert.ok(generators.some((g) => g.id === id), `'${id}' missing from the catalog`);
    }
  });

  it('every timestamp generator defaults to full ISO (pre-dateFormat behavior preserved)', () => {
    seed(20260702);
    for (const id of TIMESTAMP_GENERATORS) {
      const value = getGenerator(id)!.generate();
      assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, `'${id}' without options must stay full ISO`);
    }
  });

  it("every timestamp generator honors 'isoDate'", () => {
    seed(20260702);
    for (const id of TIMESTAMP_GENERATORS) {
      assert.match(getGenerator(id)!.generate({ dateFormat: 'isoDate' }), /^\d{4}-\d{2}-\d{2}$/, `'${id}'`);
    }
  });

  it("every timestamp generator honors 'isoTime'", () => {
    seed(20260702);
    for (const id of TIMESTAMP_GENERATORS) {
      assert.match(getGenerator(id)!.generate({ dateFormat: 'isoTime' }), /^\d{2}:\d{2}:\d{2}$/, `'${id}'`);
    }
  });

  it("every timestamp generator honors 'unixSeconds' and 'unixMillis' (negatives allowed pre-1970)", () => {
    seed(20260702);
    for (const id of TIMESTAMP_GENERATORS) {
      assert.match(getGenerator(id)!.generate({ dateFormat: 'unixSeconds' }), /^-?\d+$/, `'${id}' seconds`);
      assert.match(getGenerator(id)!.generate({ dateFormat: 'unixMillis' }), /^-?\d+$/, `'${id}' millis`);
    }
  });

  it('the same seed renders the same instant across formats (format is presentation only)', () => {
    const date = getGenerator('date')!;
    seed(7);
    const iso = date.generate({ dateFormat: 'iso' });
    seed(7);
    const millis = date.generate({ dateFormat: 'unixMillis' });
    // The two draws share a seed but not the wall clock: faker's date generators
    // window around a refDate defaulting to *now*, so back-to-back draws can sit
    // a few ms apart (this exact-equality assert flaked). Equality up to that
    // jitter still pins the threading — a real format bug (e.g. seconds instead
    // of millis) is off by orders of magnitude, not milliseconds.
    const delta = Math.abs(new Date(iso).getTime() - Number(millis));
    assert.ok(delta <= 1000, `iso and unixMillis should render the same drawn instant (delta ${delta}ms)`);
  });

  it('weekday and month ignore dateFormat (they are names, not timestamps)', () => {
    for (const id of [ 'weekday', 'month' ] as const) {
      const generator = getGenerator(id)!;
      seed(11);
      const plain = generator.generate();
      seed(11);
      const formatted = generator.generate({ dateFormat: 'unixSeconds' });
      assert.strictEqual(formatted, plain, `'${id}' must ignore dateFormat`);
    }
  });
});
