import * as assert from 'assert';
import * as vscode from 'vscode';

import { ConfigKey } from '../../configuration';
import { generators } from '../../catalog';

// Drives the real insert path end-to-end through executeCommand (insertGenerated isn't exported — the
// command IS the public surface). Runs in the Extension Host. To keep assertions exact, the suite turns
// quotes + trailing newline OFF and pins a numeric seed, so every insert is a bare, reproducible value.
const EXTENSION_ID = 'ElecTreeFrying.insert-random-text';
const CMD = 'extension.insertRandomString'; // → the 'string' generator (alphanumeric, symbol-free).

// extension.ts reads a CACHED settings snapshot, refreshed on a config-change event. Wait for that event
// (with a fallback in case the value didn't actually change) so the cache is fresh before we insert.
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

describe('insert command — insertGenerated', function () {
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    await setConfig(ConfigKey.WITH_QUOTE, false);
    await setConfig(ConfigKey.WITH_NEW_LINE, false);
    await setConfig(ConfigKey.SEED, '12345');
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

  it('inserts a value at the cursor (Cursor mode, the default)', async () => {
    const editor = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    assert.ok(editor.document.getText().length > 0, 'expected a value at the cursor');
  });

  it('fills every cursor with a fresh value (multi-cursor)', async () => {
    const editor = await openDoc('\n'); // two empty lines.
    editor.selections = [ new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 0, 1, 0) ];
    await vscode.commands.executeCommand(CMD);
    const [ line0, line1 ] = editor.document.getText().split('\n');
    assert.ok(line0.length > 0 && line1.length > 0, 'both cursors should receive a value');
    assert.notStrictEqual(line0, line1, 'uniquePerCursor (default) → distinct values per cursor');
  });

  it('is reproducible under a fixed seed (applySeed re-seeds every run)', async () => {
    const first = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    const a = first.document.getText();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const second = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    const b = second.document.getText();
    assert.strictEqual(a, b, 'same seed → same inserted value');
  });

  it('does not pin output when the seed is blank (applySeed early-returns)', async () => {
    await setConfig(ConfigKey.SEED, '');
    const first = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    const a = first.document.getText();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const second = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    const b = second.document.getText();
    await setConfig(ConfigKey.SEED, '12345'); // restore the suite's pinned seed.
    assert.notStrictEqual(a, b, 'a blank seed should leave output un-pinned (values differ run to run)');
  });

  it('does not pin output when the seed is non-numeric (applySeed skips NaN)', async () => {
    // The third applySeed path: 'abc' survives the blank check but Number('abc') is NaN → never seed(NaN).
    await setConfig(ConfigKey.SEED, 'abc');
    const first = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    const a = first.document.getText();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const second = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    const b = second.document.getText();
    await setConfig(ConfigKey.SEED, '12345'); // restore the suite's pinned seed.
    assert.notStrictEqual(a, b, 'a non-numeric seed must leave output un-pinned, not seed with NaN');
  });

  it('inserts one block at the top in Top mode', async () => {
    await setConfig(ConfigKey.INSERT_TYPE, 'Top');
    const editor = await openDoc('existing');
    await vscode.commands.executeCommand(CMD);
    assert.ok(
      !editor.document.lineAt(0).text.startsWith('existing'),
      'Top mode should insert before the existing text at line 0',
    );
  });

  it('copies to the clipboard and leaves the document untouched in Clipboard mode', async () => {
    await setConfig(ConfigKey.INSERT_TYPE, 'Clipboard');
    await vscode.env.clipboard.writeText('SENTINEL');
    const editor = await openDoc('untouched');
    await vscode.commands.executeCommand(CMD);
    assert.strictEqual(editor.document.getText(), 'untouched', 'Clipboard mode must not modify the document');
    const clip = await vscode.env.clipboard.readText();
    assert.ok(clip.length > 0 && clip !== 'SENTINEL', 'Clipboard mode should overwrite the clipboard with a value');
  });

  it('is a no-op with no active editor in Cursor mode (does not throw)', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await assert.doesNotReject(async () => { await vscode.commands.executeCommand(CMD); });
  });

  it('Pick… inserts the chosen generator at the cursor', async () => {
    const editor = await openDoc('');
    const original = vscode.window.showQuickPick;
    // Choose the first real entry (group separators carry no generatorId).
    (vscode.window as any).showQuickPick = async (items: any) => (await items).find((i: any) => i.generatorId);
    try {
      await vscode.commands.executeCommand('insertRandomText.pick');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    assert.ok(editor.document.getText().length > 0, 'picking a type should insert it at the cursor');
  });

  it('Pick… inserts nothing when dismissed', async () => {
    const editor = await openDoc('');
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async () => undefined;
    try {
      await vscode.commands.executeCommand('insertRandomText.pick');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    assert.strictEqual(editor.document.getText(), '', 'a dismissed picker should insert nothing');
  });

  it('Pick… lists one entry per non-hidden generator, grouped, and excludes hidden ones', async () => {
    let captured: any[] = [];
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async (items: any) => { captured = await items; return undefined; };
    try {
      await vscode.commands.executeCommand('insertRandomText.pick');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    const entries = captured.filter((i) => i.generatorId);
    const separators = captured.filter((i) => i.kind === vscode.QuickPickItemKind.Separator);
    assert.strictEqual(entries.length, generators.filter((g) => !g.hidden).length, 'one entry per non-hidden generator');
    assert.ok(separators.length > 0, 'groups should be separated in the picker');
    const ids = new Set(entries.map((i) => i.generatorId));
    for (const hidden of [ 'loremSmall', 'hashSmall' ]) {
      assert.ok(!ids.has(hidden), `hidden generator '${hidden}' must not appear in the picker`);
    }
  });
});

// After a Cursor-mode insert the block must read as *typed*: nothing stays selected and the caret sits
// right after the inserted text — for a bare caret, a replaced selection, several of each, and a
// bulkCount block alike. Guards the recurring competitor complaint (inserted text left highlighted).
describe('insert — post-insert cursor behavior (nothing stays selected)', function () {
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    await setConfig(ConfigKey.WITH_QUOTE, false);
    await setConfig(ConfigKey.WITH_NEW_LINE, false);
    await setConfig(ConfigKey.SEED, '4242');
  });

  after(async () => {
    await setConfig(ConfigKey.WITH_QUOTE, undefined);
    await setConfig(ConfigKey.WITH_NEW_LINE, undefined);
    await setConfig(ConfigKey.SEED, undefined);
    await setConfig(ConfigKey.BULK_COUNT, undefined);
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  function assertCaretsParkedAfterBlocks(editor: vscode.TextEditor): void {
    for (const selection of editor.selections) {
      assert.ok(selection.isEmpty, `inserted text must not stay selected — got ${JSON.stringify(selection)}`);
      // Bare single-line value (quotes + newline off) → the block ends where its line ends.
      const lineEnd = editor.document.lineAt(selection.active.line).range.end;
      assert.ok(
        selection.active.isEqual(lineEnd),
        `the caret should sit at the end of its inserted block — at ${selection.active.line}:${selection.active.character}, line ends at :${lineEnd.character}`,
      );
    }
  }

  it('collapses the caret after the block at a bare cursor', async () => {
    const editor = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    assert.ok(editor.document.getText().length > 0, 'expected an inserted value');
    assertCaretsParkedAfterBlocks(editor);
  });

  it('collapses the caret after replacing a non-empty selection', async () => {
    const editor = await openDoc('REPLACEME');
    editor.selection = new vscode.Selection(0, 0, 0, 'REPLACEME'.length);
    await vscode.commands.executeCommand(CMD);
    assert.ok(!editor.document.getText().includes('REPLACEME'), 'the selection should be replaced');
    assertCaretsParkedAfterBlocks(editor);
  });

  it('collapses every caret in a mixed multi-cursor insert (bare caret + selection)', async () => {
    const editor = await openDoc('\nREPLACEME');
    editor.selections = [ new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 0, 1, 'REPLACEME'.length) ];
    await vscode.commands.executeCommand(CMD);
    assert.strictEqual(editor.selections.length, 2, 'both cursors should survive the insert');
    assertCaretsParkedAfterBlocks(editor);
  });

  it('parks the caret after the whole block when bulkCount > 1 (multi-line block)', async () => {
    await setConfig(ConfigKey.BULK_COUNT, 3);
    const editor = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    await setConfig(ConfigKey.BULK_COUNT, undefined);
    assert.strictEqual(editor.document.lineCount, 3, 'plain bulk 3 → three lines');
    const [ selection ] = editor.selections;
    assert.ok(selection.isEmpty, 'the bulk block must not stay selected');
    const documentEnd = editor.document.positionAt(editor.document.getText().length);
    assert.ok(selection.active.isEqual(documentEnd), 'the caret should sit after the last bulk line');
  });

  it('collapses the caret after a Record… insert over a selection', async () => {
    const editor = await openDoc('REPLACEME');
    editor.selection = new vscode.Selection(0, 0, 0, 'REPLACEME'.length);
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async (items: any) =>
      [ (await items).find((i: any) => i.generatorId === 'person') ];
    try {
      await vscode.commands.executeCommand('insertRandomText.record');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    assert.ok(editor.document.getText().startsWith('{'), 'expected a JSON record');
    const [ selection ] = editor.selections;
    assert.ok(selection.isEmpty, 'the inserted record must not stay selected');
    const documentEnd = editor.document.positionAt(editor.document.getText().length);
    assert.ok(selection.active.isEqual(documentEnd), 'the caret should sit after the record');
  });
});

// Automatic quoting through the REAL insert path (currentInsertOptions → resolveQuotePolicy → wrap).
// Own hooks because this needs quotes ON — the opposite of the bare-value suite above.
describe('insert — automatic quoting', function () {
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    await setConfig(ConfigKey.WITH_QUOTE, true);
    await setConfig(ConfigKey.WITH_NEW_LINE, false);
    await setConfig(ConfigKey.SEED, '999');
  });

  after(async () => {
    await setConfig(ConfigKey.WITH_QUOTE, undefined);
    await setConfig(ConfigKey.WITH_NEW_LINE, undefined);
    await setConfig(ConfigKey.SEED, undefined);
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  async function openLangDoc(language: string): Promise<vscode.TextEditor> {
    const doc = await vscode.workspace.openTextDocument({ language, content: '' });
    return vscode.window.showTextDocument(doc);
  }

  it('uses double quotes in a JSON file', async () => {
    const editor = await openLangDoc('json');
    await vscode.commands.executeCommand(CMD);
    const text = editor.document.getText();
    assert.ok(text.startsWith('"') && text.endsWith('"'), `expected double-quoted, got ${text}`);
  });

  it('uses double quotes in a JavaScript file (no quote-style setting to honor)', async () => {
    const editor = await openLangDoc('javascript');
    await vscode.commands.executeCommand(CMD);
    const text = editor.document.getText();
    assert.ok(text.startsWith('"') && text.endsWith('"'), `expected double-quoted, got ${text}`);
  });

  it('uses single quotes in a SQL file', async () => {
    const editor = await openLangDoc('sql');
    await vscode.commands.executeCommand(CMD);
    const text = editor.document.getText();
    assert.ok(text.startsWith("'") && text.endsWith("'"), `expected single-quoted, got ${text}`);
  });
});

// The Clipboard branch reshapes the options before building: plain output strips the quote wrapping (a
// bare value is what you want to paste), while quotedList keeps it (there the quotes ARE the format).
// Quotes must be ON for the two sides to be distinguishable — the earlier Clipboard test runs quotes-off.
describe('insert — Clipboard formatting', function () {
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    await setConfig(ConfigKey.WITH_QUOTE, true);
    await setConfig(ConfigKey.WITH_NEW_LINE, false);
    await setConfig(ConfigKey.INSERT_TYPE, 'Clipboard');
    // No editor at all: Clipboard mode must work anyway (languageId undefined → double quotes).
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  after(async () => {
    await setConfig(ConfigKey.WITH_QUOTE, undefined);
    await setConfig(ConfigKey.WITH_NEW_LINE, undefined);
    await setConfig(ConfigKey.INSERT_TYPE, undefined);
    await setConfig(ConfigKey.OUTPUT_FORMAT, undefined);
  });

  it('strips the quote wrapping from a plain copy even with quotes on', async () => {
    await setConfig(ConfigKey.OUTPUT_FORMAT, 'plain');
    await vscode.env.clipboard.writeText('SENTINEL');
    await vscode.commands.executeCommand(CMD);
    const clip = await vscode.env.clipboard.readText();
    assert.ok(clip.length > 0 && clip !== 'SENTINEL', 'expected a copied value');
    assert.ok(!clip.startsWith('"') && !clip.startsWith("'"), `a plain clipboard copy should be bare, got ${clip}`);
  });

  it('keeps the quote wrapping when the output format is quotedList', async () => {
    await setConfig(ConfigKey.OUTPUT_FORMAT, 'quotedList');
    await vscode.env.clipboard.writeText('SENTINEL');
    await vscode.commands.executeCommand(CMD);
    const clip = await vscode.env.clipboard.readText();
    assert.ok(clip.startsWith('"') && clip.endsWith('"'), `a quotedList clipboard copy should stay quoted, got ${clip}`);
  });
});

// The Record… command end-to-end: multi-select fields → buildRecords → insert. The multi-select Quick
// Pick is stubbed (canPickMany returns an ARRAY of items); shape + table come from the record settings.
describe('insert — Record… (multi-field)', function () {
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    await setConfig(ConfigKey.SEED, '777');
  });

  after(async () => {
    await setConfig(ConfigKey.SEED, undefined);
    await setConfig(ConfigKey.RECORD_FORMAT, undefined);
    await setConfig(ConfigKey.RECORD_SQL_TABLE, undefined);
    await setConfig(ConfigKey.UNIQUE_PER_CURSOR, undefined);
  });

  afterEach(async () => {
    await setConfig(ConfigKey.INSERT_TYPE, undefined); // back to the default 'Cursor'.
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  async function runRecordPicking(ids: readonly string[]): Promise<void> {
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async (items: any) => {
      const entries = (await items).filter((i: any) => i.generatorId);
      // Return picks in the REQUESTED order (may differ from catalog order on purpose).
      return ids.map((id) => entries.find((i: any) => i.generatorId === id));
    };
    try {
      await vscode.commands.executeCommand('insertRandomText.record');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
  }

  it('inserts a JSON object keyed by the picked fields (default shape)', async () => {
    await setConfig(ConfigKey.RECORD_FORMAT, undefined); // default: json
    const editor = await openDoc('');
    await runRecordPicking([ 'person', 'email' ]);
    const text = editor.document.getText();
    const parsed = JSON.parse(text);
    assert.deepStrictEqual(Object.keys(parsed).sort(), [ 'email', 'person' ], `expected both fields, got ${text}`);
  });

  it('preserves catalog order regardless of tick order', async () => {
    const editor = await openDoc('');
    await runRecordPicking([ 'email', 'person' ]); // ticked backwards: email before person.
    const keys = Object.keys(JSON.parse(editor.document.getText()));
    assert.deepStrictEqual(keys, [ 'person', 'email' ], 'field order must follow the catalog, not the tick order');
  });

  it('renders a SQL INSERT with the configured table when recordFormat is sql', async () => {
    await setConfig(ConfigKey.RECORD_FORMAT, 'sql');
    await setConfig(ConfigKey.RECORD_SQL_TABLE, 'users');
    const editor = await openDoc('');
    await runRecordPicking([ 'person' ]);
    const text = editor.document.getText();
    assert.ok(text.startsWith('INSERT INTO users (person) VALUES ('), `expected a users INSERT, got ${text}`);
    await setConfig(ConfigKey.RECORD_FORMAT, undefined);
    await setConfig(ConfigKey.RECORD_SQL_TABLE, undefined);
  });

  it('inserts nothing when the field pick is dismissed', async () => {
    const editor = await openDoc('');
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async () => undefined;
    try {
      await vscode.commands.executeCommand('insertRandomText.record');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    assert.strictEqual(editor.document.getText(), '', 'a dismissed field pick should insert nothing');
  });

  it('inserts nothing when the pick returns an empty selection', async () => {
    // The other half of the `!picks || picks.length === 0` guard: OK with nothing ticked (canPickMany
    // resolves to an empty ARRAY, not undefined).
    const editor = await openDoc('');
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async () => [];
    try {
      await vscode.commands.executeCommand('insertRandomText.record');
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    assert.strictEqual(editor.document.getText(), '', 'an empty field selection should insert nothing');
  });

  it('repeats one shared record at every cursor when uniquePerCursor is off', async () => {
    await setConfig(ConfigKey.UNIQUE_PER_CURSOR, false);
    const editor = await openDoc('\n'); // two empty lines.
    editor.selections = [ new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 0, 1, 0) ];
    await runRecordPicking([ 'person' ]);
    const [ line0, line1 ] = editor.document.getText().split('\n');
    await setConfig(ConfigKey.UNIQUE_PER_CURSOR, undefined);
    assert.ok(line0.length > 0, 'both cursors should receive the record');
    assert.strictEqual(line0, line1, 'uniquePerCursor off → buildRecords runs once, same record everywhere');
  });

  it('is a no-op with no active editor (does not throw)', async () => {
    // The field pick still shows (it precedes the editor check); confirming a pick with no editor bails.
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await assert.doesNotReject(async () => { await runRecordPicking([ 'person' ]); });
  });

  it('copies the record to the clipboard and leaves the document untouched in Clipboard mode', async () => {
    await setConfig(ConfigKey.INSERT_TYPE, 'Clipboard');
    await vscode.env.clipboard.writeText('SENTINEL');
    const editor = await openDoc('untouched');
    await runRecordPicking([ 'person', 'email' ]);
    assert.strictEqual(editor.document.getText(), 'untouched', 'Clipboard mode must not modify the document');
    const clip = await vscode.env.clipboard.readText();
    const parsed = JSON.parse(clip); // default shape: a bare JSON object.
    assert.deepStrictEqual(Object.keys(parsed).sort(), [ 'email', 'person' ], `expected a record on the clipboard, got ${clip}`);
  });

  it('copies the record with no editor open in Clipboard mode', async () => {
    await setConfig(ConfigKey.INSERT_TYPE, 'Clipboard');
    await vscode.env.clipboard.writeText('SENTINEL');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await runRecordPicking([ 'person' ]);
    const clip = await vscode.env.clipboard.readText();
    assert.ok(clip !== 'SENTINEL' && clip.includes('person'), `a clipboard record needs no editor, got ${clip}`);
  });

  it('never appends the trailing newline to a record — even with withNewLine on (its default)', async () => {
    // Single-value inserts get the withNewLine treatment; a record's shape IS its final text.
    const editor = await openDoc('');
    await runRecordPicking([ 'person' ]);
    const text = editor.document.getText();
    assert.ok(text.length > 0 && !text.endsWith('\n'), `expected a bare record block, got ${JSON.stringify(text)}`);
  });

  it('inserts one record at the top in Top mode', async () => {
    await setConfig(ConfigKey.INSERT_TYPE, 'Top');
    const editor = await openDoc('existing');
    // Park the cursor at the END of the text so a cursor-mode insert lands after
    // 'existing' — only a real Top insert can put the record before it.
    editor.selection = new vscode.Selection(0, 'existing'.length, 0, 'existing'.length);
    await runRecordPicking([ 'person' ]);
    assert.ok(!editor.document.lineAt(0).text.startsWith('existing'), 'Top mode should insert the record before the existing text');
    assert.ok(editor.document.getText().includes('existing'), 'the existing text must survive a Top insert');
  });
});

describe('insert — picker & status-bar UI contract', function () {
  // The Host can't render a Quick Pick or read the status bar, but it CAN pin the exact data handed to
  // them — group order, the id in each description (what matchOnDescription filters on), placeholder
  // text, pick options, and the confirm message. The one thing left for a human eye is that VS Code
  // draws that data correctly, which is a one-time check in qa/checklists/manual-qa.md, not a per-release sweep.
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  afterEach(async () => {
    await setConfig(ConfigKey.INSERT_TYPE, undefined);
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  // Group order in both pickers = first appearance among visible generators, in registry order.
  const expectedGroups: string[] = [];
  for (const generator of generators) {
    if (!generator.hidden && !expectedGroups.includes(generator.group)) {
      expectedGroups.push(generator.group);
    }
  }

  async function capturePicker(command: string): Promise<{ items: any[]; options: any }> {
    let captured: { items: any[]; options: any } = { items: [], options: undefined };
    const original = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async (items: any, options: any) => {
      captured = { items: await items, options };
      return undefined; // dismiss — we only want the data.
    };
    try {
      await vscode.commands.executeCommand(command);
    } finally {
      (vscode.window as any).showQuickPick = original;
    }
    return captured;
  }

  it('Pick… separators appear in catalog group order', async () => {
    const { items } = await capturePicker('insertRandomText.pick');
    const separators = items.filter((i) => i.kind === vscode.QuickPickItemKind.Separator).map((i) => i.label);
    assert.deepStrictEqual(separators, expectedGroups, 'picker groups must mirror catalog registry order');
  });

  it('Pick… entries carry the generator id as description, and the picker filters on it', async () => {
    const { items, options } = await capturePicker('insertRandomText.pick');
    for (const item of items.filter((i) => i.generatorId)) {
      assert.strictEqual(item.description, item.generatorId, `'${item.label}' should expose its id for filtering`);
    }
    assert.strictEqual(options.matchOnDescription, true, 'without matchOnDescription, typing an id filters nothing');
  });

  it('Pick… shows its placeholder', async () => {
    const { options } = await capturePicker('insertRandomText.pick');
    assert.strictEqual(options.placeHolder, 'Insert Random — pick a type to insert at every cursor…');
  });

  it('Record… is the multi-select variant: same groups, hidden excluded, id filter, placeholder', async () => {
    const { items, options } = await capturePicker('insertRandomText.record');
    assert.strictEqual(options.canPickMany, true, 'the Record picker must be multi-select');
    assert.strictEqual(options.matchOnDescription, true);
    assert.strictEqual(options.placeHolder, 'Pick fields for the record…');
    const separators = items.filter((i) => i.kind === vscode.QuickPickItemKind.Separator).map((i) => i.label);
    assert.deepStrictEqual(separators, expectedGroups);
    const ids = new Set(items.filter((i) => i.generatorId).map((i) => i.generatorId));
    for (const hidden of generators.filter((g) => g.hidden)) {
      assert.ok(!ids.has(hidden.id), `hidden generator '${hidden.id}' must not be a record field`);
    }
  });

  async function captureStatusBar(run: () => Promise<void>): Promise<string[]> {
    const messages: string[] = [];
    const original = vscode.window.setStatusBarMessage;
    (vscode.window as any).setStatusBarMessage = (message: string) => {
      messages.push(message);
      return { dispose() { } };
    };
    try {
      await run();
    } finally {
      (vscode.window as any).setStatusBarMessage = original;
    }
    return messages;
  }

  it('a Clipboard-mode copy confirms in the status bar, named after the generator', async () => {
    await setConfig(ConfigKey.INSERT_TYPE, 'Clipboard');
    const messages = await captureStatusBar(async () => {
      await vscode.commands.executeCommand(CMD); // → the 'String' generator.
    });
    assert.deepStrictEqual(messages, [ '$(clippy) Copied random string to clipboard' ]);
  });

  it('a Clipboard-mode record copy confirms in the status bar', async () => {
    await setConfig(ConfigKey.INSERT_TYPE, 'Clipboard');
    const originalPick = vscode.window.showQuickPick;
    (vscode.window as any).showQuickPick = async (items: any) => [ (await items).find((i: any) => i.generatorId === 'person') ];
    let messages: string[];
    try {
      messages = await captureStatusBar(async () => {
        await vscode.commands.executeCommand('insertRandomText.record');
      });
    } finally {
      (vscode.window as any).showQuickPick = originalPick;
    }
    assert.deepStrictEqual(messages, [ '$(clippy) Copied random record to clipboard' ]);
  });
});
