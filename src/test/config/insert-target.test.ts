import * as assert from 'assert';

import { Configuration, ConfigKey, WorkspaceLike } from '../../configuration';

// Configuration reads through a WorkspaceLike seam (a plain map stands in for
// vscode.workspace.getConfiguration()), so the whole settings surface is testable without booting VS
// Code. This covers the insertType enum→target mapping (incl. the newer Clipboard target) plus every
// default that applies when a key is unset.
function workspaceWith(values: Record<string, unknown>): WorkspaceLike {
  return {
    getConfiguration() {
      return {
        get<T>(section: string): T | undefined {
          return values[section] as T | undefined;
        },
      };
    },
  };
}

function read(values: Record<string, unknown>) {
  return new Configuration(workspaceWith(values)).read();
}

/** Read through an injected warn sink — the validators log every dropped entry there. (The sink is a
 * constructor seam, not a console swap: the extension host's patched console resists reassignment.) */
function readCapturing(values: Record<string, unknown>): { settings: ReturnType<Configuration['read']>; warnings: string[] } {
  const warnings: string[] = [];
  const settings = new Configuration(workspaceWith(values), (message) => warnings.push(message)).read();
  return { settings, warnings };
}

describe('configuration — insertType (enum → target)', () => {
  it("'Cursor' → 'cursor'", () => {
    assert.strictEqual(read({ [ConfigKey.INSERT_TYPE]: 'Cursor' }).insertType, 'cursor');
  });

  it("'Top' → 'top'", () => {
    assert.strictEqual(read({ [ConfigKey.INSERT_TYPE]: 'Top' }).insertType, 'top');
  });

  it("'Clipboard' → 'clipboard'", () => {
    assert.strictEqual(read({ [ConfigKey.INSERT_TYPE]: 'Clipboard' }).insertType, 'clipboard');
  });

  it("unset → 'cursor' (default)", () => {
    assert.strictEqual(read({}).insertType, 'cursor');
  });

  it("an unknown value → 'cursor' (safe fallback)", () => {
    assert.strictEqual(read({ [ConfigKey.INSERT_TYPE]: 'Bogus' }).insertType, 'cursor');
  });
});

describe('configuration — dateFormat (validated enum)', () => {
  it("unset → 'iso' (default)", () => {
    assert.strictEqual(read({}).dateFormat, 'iso');
  });

  it('every declared value passes through', () => {
    for (const value of [ 'iso', 'isoDate', 'isoTime', 'unixSeconds', 'unixMillis' ]) {
      assert.strictEqual(read({ [ConfigKey.DATE_FORMAT]: value }).dateFormat, value);
    }
  });

  it("an unknown value → 'iso' (safe fallback)", () => {
    assert.strictEqual(read({ [ConfigKey.DATE_FORMAT]: 'YYYY/MM/DD' }).dateFormat, 'iso');
  });
});

// The two settings-defined data pools (S7) are user-edited JSON objects, so the reader must survive any
// shape: junk entries are dropped (never thrown on) and each drop is logged to the console.
describe('configuration — templates (validated object)', () => {
  it('unset → {} (default)', () => {
    assert.deepStrictEqual(read({}).templates, {});
  });

  it('string-valued entries pass through, declaration order preserved', () => {
    const templates = { invoice: 'INV-{{string.numeric(4)}}', contact: '{{person.fullName}} <{{internet.email}}>' };
    const result = read({ [ConfigKey.TEMPLATES]: templates }).templates;
    assert.deepStrictEqual(result, templates);
    assert.deepStrictEqual(Object.keys(result), [ 'invoice', 'contact' ]);
  });

  it('drops non-string values and keeps the rest', () => {
    const { settings } = readCapturing({
      [ConfigKey.TEMPLATES]: { ok: '{{internet.email}}', num: 42, nil: null, arr: [ 'x' ], obj: { a: 1 }, bool: true },
    });
    assert.deepStrictEqual(settings.templates, { ok: '{{internet.email}}' });
  });

  it('drops empty and whitespace-only template strings', () => {
    const { settings } = readCapturing({ [ConfigKey.TEMPLATES]: { ok: 'x', empty: '', blank: '   ' } });
    assert.deepStrictEqual(settings.templates, { ok: 'x' });
  });

  it('drops entries with an empty name', () => {
    const { settings } = readCapturing({ [ConfigKey.TEMPLATES]: { '': 'x', '  ': 'y', ok: 'z' } });
    assert.deepStrictEqual(settings.templates, { ok: 'z' });
  });

  it('a non-object value → {} (safe fallback)', () => {
    assert.deepStrictEqual(readCapturing({ [ConfigKey.TEMPLATES]: 'nope' }).settings.templates, {});
    assert.deepStrictEqual(readCapturing({ [ConfigKey.TEMPLATES]: [ 'a', 'b' ] }).settings.templates, {});
    assert.deepStrictEqual(readCapturing({ [ConfigKey.TEMPLATES]: null }).settings.templates, {});
  });

  it('logs a warning naming each dropped entry', () => {
    const { warnings } = readCapturing({ [ConfigKey.TEMPLATES]: { ok: 'x', broken: 42 } });
    assert.strictEqual(warnings.length, 1, 'exactly the dropped entry should be logged');
    assert.match(warnings[0], /broken/, 'the warning should name the dropped entry');
  });
});

describe('configuration — customLists (validated object)', () => {
  it('unset → {} (default)', () => {
    assert.deepStrictEqual(read({}).customLists, {});
  });

  it('string-array entries pass through, declaration order preserved', () => {
    const lists = { environment: [ 'dev', 'staging', 'production' ], team: [ 'ada', 'grace' ] };
    const result = read({ [ConfigKey.CUSTOM_LISTS]: lists }).customLists;
    assert.deepStrictEqual(result, lists);
    assert.deepStrictEqual(Object.keys(result), [ 'environment', 'team' ]);
  });

  it('filters non-string items out of a mixed list', () => {
    const { settings, warnings } = readCapturing({ [ConfigKey.CUSTOM_LISTS]: { mixed: [ 'a', 3, 'b', null ] } });
    assert.deepStrictEqual(settings.customLists, { mixed: [ 'a', 'b' ] });
    assert.strictEqual(warnings.length, 1);
    assert.match(warnings[0], /mixed/, 'the warning should name the filtered list');
  });

  it('drops a non-array value, an empty list, and a list with no string items', () => {
    const { settings } = readCapturing({
      [ConfigKey.CUSTOM_LISTS]: { ok: [ 'x' ], str: 'nope', empty: [], numbers: [ 1, 2, 3 ] },
    });
    assert.deepStrictEqual(settings.customLists, { ok: [ 'x' ] });
  });

  it('drops entries with an empty name', () => {
    const { settings } = readCapturing({ [ConfigKey.CUSTOM_LISTS]: { '': [ 'x' ], ok: [ 'y' ] } });
    assert.deepStrictEqual(settings.customLists, { ok: [ 'y' ] });
  });

  it('a non-object value → {} (safe fallback)', () => {
    assert.deepStrictEqual(readCapturing({ [ConfigKey.CUSTOM_LISTS]: 'nope' }).settings.customLists, {});
    assert.deepStrictEqual(readCapturing({ [ConfigKey.CUSTOM_LISTS]: [ 'a' ] }).settings.customLists, {});
  });

  it('logs a warning naming each dropped entry', () => {
    const { warnings } = readCapturing({ [ConfigKey.CUSTOM_LISTS]: { ok: [ 'x' ], broken: 'nope' } });
    assert.strictEqual(warnings.length, 1, 'exactly the dropped entry should be logged');
    assert.match(warnings[0], /broken/, 'the warning should name the dropped entry');
  });
});

describe('configuration — defaults when unset', () => {
  it('every setting falls back to its default when unset', () => {
    const settings = read({});
    assert.strictEqual(settings.withQuote, true);
    assert.strictEqual(settings.withNewLine, true);
    assert.strictEqual(settings.uniquePerCursor, true);
    assert.strictEqual(settings.seed, '');
    assert.strictEqual(settings.bulkCount, 1);
    assert.strictEqual(settings.outputFormat, 'plain');
    assert.strictEqual(settings.dateFormat, 'iso');
    assert.strictEqual(settings.recordFormat, 'json');
    assert.strictEqual(settings.recordSqlTable, 'table');
    assert.deepStrictEqual(settings.templates, {});
    assert.deepStrictEqual(settings.customLists, {});
  });

  it('explicit values pass through unchanged', () => {
    const settings = read({
      [ConfigKey.WITH_QUOTE]: false,
      [ConfigKey.WITH_NEW_LINE]: false,
      [ConfigKey.UNIQUE_PER_CURSOR]: false,
      [ConfigKey.SEED]: '42',
      [ConfigKey.BULK_COUNT]: 5,
      [ConfigKey.OUTPUT_FORMAT]: 'jsonArray',
      [ConfigKey.DATE_FORMAT]: 'unixSeconds',
      [ConfigKey.RECORD_FORMAT]: 'csv',
      [ConfigKey.RECORD_SQL_TABLE]: 'users',
    });
    assert.strictEqual(settings.withQuote, false);
    assert.strictEqual(settings.withNewLine, false);
    assert.strictEqual(settings.uniquePerCursor, false);
    assert.strictEqual(settings.seed, '42');
    assert.strictEqual(settings.bulkCount, 5);
    assert.strictEqual(settings.outputFormat, 'jsonArray');
    assert.strictEqual(settings.dateFormat, 'unixSeconds');
    assert.strictEqual(settings.recordFormat, 'csv');
    assert.strictEqual(settings.recordSqlTable, 'users');
  });
});

describe('configuration — read() snapshot', () => {
  it('returns every setting key', () => {
    const keys = Object.keys(read({})).sort();
    assert.deepStrictEqual(
      keys,
      [ 'bulkCount', 'customLists', 'dateFormat', 'insertType', 'outputFormat', 'recordFormat', 'recordSqlTable', 'seed', 'templates', 'uniquePerCursor', 'withNewLine', 'withQuote' ],
    );
  });
});
