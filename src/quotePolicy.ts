/**
 * Automatic, language-aware quote policy: resolve the quote character + escape
 * style that makes an inserted value land as *valid syntax for the file's
 * language*. Pure by design — no `vscode` import — so it can be exercised in
 * isolation.
 *
 * The generated value is universal; only the **wrapping** is language-specific.
 * Quoting is automatic and unconditional (there is no user quote-style setting),
 * and the rules collapse into just two cases:
 *
 * - **SQL family** — string literals are single-quoted, and an embedded `'` is
 *   escaped by *doubling* it (`''`), not with a backslash.
 * - **Everything else** — JS/TS, Python, JSON, Go, Java, Rust, … and every
 *   unlisted language (and the no-editor case) — uses double quotes with
 *   backslash escaping. Double is a valid string literal in every mainstream
 *   language (and the only legal quote in JSON / Go / Java / Rust / …), and it
 *   leaves apostrophe-heavy values (`O'Brien`, contractions) unescaped.
 */

/** How the quote character is escaped when it appears inside a value. */
export type EscapeStyle = 'backslash' | 'sqlDouble';

/** The effective quote + escape resolved for a file's language. */
export interface QuotePolicy {
  /** The quote character to wrap with (`''` = no wrapping). */
  quote: string;
  /** How to escape the quote character inside the value. */
  escape: EscapeStyle;
}

/**
 * SQL dialects: string literals are single-quoted, but an embedded `'` is
 * escaped by doubling it (`''`) rather than backslashing it.
 */
const SQL_FAMILY: ReadonlySet<string> = new Set([
  'sql', 'mysql', 'pgsql', 'plsql', 'sqlite',
]);

/**
 * Resolve the effective quote + escape for a file's language.
 *
 * `languageId` is `undefined` when there is no active editor (e.g. a clipboard
 * insert with nothing focused); that falls through to the double-quote default.
 */
export function resolveQuotePolicy(
  languageId: string | undefined,
  opts: { withQuote: boolean },
): QuotePolicy {
  // No wrapping at all.
  if (!opts.withQuote) {
    return { quote: '', escape: 'backslash' };
  }
  // SQL is the one family that needs single quotes + doubling to stay valid.
  if (languageId !== undefined && SQL_FAMILY.has(languageId)) {
    return { quote: "'", escape: 'sqlDouble' };
  }
  // Everything else — double quotes are valid everywhere and apostrophe-clean.
  return { quote: '"', escape: 'backslash' };
}
