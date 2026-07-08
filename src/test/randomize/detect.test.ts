import * as assert from 'assert';

import { detect, shapeTimestamp, shapeUuid } from '../../randomize';

// detect(text) is the type-detection half of type-aware replace (Randomize Selection): a selection
// that IS an unambiguous email / UUID / ISO date / ISO timestamp gets a fresh REALISTIC fake of the
// same type instead of a character scramble — a scrambled uuid isn't valid hex and a scrambled date
// isn't a date. Detection is deliberately conservative: anchored, whole-string, no trimming — anything
// not matched exactly falls back to the format-preserving scramble, the safe default. Numbers are
// deliberately NOT detected: the scramble already yields a fresh same-shape number (digits redraw,
// sign and decimal point stay), which IS the typed replacement for a number.

describe('detect — typed-value detection for Randomize Selection', () => {
  it('detects a whole-string email', () => {
    for (const text of [ 'jane.doe+prod@acme.com', 'a@b.co', 'A_b%x-1@sub.domain.org' ]) {
      assert.strictEqual(detect(text), 'email', `'${text}' should detect as email`);
    }
  });

  it('rejects near-emails — no TLD, spaces, padding, or surrounding text', () => {
    for (const text of [ 'a@b', '@x.io', 'jane doe@x.io', ' a@b.io', 'a@b.io ', 'a@b.io\n', 'mail me at a@b.io', 'not an email' ]) {
      assert.strictEqual(detect(text), undefined, `'${text}' must fall back to the scramble`);
    }
  });

  it('detects a dashed uuid in either case, braced or bare', () => {
    for (const text of [
      '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      '9B1DEB4D-3B7D-4BAD-9BDD-2B0D7B3DCB6D',
      '{9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d}',
      '{9B1DEB4D-3B7D-4BAD-9BDD-2B0D7B3DCB6D}',
      '12345678-1234-1234-1234-123456789012',
    ]) {
      assert.strictEqual(detect(text), 'uuid', `'${text}' should detect as uuid`);
    }
  });

  it('rejects near-uuids — half braces, non-hex, missing dashes, trailing content', () => {
    for (const text of [
      '{9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d}',
      'gb1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d',
      '9b1deb4d3b7d4bad9bdd2b0d7b3dcb6d', // a 32-hex hash-alike — stays a scramble by design
      '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d x',
    ]) {
      assert.strictEqual(detect(text), undefined, `'${text}' must fall back to the scramble`);
    }
  });

  it('detects a calendar-valid ISO date (leap day included)', () => {
    for (const text of [ '2024-02-29', '2026-07-02', '0001-01-01' ]) {
      assert.strictEqual(detect(text), 'isoDate', `'${text}' should detect as isoDate`);
    }
  });

  it('rejects impossible or unpadded calendar dates — V8 would roll them over, we must not', () => {
    for (const text of [ '2023-02-29', '2026-13-01', '2026-00-01', '2026-07-32', '2026-07-00', '2026-7-2', '2026-07-02 ' ]) {
      assert.strictEqual(detect(text), undefined, `'${text}' must fall back to the scramble`);
    }
  });

  it('detects a UTC ISO timestamp, with or without milliseconds', () => {
    for (const text of [ '2026-07-02T12:34:56Z', '2026-07-02T12:34:56.7Z', '2026-07-02T12:34:56.789Z' ]) {
      assert.strictEqual(detect(text), 'isoTimestamp', `'${text}' should detect as isoTimestamp`);
    }
  });

  it('rejects near-timestamps — missing Z, offsets, impossible time or date fields', () => {
    for (const text of [
      '2026-07-02T12:34:56',
      '2026-07-02T12:34:56+02:00',
      '2026-07-02T24:00:00Z',
      '2026-07-02T12:60:00Z',
      '2026-07-02T12:34:61Z',
      '2026-02-31T12:34:56Z',
      '2026-07-02T12:34:56.1234Z',
    ]) {
      assert.strictEqual(detect(text), undefined, `'${text}' must fall back to the scramble`);
    }
  });

  it('deliberately leaves numbers to the format-preserving scramble', () => {
    for (const text of [ '42', '3.14', '-7', '+1.5', '007' ]) {
      assert.strictEqual(detect(text), undefined, `'${text}' is served by the scramble already`);
    }
  });

  it('detects nothing in plain or empty text', () => {
    for (const text of [ '', 'hello', 'Alice Smith', '+63 (917) 555-0142' ]) {
      assert.strictEqual(detect(text), undefined);
    }
  });
});

describe('shapeUuid — a fresh uuid dressed like the original', () => {
  const FRESH = '0a1b2c3d-4e5f-6071-8293-a4b5c6d7e8f9';

  it('matches the original case: uppercase originals get an uppercase redraw', () => {
    assert.strictEqual(shapeUuid(FRESH, '9B1DEB4D-3B7D-4BAD-9BDD-2B0D7B3DCB6D'), FRESH.toUpperCase());
    assert.strictEqual(shapeUuid(FRESH, '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'), FRESH);
  });

  it('keeps the original braces', () => {
    assert.strictEqual(shapeUuid(FRESH, '{9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d}'), `{${FRESH}}`);
    assert.strictEqual(shapeUuid(FRESH, '{9B1DEB4D-3B7D-4BAD-9BDD-2B0D7B3DCB6D}'), `{${FRESH.toUpperCase()}}`);
  });

  it('defaults to lowercase when the original carries no hex letters or mixes case', () => {
    assert.strictEqual(shapeUuid(FRESH, '12345678-1234-1234-1234-123456789012'), FRESH);
    assert.strictEqual(shapeUuid(FRESH, '9B1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d'), FRESH);
  });
});

describe('shapeTimestamp — millisecond precision follows the original', () => {
  it('strips the fresh milliseconds when the original had none', () => {
    assert.strictEqual(shapeTimestamp('2001-02-03T04:05:06.789Z', '2026-07-02T12:34:56Z'), '2001-02-03T04:05:06Z');
  });

  it('keeps the fresh milliseconds when the original carried any', () => {
    assert.strictEqual(shapeTimestamp('2001-02-03T04:05:06.789Z', '2026-07-02T12:34:56.100Z'), '2001-02-03T04:05:06.789Z');
  });
});
