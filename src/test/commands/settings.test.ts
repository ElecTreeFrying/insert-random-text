import * as assert from 'assert';
import * as vscode from 'vscode';

import { SETTING_COMMANDS } from '../../settingsCommands';
import { ConfigKey } from '../../configuration';

// settingsCommands.ts writes settings from the palette. Handlers that show UI (Quick Pick / input box /
// modal) are driven by temporarily swapping the matching vscode.window prompt (no Sinon in this repo),
// restored in a finally. Toggles show no UI and are called directly. All writes land in Global config in
// the test host (no folder open); afterEach clears them so nothing leaks between tests or across runs.
function get<T>(key: string): T | undefined {
  return vscode.workspace.getConfiguration().get<T>(key);
}

function setGlobal(key: string, value: unknown): Thenable<void> {
  return vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);
}

const clear = (key: string) => setGlobal(key, undefined);

describe('settingsCommands — toggles (no UI)', () => {
  afterEach(async () => {
    await clear(ConfigKey.UNIQUE_PER_CURSOR);
  });

  it('toggleUniquePerCursor flips the boolean', async () => {
    await setGlobal(ConfigKey.UNIQUE_PER_CURSOR, false);
    await SETTING_COMMANDS['insertRandomText.toggleUniquePerCursor']();
    assert.strictEqual(get(ConfigKey.UNIQUE_PER_CURSOR), true);
  });
});

describe('settingsCommands — enum picker (setInsertType)', () => {
  afterEach(async () => { await clear(ConfigKey.INSERT_TYPE); });

  it('writes the chosen value from the Quick Pick', async () => {
    const original = vscode.window.showQuickPick;
    // The stub receives the (thenable) items and returns the one whose value is 'Top'.
    (vscode.window as any).showQuickPick = async (items: any) => (await items).find((i: any) => i.value === 'Top');
    try {
      await SETTING_COMMANDS['insertRandomText.setInsertType']();
      assert.strictEqual(get(ConfigKey.INSERT_TYPE), 'Top');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
  });

  it('writes nothing when the Quick Pick is dismissed', async () => {
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async () => undefined;
    try {
      await SETTING_COMMANDS['insertRandomText.setInsertType']();
      // `get()` would return the package.json default ('Cursor'); the real invariant is that no global
      // override was written, so inspect the override itself.
      const override = vscode.workspace.getConfiguration().inspect(ConfigKey.INSERT_TYPE)?.globalValue;
      assert.strictEqual(override, undefined, 'a dismissed picker must not write a global override');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
  });
});

describe('settingsCommands — input box (setSeed)', () => {
  afterEach(async () => { await clear(ConfigKey.SEED); });

  it('writes the entered seed', async () => {
    const original = vscode.window.showInputBox;
    (vscode.window as any).showInputBox = async () => '42';
    try {
      await SETTING_COMMANDS['insertRandomText.setSeed']();
      assert.strictEqual(get(ConfigKey.SEED), '42');
    } finally {
      (vscode.window as any).showInputBox = original;
    }
  });
});

describe('settingsCommands — reset (modal confirm)', () => {
  afterEach(async () => { await clear(ConfigKey.BULK_COUNT); });

  it('clears overrides when confirmed', async () => {
    await setGlobal(ConfigKey.BULK_COUNT, 7);
    assert.strictEqual(get(ConfigKey.BULK_COUNT), 7);

    const original = vscode.window.showWarningMessage;
    (vscode.window as any).showWarningMessage = async () => 'Reset';
    try {
      await SETTING_COMMANDS['insertRandomText.resetSettings']();
    } finally {
      (vscode.window as any).showWarningMessage = original;
    }
    assert.strictEqual(get<number>(ConfigKey.BULK_COUNT), 1, 'reset should restore the package.json default (1)');
  });

  it('does nothing when the confirm is dismissed', async () => {
    await setGlobal(ConfigKey.BULK_COUNT, 7);
    const original = vscode.window.showWarningMessage;
    (vscode.window as any).showWarningMessage = async () => undefined;
    try {
      await SETTING_COMMANDS['insertRandomText.resetSettings']();
    } finally {
      (vscode.window as any).showWarningMessage = original;
    }
    assert.strictEqual(get(ConfigKey.BULK_COUNT), 7, 'a dismissed confirm must leave settings unchanged');
  });
});

describe('settingsCommands — input validation', () => {
  // The set* input handlers hand a validateInput callback to showInputBox; capture it (the stub returns
  // undefined, so nothing is written) and exercise the validator directly with valid + invalid inputs.
  async function captureValidator(commandId: string): Promise<(value: string) => any> {
    let validate: ((value: string) => any) | undefined;
    const original = vscode.window.showInputBox;
    (vscode.window as any).showInputBox = async (opts: any) => { validate = opts.validateInput; return undefined; };
    try {
      await SETTING_COMMANDS[commandId]();
    } finally {
      (vscode.window as any).showInputBox = original;
    }
    assert.ok(validate, `${commandId} should supply a validateInput`);
    return validate!;
  }

  it('setBulkCount accepts whole numbers 1–1000 and rejects the rest', async () => {
    const validate = await captureValidator('insertRandomText.setBulkCount');
    assert.strictEqual(validate('1'), undefined);
    assert.strictEqual(validate('1000'), undefined);
    assert.ok(validate('0'), 'below range → error');
    assert.ok(validate('1001'), 'above range → error');
    assert.ok(validate('2.5'), 'non-integer → error');
    assert.ok(validate('abc'), 'non-number → error');
  });

  it('setSeed accepts a number or blank and rejects non-numbers', async () => {
    const validate = await captureValidator('insertRandomText.setSeed');
    assert.strictEqual(validate('42'), undefined);
    assert.strictEqual(validate('   '), undefined, 'blank (whitespace) is allowed');
    assert.strictEqual(validate(''), undefined);
    assert.ok(validate('abc'), 'non-number → error');
  });
});

describe('settingsCommands — remaining command wirings', () => {
  // Each SETTING_COMMANDS entry binds a command id to a specific (key, options); a copy-paste slip would
  // wire a command to the wrong setting. These pin the last few that reuse the shared toggle/enum paths.
  it('toggleQuotes flips withQuote', async () => {
    await setGlobal(ConfigKey.WITH_QUOTE, true);
    await SETTING_COMMANDS['insertRandomText.toggleQuotes']();
    assert.strictEqual(get(ConfigKey.WITH_QUOTE), false);
    await clear(ConfigKey.WITH_QUOTE);
  });

  it('toggleNewLine flips withNewLine', async () => {
    await setGlobal(ConfigKey.WITH_NEW_LINE, true);
    await SETTING_COMMANDS['insertRandomText.toggleNewLine']();
    assert.strictEqual(get(ConfigKey.WITH_NEW_LINE), false);
    await clear(ConfigKey.WITH_NEW_LINE);
  });

  it('toggleContextMenu flips the context-menu setting', async () => {
    await setGlobal('insertRandomText.contextMenu.enabled', false);
    await SETTING_COMMANDS['insertRandomText.toggleContextMenu']();
    assert.strictEqual(get('insertRandomText.contextMenu.enabled'), true);
    await clear('insertRandomText.contextMenu.enabled');
  });

  it('setOutputFormat writes the chosen format', async () => {
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async (items: any) => (await items).find((i: any) => i.value === 'jsonArray');
    try {
      await SETTING_COMMANDS['insertRandomText.setOutputFormat']();
      assert.strictEqual(get(ConfigKey.OUTPUT_FORMAT), 'jsonArray');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    await clear(ConfigKey.OUTPUT_FORMAT);
  });

  it('setInsertType floats the current value to the top of the picker, marked', async () => {
    await setGlobal(ConfigKey.INSERT_TYPE, 'Top'); // 'Top' is not first in the option list.
    let captured: any[] = [];
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async (items: any) => { captured = await items; return undefined; };
    try {
      await SETTING_COMMANDS['insertRandomText.setInsertType']();
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    assert.strictEqual(captured[0].value, 'Top', 'the current value should float to the top');
    assert.ok(String(captured[0].description).includes('Current'), 'the current option should be marked');
    await clear(ConfigKey.INSERT_TYPE);
  });

  it('setRecordFormat writes the chosen record shape', async () => {
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async (items: any) => (await items).find((i: any) => i.value === 'csv');
    try {
      await SETTING_COMMANDS['insertRandomText.setRecordFormat']();
      assert.strictEqual(get(ConfigKey.RECORD_FORMAT), 'csv');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    await clear(ConfigKey.RECORD_FORMAT);
  });

  it('setLocale writes the chosen locale', async () => {
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async (items: any) => (await items).find((i: any) => i.value === 'de');
    try {
      await SETTING_COMMANDS['insertRandomText.setLocale']();
      assert.strictEqual(get(ConfigKey.LOCALE), 'de');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    await clear(ConfigKey.LOCALE);
  });

  it('setDateFormat writes the chosen date format', async () => {
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async (items: any) => (await items).find((i: any) => i.value === 'unixMillis');
    try {
      await SETTING_COMMANDS['insertRandomText.setDateFormat']();
      assert.strictEqual(get(ConfigKey.DATE_FORMAT), 'unixMillis');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    await clear(ConfigKey.DATE_FORMAT);
  });

  it('setBulkCount writes the entered count as a number', async () => {
    const original = vscode.window.showInputBox;
    (vscode.window as any).showInputBox = async () => '7';
    try {
      await SETTING_COMMANDS['insertRandomText.setBulkCount']();
      // strictEqual pins the Number() conversion — writing the raw string '7' would fail here.
      assert.strictEqual(get<number>(ConfigKey.BULK_COUNT), 7);
    } finally {
      (vscode.window as any).showInputBox = original;
    }
    await clear(ConfigKey.BULK_COUNT);
  });

  it('setRecordSqlTable writes the entered table name, trimmed', async () => {
    const original = vscode.window.showInputBox;
    (vscode.window as any).showInputBox = async () => '  users  ';
    try {
      await SETTING_COMMANDS['insertRandomText.setRecordSqlTable']();
      assert.strictEqual(get(ConfigKey.RECORD_SQL_TABLE), 'users', 'the table name should be trimmed on write');
    } finally {
      (vscode.window as any).showInputBox = original;
    }
    await clear(ConfigKey.RECORD_SQL_TABLE);
  });
});
