/**
 * The pure halves of "Insert Random: Randomize Selection" (anonymize in place).
 *
 * `detect(text)` — type-aware replace: a selection that IS an unambiguous
 * email / UUID / ISO date / ISO timestamp is upgraded to a fresh realistic fake
 * of the same type (the extension draws it through faker); `shapeUuid` /
 * `shapeTimestamp` dress that fresh draw like the original (case, braces,
 * millisecond precision).
 *
 * `randomize(text, rng)` — the format-preserving fallback for everything else:
 * every digit becomes a random digit, every a–z letter a random lowercase
 * letter, every A–Z letter a random uppercase letter; everything else
 * (punctuation, whitespace, non-ASCII) passes through unchanged. So "3.14" →
 * "8.77" — the shape survives, the content doesn't. Numbers are deliberately
 * NOT detected: this fallback already yields a fresh same-shape number.
 */

/** Returns an integer in `[0, bound)`. Injected so the module stays `vscode`-free
 * and the caller picks the randomness source — the extension wraps the shared
 * seeded faker instance, tests script it. */
export type Rng = (bound: number) => number;

const DIGITS = '0123456789';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/** A selection value type that gets a typed redraw instead of a scramble. */
export type DetectedType = 'email' | 'uuid' | 'isoDate' | 'isoTimestamp';

const EMAIL = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9-]+(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}$/;
const UUID = /^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$/;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;
const ISO_TIMESTAMP = /^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2}):(\d{2})(\.\d{1,3})?Z$/;

/** True when `YYYY-MM-DD` names a real calendar day — V8's Date would roll
 * 2026-02-31 over to March instead of rejecting it, so the check is explicit. */
function isCalendarDate(date: string): boolean {
  const [ year, month, day ] = date.split('-').map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/**
 * Detect whether a selection IS one of the typed values, whole-string and
 * unpadded — deliberately conservative, because a false positive replaces the
 * user's text with the wrong kind of value while the scramble is always safe.
 * Anything not matched exactly returns undefined and falls back to
 * {@link randomize}.
 */
export function detect(text: string): DetectedType | undefined {
  if (EMAIL.test(text)) { return 'email'; }
  const core = text.startsWith('{') && text.endsWith('}') ? text.slice(1, -1) : text;
  if (UUID.test(core)) { return 'uuid'; }
  if (ISO_DATE.test(text)) { return isCalendarDate(text) ? 'isoDate' : undefined; }
  const stamp = ISO_TIMESTAMP.exec(text);
  if (stamp) {
    const [ , date, hours, minutes, seconds ] = stamp;
    const timeValid = Number(hours) <= 23 && Number(minutes) <= 59 && Number(seconds) <= 59;
    return timeValid && isCalendarDate(date) ? 'isoTimestamp' : undefined;
  }
  return undefined;
}

/** Dress a fresh lowercase-dashed uuid like the original selection: keep its
 * braces, and go uppercase when the original's hex letters were uniformly
 * uppercase (no letters, or mixed case, stays lowercase). */
export function shapeUuid(fresh: string, original: string): string {
  const uppercase = /[A-F]/.test(original) && !/[a-f]/.test(original);
  const cased = uppercase ? fresh.toUpperCase() : fresh;
  return original.startsWith('{') && original.endsWith('}') ? `{${cased}}` : cased;
}

/** Match a fresh `toISOString()` rendering to the original's millisecond
 * precision: strip the `.mmm` when the original carried none. */
export function shapeTimestamp(freshIso: string, original: string): string {
  return original.includes('.') ? freshIso : freshIso.replace(/\.\d{3}Z$/, 'Z');
}

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
