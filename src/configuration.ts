/** The narrow slice of `vscode.workspace` this reader needs (kept minimal so it
 * can be substituted in isolation). */
export interface WorkspaceLike {
  getConfiguration(): { get<T>(section: string): T | undefined };
}

// The two user-facing enum settings store display strings; these are the values
// that map to `true`.
const QUOTE_STYLE_SINGLE = 'Single quotes';
const INSERT_TYPE_CURSOR = 'Cursor';

/** The fully-resolved settings the extension runs on. */
export interface Settings {
  /** `true` = single quotes, `false` = double. */
  quoteStyle: boolean;
  /** `true` = insert at the cursor, `false` = insert at the top of the file. */
  insertType: boolean;
  withQuote: boolean;
  withNewLine: boolean;
  uniquePerCursor: boolean;
  seed: string;
  bulkCount: number;
  outputFormat: string;
}

/** Configuration keys, exactly as declared in `package.json` `contributes.configuration`. */
export const ConfigKey = {
  QUOTE_STYLE: 'quoteStyle',
  INSERT_TYPE: 'insertType',
  WITH_QUOTE: 'withQuote',
  WITH_NEW_LINE: 'withNewLine',
  UNIQUE_PER_CURSOR: 'insertRandomText.uniquePerCursor',
  SEED: 'insertRandomText.seed',
  BULK_COUNT: 'insertRandomText.bulkCount',
  OUTPUT_FORMAT: 'insertRandomText.outputFormat',
} as const;

/**
 * Reads the extension's settings from the workspace. Each getter resolves one
 * key (with a safe default); {@link read} snapshots them all into a {@link Settings}.
 * The two enum settings are normalized to booleans here, so the rest of the code
 * never deals with display strings.
 */
export class Configuration {
  constructor(private readonly workspace: WorkspaceLike) {}

  /** Snapshot every setting into a plain {@link Settings} object. */
  read(): Settings {
    return {
      quoteStyle: this.quoteStyle,
      insertType: this.insertType,
      withQuote: this.withQuote,
      withNewLine: this.withNewLine,
      uniquePerCursor: this.uniquePerCursor,
      seed: this.seed,
      bulkCount: this.bulkCount,
      outputFormat: this.outputFormat,
    };
  }

  private value<T>(key: string): T | undefined {
    return this.workspace.getConfiguration().get<T>(key);
  }

  get quoteStyle(): boolean { return this.value<string>(ConfigKey.QUOTE_STYLE) === QUOTE_STYLE_SINGLE; }
  get insertType(): boolean { return this.value<string>(ConfigKey.INSERT_TYPE) === INSERT_TYPE_CURSOR; }
  get withQuote(): boolean { return this.value<boolean>(ConfigKey.WITH_QUOTE) ?? true; }
  get withNewLine(): boolean { return this.value<boolean>(ConfigKey.WITH_NEW_LINE) ?? true; }
  get uniquePerCursor(): boolean { return this.value<boolean>(ConfigKey.UNIQUE_PER_CURSOR) ?? true; }
  get seed(): string { return this.value<string>(ConfigKey.SEED) ?? ''; }
  get bulkCount(): number { return this.value<number>(ConfigKey.BULK_COUNT) ?? 1; }
  get outputFormat(): string { return this.value<string>(ConfigKey.OUTPUT_FORMAT) ?? 'plain'; }
}
