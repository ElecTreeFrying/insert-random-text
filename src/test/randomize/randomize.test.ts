import * as assert from 'assert';

import { randomize, Rng } from '../../randomize';

// randomize(text, rng) is the pure half of "Insert Random: Randomize Selection": every digit becomes a
// random digit, a–z a random lowercase letter, A–Z a random uppercase letter, everything else passes
// through untouched — so "3.14" stays number-shaped and "Bob@x.io" stays email-shaped. The rng is
// injected (the extension wraps the shared seeded faker instance), so these tests script it and pin the
// exact character-class contract without any engine in the loop.

/** rng that always picks index 0 → digits become '0', letters 'a' / 'A'. */
const zeroRng: Rng = () => 0;

/** rng that always picks the last index → digits become '9', letters 'z' / 'Z'. */
const maxRng: Rng = (bound) => bound - 1;

/** Deterministic little LCG — varied indices without Math.random. */
function lcgRng(seed = 42): Rng {
  let state = seed;
  return (bound) => {
    state = (state * 1103515245 + 12345) % 2147483648;
    return state % bound;
  };
}

/** rng that records the bound of every call. */
function recordingRng(): { rng: Rng; bounds: number[] } {
  const bounds: number[] = [];
  return { rng: (bound) => { bounds.push(bound); return 0; }, bounds };
}

describe('randomize — format-preserving randomization', () => {
  it('replaces every digit with a digit', () => {
    assert.strictEqual(randomize('0123456789', zeroRng), '0000000000');
    assert.strictEqual(randomize('0123456789', maxRng), '9999999999');
    assert.match(randomize('8675309', lcgRng()), /^[0-9]{7}$/);
  });

  it('preserves letter case: a–z stays lowercase, A–Z stays uppercase', () => {
    assert.strictEqual(randomize('abc', zeroRng), 'aaa');
    assert.strictEqual(randomize('XYZ', maxRng), 'ZZZ');
    assert.match(randomize('RandomizeMe', lcgRng()), /^[A-Z][a-z]{8}[A-Z][a-z]$/);
  });

  it('keeps punctuation and whitespace exactly where they were', () => {
    assert.strictEqual(randomize('3.14', zeroRng), '0.00');
    assert.strictEqual(randomize('Bob@x.io', zeroRng), 'Aaa@a.aa');
    assert.strictEqual(randomize('a-b c_d!', maxRng), 'z-z z_z!');
    assert.match(randomize('+63 (917) 555-0142', lcgRng()), /^\+\d\d \(\d\d\d\) \d\d\d-\d\d\d\d$/);
  });

  it('passes multi-line text through with its line structure intact', () => {
    assert.strictEqual(randomize('ab\ncd\r\nef', zeroRng), 'aa\naa\r\naa');
  });

  it('passes non-ASCII text through unchanged (accents, CJK, emoji)', () => {
    assert.strictEqual(randomize('héllo 日本 😀', zeroRng), 'aéaaa 日本 😀');
    // for…of iterates code points, so the surrogate pair is never split.
    assert.strictEqual(randomize('😀', lcgRng()), '😀');
  });

  it('returns an empty string for an empty string, without drawing', () => {
    const { rng, bounds } = recordingRng();
    assert.strictEqual(randomize('', rng), '');
    assert.deepStrictEqual(bounds, []);
  });

  it('draws once per alphanumeric character, with the class-sized bound', () => {
    const { rng, bounds } = recordingRng();
    randomize('5aZ - ok', rng);
    // '5' → 10, 'a' → 26, 'Z' → 26, then 'o' and 'k'; ' ', '-' never draw.
    assert.deepStrictEqual(bounds, [ 10, 26, 26, 26, 26 ]);
  });

  it('characters adjacent to the ASCII ranges are left alone', () => {
    // '/' and ':' bracket the digits; '@' and '[' bracket A–Z; '`' and '{' bracket a–z.
    assert.strictEqual(randomize('/:@[`{', lcgRng()), '/:@[`{');
  });

  it('preserves length for any BMP input', () => {
    const input = 'The 39 quick brown foxes — jumped!';
    assert.strictEqual(randomize(input, lcgRng()).length, input.length);
  });
});
