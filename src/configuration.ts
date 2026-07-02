import type { DateFormat } from './catalog';
import { LOCALES, LocaleId } from './engine';

/** The narrow slice of `vscode.workspace` this reader needs (kept minimal so it
 * can be substituted in isolation). */
export interface WorkspaceLike {
  getConfiguration(): { get<T>(section: string): T | undefined };
}

/** Where a generated value is delivered. */
export type InsertTarget = 'cursor' | 'top' | 'clipboard';

// `insertType` stores a display string; map each to its internal target.
const INSERT_TARGETS: Record<string, InsertTarget> = {
  Cursor: 'cursor',
  Top: 'top',
  Clipboard: 'clipboard',
};

// The declared `dateFormat` values; anything else falls back to the full-ISO default.
const DATE_FORMATS: readonly DateFormat[] = [ 'iso', 'isoDate', 'isoTime', 'unixSeconds', 'unixMillis' ];

/** The fully-resolved settings the extension runs on. */
export interface Settings {
  /** Where generated values are delivered: cursor, top of file, or clipboard. */
  insertType: InsertTarget;
  withQuote: boolean;
  withNewLine: boolean;
  uniquePerCursor: boolean;
  /** Re-draw duplicates within one insert wherever values are meant to differ (bounded). */
  strictUnique: boolean;
  seed: string;
  /** Which faker locale data set generators draw from. */
  locale: LocaleId;
  bulkCount: number;
  outputFormat: string;
  /** How the timestamp-emitting Time generators render their Date. */
  dateFormat: DateFormat;
  /** Structured shape for multi-field records: 'json' | 'sql' | 'csv'. */
  recordFormat: string;
  /** Table name used by the `sql` record shape. */
  recordSqlTable: string;
  /** Saved faker templates (name → template string), validated — junk entries dropped. */
  templates: Readonly<Record<string, string>>;
  /** Custom value lists (name → string[]), validated — junk entries dropped. */
  customLists: Readonly<Record<string, readonly string[]>>;
}

/** Configuration keys, exactly as declared in `package.json` `contributes.configuration`. */
export const ConfigKey = {
  INSERT_TYPE: 'insertType',
  WITH_QUOTE: 'withQuote',
  WITH_NEW_LINE: 'withNewLine',
  UNIQUE_PER_CURSOR: 'insertRandomText.uniquePerCursor',
  STRICT_UNIQUE: 'insertRandomText.strictUnique',
  SEED: 'insertRandomText.seed',
  LOCALE: 'insertRandomText.locale',
  BULK_COUNT: 'insertRandomText.bulkCount',
  OUTPUT_FORMAT: 'insertRandomText.outputFormat',
  DATE_FORMAT: 'insertRandomText.dateFormat',
  RECORD_FORMAT: 'insertRandomText.recordFormat',
  RECORD_SQL_TABLE: 'insertRandomText.recordSqlTable',
  TEMPLATES: 'insertRandomText.templates',
  CUSTOM_LISTS: 'insertRandomText.customLists',
} as const;

/** True for a plain JSON-style object — the only shape the two data-pool settings accept. */
function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

/** Console prefix for the dropped-entry warnings, so they are findable in the extension host log. */
const WARN_PREFIX = '[insert-random-text]';

/** Where a dropped-entry warning goes. Injectable (like {@link WorkspaceLike}) because the extension
 * host's patched `console` can't be monkey-swapped from a test; the default is the real console. */
export type WarnSink = (message: string) => void;

/**
 * Reads the extension's settings from the workspace. Each getter resolves one
 * key (with a safe default); {@link read} snapshots them all into a {@link Settings}.
 * The `insertType` enum is normalized to a target here, so the rest of the code
 * never deals with display strings.
 */
export class Configuration {
  constructor(
    private readonly workspace: WorkspaceLike,
    private readonly warn: WarnSink = (message) => console.warn(message),
  ) {}

  /** Snapshot every setting into a plain {@link Settings} object. */
  read(): Settings {
    return {
      insertType: this.insertType,
      withQuote: this.withQuote,
      withNewLine: this.withNewLine,
      uniquePerCursor: this.uniquePerCursor,
      strictUnique: this.strictUnique,
      seed: this.seed,
      locale: this.locale,
      bulkCount: this.bulkCount,
      outputFormat: this.outputFormat,
      dateFormat: this.dateFormat,
      recordFormat: this.recordFormat,
      recordSqlTable: this.recordSqlTable,
      templates: this.templates,
      customLists: this.customLists,
    };
  }

  private value<T>(key: string): T | undefined {
    return this.workspace.getConfiguration().get<T>(key);
  }

  get insertType(): InsertTarget { return INSERT_TARGETS[this.value<string>(ConfigKey.INSERT_TYPE) ?? 'Cursor'] ?? 'cursor'; }
  get withQuote(): boolean { return this.value<boolean>(ConfigKey.WITH_QUOTE) ?? true; }
  get withNewLine(): boolean { return this.value<boolean>(ConfigKey.WITH_NEW_LINE) ?? true; }
  get uniquePerCursor(): boolean { return this.value<boolean>(ConfigKey.UNIQUE_PER_CURSOR) ?? true; }
  get strictUnique(): boolean { return this.value<boolean>(ConfigKey.STRICT_UNIQUE) ?? false; }
  get seed(): string { return this.value<string>(ConfigKey.SEED) ?? ''; }
  get locale(): LocaleId { const value = this.value<LocaleId>(ConfigKey.LOCALE) ?? 'en'; return LOCALES.includes(value) ? value : 'en'; }
  get bulkCount(): number { return this.value<number>(ConfigKey.BULK_COUNT) ?? 1; }
  get outputFormat(): string { return this.value<string>(ConfigKey.OUTPUT_FORMAT) ?? 'plain'; }
  get dateFormat(): DateFormat { const value = this.value<DateFormat>(ConfigKey.DATE_FORMAT) ?? 'iso'; return DATE_FORMATS.includes(value) ? value : 'iso'; }
  get recordFormat(): string { return this.value<string>(ConfigKey.RECORD_FORMAT) ?? 'json'; }
  get recordSqlTable(): string { return this.value<string>(ConfigKey.RECORD_SQL_TABLE) ?? 'table'; }

  /**
   * Saved templates: name → faker template string. The object is user-edited JSON,
   * so every entry is shape-checked — a junk entry (non-string or empty value,
   * empty name) is dropped with a console warning, never thrown on. Template
   * *content* is not validated here (rendering needs the engine); a template that
   * fails to render surfaces a friendly error at insert time instead.
   */
  get templates(): Record<string, string> {
    const raw = this.value<unknown>(ConfigKey.TEMPLATES) ?? {};
    if (!isPlainObject(raw)) {
      this.warn(`${WARN_PREFIX} Ignoring ${ConfigKey.TEMPLATES}: expected an object of name → template string.`);
      return {};
    }
    const templates: Record<string, string> = {};
    for (const [ name, template ] of Object.entries(raw)) {
      if (name.trim() === '' || typeof template !== 'string' || template.trim() === '') {
        this.warn(`${WARN_PREFIX} Ignoring template "${name}": the value must be a non-empty string.`);
        continue;
      }
      templates[name] = template;
    }
    return templates;
  }

  /**
   * Custom lists: name → array of strings. Same tolerance as {@link templates}:
   * non-string items are filtered out (warned), and an entry that is not an array,
   * is left empty, or has an empty name is dropped (warned).
   */
  get customLists(): Record<string, readonly string[]> {
    const raw = this.value<unknown>(ConfigKey.CUSTOM_LISTS) ?? {};
    if (!isPlainObject(raw)) {
      this.warn(`${WARN_PREFIX} Ignoring ${ConfigKey.CUSTOM_LISTS}: expected an object of name → string array.`);
      return {};
    }
    const lists: Record<string, readonly string[]> = {};
    for (const [ name, list ] of Object.entries(raw)) {
      if (name.trim() === '' || !Array.isArray(list)) {
        this.warn(`${WARN_PREFIX} Ignoring custom list "${name}": the value must be an array of strings.`);
        continue;
      }
      const values = list.filter((item): item is string => typeof item === 'string');
      if (values.length < list.length) {
        this.warn(`${WARN_PREFIX} Custom list "${name}": dropped ${list.length - values.length} non-string value(s).`);
      }
      if (values.length === 0) {
        this.warn(`${WARN_PREFIX} Ignoring custom list "${name}": it holds no string values.`);
        continue;
      }
      lists[name] = values;
    }
    return lists;
  }
}
