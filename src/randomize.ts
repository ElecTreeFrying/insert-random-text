/**
 * Format-preserving randomization — the pure half of "Insert Random: Randomize
 * Selection" (anonymize in place). Every digit becomes a random digit, every
 * a–z letter a random lowercase letter, every A–Z letter a random uppercase
 * letter; everything else (punctuation, whitespace, non-ASCII) passes through
 * unchanged. So "3.14" → "8.77" and "Bob@x.io" → "Kqe@v.zt" — the shape
 * survives, the content doesn't.
 */

/** Returns an integer in `[0, bound)`. Injected so the module stays `vscode`-free
 * and the caller picks the randomness source — the extension wraps the shared
 * seeded faker instance, tests script it. */
export type Rng = (bound: number) => number;

const DIGITS = '0123456789';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** Randomize `text` per character, one fresh `rng` draw per digit or ASCII letter.
 * Iterates code points (`for…of`), so surrogate pairs are never split. */
export function randomize(text: string, rng: Rng): string {
  let result = '';
  for (const char of text) {
    if (char >= '0' && char <= '9') {
      result += DIGITS[rng(10)];
    } else if (char >= 'a' && char <= 'z') {
      result += LOWER[rng(26)];
    } else if (char >= 'A' && char <= 'Z') {
      result += UPPER[rng(26)];
    } else {
      result += char;
    }
  }
  return result;
}
