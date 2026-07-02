import * as assert from 'assert';
import * as vscode from 'vscode';

import { ConfigKey } from '../../configuration';

// The prompted commands end-to-end through executeCommand: input boxes and Quick Picks (stubbed) →
// one-off generator → the normal insert pipeline. Suite baseline mirrors insert.test.ts: quotes +
// newline OFF and a pinned seed, so assertions are exact; pinned ranges (min = max) pin the value outright.
const EXTENSION_ID = 'ElecTreeFrying.insert-random-text';
const NUMBER_RANGE = 'insertRandomText.numberRange';
const FLOAT_RANGE = 'insertRandomText.floatRange';
const STRING_LENGTH = 'insertRandomText.stringLength';
const DATE_BETWEEN = 'insertRandomText.dateBetween';
const WORDS_COUNT = 'insertRandomText.wordsCount';
const SENTENCES_COUNT = 'insertRandomText.sentencesCount';
const PARAGRAPHS_COUNT = 'insertRandomText.paragraphsCount';
const UUID_FORMAT = 'insertRandomText.uuidFormat';
const PASSWORD_OPTIONS = 'insertRandomText.passwordOptions';
const PHONE_FORMAT = 'insertRandomText.phoneFormat';
const FROM_TEMPLATE = 'insertRandomText.fromTemplate';
const FROM_PATTERN = 'insertRandomText.fromPattern';

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

type ReceivedPick = { items: (vscode.QuickPickItem & { value: string })[]; options: vscode.QuickPickOptions | undefined };
interface ReceivedPrompts {
  inputs: vscode.InputBoxOptions[];
  picks: ReceivedPick[];
}

/** Stub showInputBox AND showQuickPick with one scripted answer per prompt, consumed in flow order
 * (undefined = Esc; a pick answer selects the item whose `value` matches, failing loudly on a typo).
 * A scripted box answer runs through the box's real validateInput first — a real input box would
 * refuse it, so a failing answer is a test bug and throws loudly, like the pick-typo guard.
 * Records what every box and pick received, so tests can assert prefills and item ordering. */
function stubPrompts(answers: readonly (string | undefined)[]): { received: ReceivedPrompts; restore(): void } {
  const originalInput = vscode.window.showInputBox;
  const originalPick = vscode.window.showQuickPick;
  const received: ReceivedPrompts = { inputs: [], picks: [] };
  let cursor = 0;
  (vscode.window as any).showInputBox = async (options: vscode.InputBoxOptions) => {
    received.inputs.push(options);
    const answer = answers[cursor++];
    if (answer !== undefined && options.validateInput) {
      const error = await options.validateInput(answer);
      if (error) { throw new Error(`scripted answer '${answer}' failed the box's validation: ${error}`); }
    }
    return answer;
  };
  (vscode.window as any).showQuickPick = async (items: any, options: vscode.QuickPickOptions) => {
    const resolved = await items;
    received.picks.push({ items: resolved, options });
    const answer = answers[cursor++];
    if (answer === undefined) { return undefined; }
    const picked = resolved.find((item: any) => item.value === answer);
    if (!picked) { throw new Error(`no pick option with value '${answer}' among: ${resolved.map((i: any) => i.value).join(', ')}`); }
    return picked;
  };
  return {
    received,
    restore: () => {
      (vscode.window as any).showInputBox = originalInput;
      (vscode.window as any).showQuickPick = originalPick;
    },
  };
}

async function runPromptedCommand(command: string, answers: readonly (string | undefined)[]): Promise<ReceivedPrompts> {
  const stub = stubPrompts(answers);
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

  it('Words (Count…) inserts exactly the entered number of words', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(WORDS_COUNT, [ '5' ]);
    assert.strictEqual(editor.document.getText().split(' ').length, 5);
  });

  it('Sentences (Count…) inserts exactly the entered number of sentences', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(SENTENCES_COUNT, [ '4' ]);
    const text = editor.document.getText();
    assert.strictEqual((text.match(/\./g) ?? []).length, 4, `'${text}' should hold 4 sentences`);
  });

  it('Paragraphs (Count…) inserts the entered number of newline-separated paragraphs', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(PARAGRAPHS_COUNT, [ '2' ]);
    const lines = editor.document.getText().split('\n');
    assert.strictEqual(lines.length, 2, 'count 2 → two paragraphs');
    for (const line of lines) { assert.ok(line.length > 0, 'paragraphs must be non-empty'); }
  });

  it('UUID (Format…) renders the picked format — braced', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(UUID_FORMAT, [ 'braced' ]);
    assert.match(editor.document.getText(), /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/);
  });

  it('UUID (Format…) renders UPPERCASE with no dashes', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(UUID_FORMAT, [ 'uppercaseNoDashes' ]);
    assert.match(editor.document.getText(), /^[0-9A-F]{32}$/);
  });

  it('Password (Options…) inserts exactly N characters from the letters-and-digits pool', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(PASSWORD_OPTIONS, [ '12', 'no' ]);
    assert.match(editor.document.getText(), /^[A-Za-z0-9]{12}$/);
  });

  it('Password (Options…) with symbols draws from the symbol-extended pool', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(PASSWORD_OPTIONS, [ '32', 'yes' ]);
    assert.match(editor.document.getText(), /^[A-Za-z0-9!@#$%^&*]{32}$/);
  });

  it('Phone (Format…) renders the picked style — international', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(PHONE_FORMAT, [ 'international' ]);
    assert.match(editor.document.getText(), /^\+\d{8,15}$/);
  });

  it('From Template… renders the entered mustache template through the pipeline', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(FROM_TEMPLATE, [ 'T-{{string.numeric(4)}}' ]);
    assert.match(editor.document.getText(), /^T-\d{4}$/);
  });

  it('From Pattern… inserts a string matching the entered pattern', async () => {
    const editor = await openDoc('');
    await runPromptedCommand(FROM_PATTERN, [ '[A-Z]{2}-[0-9]{2}' ]);
    assert.match(editor.document.getText(), /^[A-Z]{2}-\d{2}$/);
  });

  it('Esc at the template box cancels cleanly — nothing inserted, no error', async () => {
    const editor = await openDoc('');
    await assert.doesNotReject(async () => { await runPromptedCommand(FROM_TEMPLATE, [ undefined ]); });
    assert.strictEqual(editor.document.getText(), '', 'a cancelled template box must insert nothing');
  });

  it('fills every cursor with a fresh template rendering (multi-cursor)', async () => {
    const editor = await openDoc('\n'); // two empty lines.
    editor.selections = [ new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 0, 1, 0) ];
    await runPromptedCommand(FROM_TEMPLATE, [ '{{string.alphanumeric(12)}}' ]);
    const [ line0, line1 ] = editor.document.getText().split('\n');
    assert.match(line0, /^[A-Za-z0-9]{12}$/, 'first cursor gets a rendering');
    assert.match(line1, /^[A-Za-z0-9]{12}$/, 'second cursor gets a rendering');
    assert.notStrictEqual(line0, line1, 'uniquePerCursor (default) → distinct renders per cursor');
  });

  it('is reproducible under the pinned seed — the validation test-render never shifts the inserted draw', async () => {
    const first = await openDoc('');
    await runPromptedCommand(FROM_TEMPLATE, [ '{{string.alphanumeric(16)}}' ]);
    const a = first.document.getText();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const second = await openDoc('');
    await runPromptedCommand(FROM_TEMPLATE, [ '{{string.alphanumeric(16)}}' ]);
    const b = second.document.getText();
    assert.strictEqual(a, b, 'same seed + same template → same inserted value');
  });

  it('remembers the last pattern and prefills the next run', async () => {
    await openDoc('');
    await runPromptedCommand(FROM_PATTERN, [ '[a-f]{6}' ]);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await openDoc('');
    const received = await runPromptedCommand(FROM_PATTERN, [ '[a-f]{6}' ]);
    assert.strictEqual(received.inputs[0].value, '[a-f]{6}', 'the pattern box should prefill the last accepted pattern');
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

  it('Esc at the count box cancels cleanly (single-step command)', async () => {
    const editor = await openDoc('');
    await assert.doesNotReject(async () => { await runPromptedCommand(WORDS_COUNT, [ undefined ]); });
    assert.strictEqual(editor.document.getText(), '', 'a cancelled count prompt must insert nothing');
  });

  it('Esc at a pick step cancels cleanly — nothing inserted, no error', async () => {
    const editor = await openDoc('');
    await assert.doesNotReject(async () => { await runPromptedCommand(UUID_FORMAT, [ undefined ]); });
    assert.strictEqual(editor.document.getText(), '', 'a cancelled pick must insert nothing');
  });

  it('Esc at the symbols pick cancels cleanly (length already accepted)', async () => {
    const editor = await openDoc('');
    await assert.doesNotReject(async () => { await runPromptedCommand(PASSWORD_OPTIONS, [ '12', undefined ]); });
    assert.strictEqual(editor.document.getText(), '', 'a mid-flow pick cancel must insert nothing');
  });

  it('fills every cursor with a fresh value (multi-cursor)', async () => {
    const editor = await openDoc('\n'); // two empty lines.
    editor.selections = [ new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 0, 1, 0) ];
    await runPromptedCommand(NUMBER_RANGE, [ '1', '1000000' ]);
    const [ line0, line1 ] = editor.document.getText().split('\n');
    assert.ok(line0.length > 0 && line1.length > 0, 'both cursors should receive a value');
    assert.notStrictEqual(line0, line1, 'uniquePerCursor (default) → distinct values per cursor');
  });

  it('fills every cursor with fresh words (multi-cursor, multi-word values)', async () => {
    const editor = await openDoc('\n'); // two empty lines.
    editor.selections = [ new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 0, 1, 0) ];
    await runPromptedCommand(WORDS_COUNT, [ '3' ]);
    const [ line0, line1 ] = editor.document.getText().split('\n');
    assert.strictEqual(line0.split(' ').length, 3, 'first cursor gets 3 words');
    assert.strictEqual(line1.split(' ').length, 3, 'second cursor gets 3 words');
    assert.notStrictEqual(line0, line1, 'uniquePerCursor (default) → distinct values per cursor');
  });

  it('fills every cursor with a fresh value (multi-cursor through a pick step)', async () => {
    const editor = await openDoc('\n'); // two empty lines.
    editor.selections = [ new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 0, 1, 0) ];
    await runPromptedCommand(UUID_FORMAT, [ 'noDashes' ]);
    const [ line0, line1 ] = editor.document.getText().split('\n');
    assert.match(line0, /^[0-9a-f]{32}$/, 'first cursor gets a dash-less uuid');
    assert.match(line1, /^[0-9a-f]{32}$/, 'second cursor gets a dash-less uuid');
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
    assert.strictEqual(received.inputs[0].value, '7', 'min box should prefill the last accepted min, trimmed');
    assert.strictEqual(received.inputs[1].value, '9', 'max box should prefill the last accepted max');
  });

  it('is reproducible under the pinned seed through a pick-parameterized flow', async () => {
    const first = await openDoc('');
    await runPromptedCommand(PASSWORD_OPTIONS, [ '16', 'yes' ]);
    const a = first.document.getText();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const second = await openDoc('');
    await runPromptedCommand(PASSWORD_OPTIONS, [ '16', 'yes' ]);
    const b = second.document.getText();
    assert.strictEqual(a, b, 'same seed + same picks → same inserted value');
  });

  it('remembers the last pick and floats it to the top, marked', async () => {
    await openDoc('');
    await runPromptedCommand(UUID_FORMAT, [ 'braced' ]);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await openDoc('');
    const received = await runPromptedCommand(UUID_FORMAT, [ 'braced' ]);
    const [ pick ] = received.picks;
    assert.strictEqual(pick.items.length, 5, 'all five formats stay offered');
    assert.strictEqual(pick.items[0].value, 'braced', 'the remembered format floats to the top');
    assert.match(pick.items[0].description ?? '', /Last used/, 'the remembered format is marked');
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

  it('honors bulkCount with multi-line values — 2 paragraphs × bulk 2 → four lines', async () => {
    await setConfig(ConfigKey.BULK_COUNT, 2);
    const editor = await openDoc('');
    await runPromptedCommand(PARAGRAPHS_COUNT, [ '2' ]);
    await setConfig(ConfigKey.BULK_COUNT, undefined);
    const lines = editor.document.getText().split('\n');
    assert.strictEqual(lines.length, 4, '2 bulk blocks × 2-paragraph values, all newline-joined');
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
