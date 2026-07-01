import * as assert from 'assert';
import * as vscode from 'vscode';

import { ConfigKey } from '../../configuration';

// The prompted commands end-to-end through executeCommand: input boxes (stubbed) → one-off generator →
// the normal insert pipeline. Suite baseline mirrors insert.test.ts: quotes + newline OFF and a pinned
// seed, so assertions are exact; pinned ranges (min = max) pin the inserted value outright.
const EXTENSION_ID = 'ElecTreeFrying.insert-random-text';
const NUMBER_RANGE = 'insertRandomText.numberRange';
const FLOAT_RANGE = 'insertRandomText.floatRange';
const STRING_LENGTH = 'insertRandomText.stringLength';
const DATE_BETWEEN = 'insertRandomText.dateBetween';

async function setConfig(key: string, value: unknown): Promise<void> {
  const changed = new Promise<void>((resolve) => {
    const sub = vscode.workspace.onDidChangeConfiguration((event) => {
      if (event.affectsConfiguration(key)) { sub.dispose(); resolve(); }
    });
    setTimeout(() => { sub.dispose(); resolve(); }, 500);
  });
  await vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);
  await changed;
}

async function openDoc(content: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({ content });
  return vscode.window.showTextDocument(doc);
}

/** Stub showInputBox with a scripted answer per box (undefined = Esc); records each box's options. */
function stubInputBox(answers: readonly (string | undefined)[]): { received: vscode.InputBoxOptions[]; restore(): void } {
  const original = vscode.window.showInputBox;
  const received: vscode.InputBoxOptions[] = [];
  (vscode.window as any).showInputBox = async (options: vscode.InputBoxOptions) => {
    received.push(options);
    return answers[received.length - 1];
  };
  return { received, restore: () => { (vscode.window as any).showInputBox = original; } };
}

async function runPromptedCommand(command: string, answers: readonly (string | undefined)[]): Promise<vscode.InputBoxOptions[]> {
  const stub = stubInputBox(answers);
  try {
    await vscode.commands.executeCommand(command);
  } finally {
    stub.restore();
  }
  return stub.received;
}

describe('prompted commands — input boxes → normal pipeline', function () {
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    await setConfig(ConfigKey.WITH_QUOTE, false);
    await setConfig(ConfigKey.WITH_NEW_LINE, false);
    await setConfig(ConfigKey.SEED, '31415');
  });

  after(async () => {
    await setConfig(ConfigKey.WITH_QUOTE, undefined);
    await setConfig(ConfigKey.WITH_NEW_LINE, undefined);
    await setConfig(ConfigKey.SEED, undefined);
  });

  afterEach(async () => {
    await setConfig(ConfigKey.INSERT_TYPE, undefined); // back to the default 'Cursor'.
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('Number (Range…) inserts the pinned value when min = max', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(NUMBER_RANGE, [ '5', '5' ]);
    assert.strictEqual(editor.document.getText(), '5');
  });

  it('Number (Range…) stays within the entered range', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(NUMBER_RANGE, [ '1', '3' ]);
    const value = Number(editor.document.getText());
    assert.ok(Number.isInteger(value) && value >= 1 && value <= 3, `${value} outside [1, 3]`);
  });

  it('Float (Range…) renders two decimals through the pipeline', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(FLOAT_RANGE, [ '2', '2' ]);
    assert.strictEqual(editor.document.getText(), '2.00');
  });

  it('String (Length…) inserts exactly N alphanumeric characters', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(STRING_LENGTH, [ '12' ]);
    assert.match(editor.document.getText(), /^[A-Za-z0-9]{12}$/);
  });

  it('Date (Between…) inserts the pinned instant when from = to (full ISO by default)', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(DATE_BETWEEN, [ '2020-06-15', '2020-06-15' ]);
    assert.strictEqual(editor.document.getText(), '2020-06-15T00:00:00.000Z');
  });

  it('Date (Between…) stays within the entered range', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(DATE_BETWEEN, [ '2020-01-01', '2020-12-31' ]);
    const text = editor.document.getText();
    const drawn = new Date(text).getTime();
    assert.ok(
      drawn >= Date.parse('2020-01-01T00:00:00Z') && drawn <= Date.parse('2020-12-31T00:00:00Z'),
      `${text} outside [from, to]`,
    );
  });

  it('Date (Between…) renders per the dateFormat setting — the pipeline threads it in', async () => {
    await setConfig(ConfigKey.DATE_FORMAT, 'unixSeconds');
    const editor = await openDoc('');
    await runPromptedCommand(DATE_BETWEEN, [ '2020-06-15', '2020-06-15' ]);
    await setConfig(ConfigKey.DATE_FORMAT, undefined); // restore the suite baseline.
    assert.strictEqual(editor.document.getText(), String(Date.parse('2020-06-15T00:00:00Z') / 1000));
  });

  it('Esc at the first box cancels cleanly — nothing inserted, no error', async () => {
    const editor = await openDoc('');
    await assert.doesNotReject(async () => { await runPromptedCommand(NUMBER_RANGE, [ undefined ]); });
    assert.strictEqual(editor.document.getText(), '', 'a cancelled prompt must insert nothing');
  });

  it('Esc at the second box cancels cleanly too (min already accepted)', async () => {
    const editor = await openDoc('');
    await assert.doesNotReject(async () => { await runPromptedCommand(NUMBER_RANGE, [ '1', undefined ]); });
    assert.strictEqual(editor.document.getText(), '', 'a mid-flow cancel must insert nothing');
  });

  it('Esc at the second date box cancels cleanly (from already accepted)', async () => {
    const editor = await openDoc('');
    await assert.doesNotReject(async () => { await runPromptedCommand(DATE_BETWEEN, [ '2020-01-01', undefined ]); });
    assert.strictEqual(editor.document.getText(), '', 'a mid-flow cancel must insert nothing');
  });

  it('fills every cursor with a fresh value (multi-cursor)', async () => {
    const editor = await openDoc('\n'); // two empty lines.
    editor.selections = [ new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 0, 1, 0) ];
    await runPromptedCommand(NUMBER_RANGE, [ '1', '1000000' ]);
    const [ line0, line1 ] = editor.document.getText().split('\n');
    assert.ok(line0.length > 0 && line1.length > 0, 'both cursors should receive a value');
    assert.notStrictEqual(line0, line1, 'uniquePerCursor (default) → distinct values per cursor');
  });

  it('is reproducible under the pinned seed (applySeed runs after the prompts)', async () => {
    const first = await openDoc('');
    await runPromptedCommand(NUMBER_RANGE, [ '1', '1000000' ]);
    const a = first.document.getText();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const second = await openDoc('');
    await runPromptedCommand(NUMBER_RANGE, [ '1', '1000000' ]);
    const b = second.document.getText();
    assert.strictEqual(a, b, 'same seed + same inputs → same inserted value');
  });

  it('remembers the last accepted inputs (trimmed) and prefills the next run', async () => {
    await openDoc('');
    await runPromptedCommand(NUMBER_RANGE, [ ' 7 ', '9' ]);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await openDoc('');
    const received = await runPromptedCommand(NUMBER_RANGE, [ '7', '9' ]);
    assert.strictEqual(received[0].value, '7', 'min box should prefill the last accepted min, trimmed');
    assert.strictEqual(received[1].value, '9', 'max box should prefill the last accepted max');
  });

  it('honors the quote policy — a String (Length…) in a JSON file arrives double-quoted', async () => {
    await setConfig(ConfigKey.WITH_QUOTE, true);
    const doc = await vscode.workspace.openTextDocument({ language: 'json', content: '' });
    const editor = await vscode.window.showTextDocument(doc);
    await runPromptedCommand(STRING_LENGTH, [ '8' ]);
    await setConfig(ConfigKey.WITH_QUOTE, false); // restore the suite baseline.
    assert.match(editor.document.getText(), /^"[A-Za-z0-9]{8}"$/);
  });

  it('honors bulkCount — one block of N values at the cursor', async () => {
    await setConfig(ConfigKey.BULK_COUNT, 3);
    const editor = await openDoc('');
    await runPromptedCommand(STRING_LENGTH, [ '6' ]);
    await setConfig(ConfigKey.BULK_COUNT, undefined);
    const lines = editor.document.getText().split('\n');
    assert.strictEqual(lines.length, 3, 'plain bulk 3 → three lines');
    for (const line of lines) { assert.match(line, /^[A-Za-z0-9]{6}$/); }
  });

  it('honors Clipboard mode — document untouched, value copied', async () => {
    await setConfig(ConfigKey.INSERT_TYPE, 'Clipboard');
    await vscode.env.clipboard.writeText('SENTINEL');
    const editor = await openDoc('untouched');
    await runPromptedCommand(NUMBER_RANGE, [ '5', '5' ]);
    assert.strictEqual(editor.document.getText(), 'untouched', 'Clipboard mode must not modify the document');
    assert.strictEqual(await vscode.env.clipboard.readText(), '5');
  });
});
