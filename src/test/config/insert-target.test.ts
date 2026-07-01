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
      [ 'bulkCount', 'dateFormat', 'insertType', 'outputFormat', 'recordFormat', 'recordSqlTable', 'seed', 'uniquePerCursor', 'withNewLine', 'withQuote' ],
    );
  });
});
