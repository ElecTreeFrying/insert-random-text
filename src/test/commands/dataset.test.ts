import * as assert from 'assert';
import * as vscode from 'vscode';

import { ConfigKey } from '../../configuration';

// insertRandomText.generateDataset drives the Record… machinery into a FILE: multi-select fields →
// pick a shape (the recordFormat setting floats to the top) → enter a row count (defaults to
// bulkCount; capped at 100,000; counts above 10,000 confirm first) → the dataset opens as a new
// UNTITLED document (json / sql / plaintext for csv). It never touches the active editor, so the
// whole suite runs editor-less — no test here ever opens a document of its own, which is itself
// the pin for the "must work with no editor open" requirement. The dataset rendering contract
// (csv header, json array one-per-line, trailing newline) is pinned headless in test/record/.
const EXTENSION_ID = 'ElecTreeFrying.insert-random-text';
const CMD = 'insertRandomText.generateDataset';

// extension.ts reads a CACHED settings snapshot, refreshed on a config-change event. Wait for that event
// (with a fallback in case the value didn't actually change) so the cache is fresh before we run.
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

/** One scripted walk through the dataset flow (undefined at any step = Esc / dismiss). */
interface FlowScript {
  /** generatorIds (or custom-list names) to tick in the multi-select field pick. */
  fields?: readonly string[];
  /** Shape value to pick: 'json' | 'sql' | 'csv'. */
  shape?: string;
  /** Row-count box answer. */
  rows?: string;
  /** Button to press on the large-count confirmation; undefined dismisses it. */
  confirm?: string;
}

/** What the stubbed prompts received, for prefill/ordering/warning assertions. */
interface FlowCapture {
  shapeItems: any[];
  rowBox?: vscode.InputBoxOptions;
  warnings: string[];
}

/** Stub the field pick (canPickMany), the shape pick, the row-count box, and the confirm-warn
 * modal in one sweep. Scripted answers fail loudly on a typo (a missing field id / shape value)
 * and run through the box's real validateInput, mirroring the prompted-commands stub. */
async function runDataset(script: FlowScript): Promise<FlowCapture> {
  const originalPick = vscode.window.showQuickPick;
  const originalInput = vscode.window.showInputBox;
  const originalWarn = vscode.window.showWarningMessage;
  const capture: FlowCapture = { shapeItems: [], warnings: [] };

  (vscode.window as any).showQuickPick = async (items: any, options: vscode.QuickPickOptions) => {
    const resolved = await items;
    if (options?.canPickMany) {
      if (script.fields === undefined) { return undefined; }
      return script.fields.map((id) => {
        const item = resolved.find((entry: any) => entry.generatorId === id || entry.generator?.id === id);
        if (!item) { throw new Error(`no field pick item for '${id}'`); }
        return item;
      });
    }
    capture.shapeItems = resolved;
    if (script.shape === undefined) { return undefined; }
    const picked = resolved.find((entry: any) => entry.value === script.shape);
    if (!picked) { throw new Error(`no shape option with value '${script.shape}' among: ${resolved.map((i: any) => i.value).join(', ')}`); }
    return picked;
  };
  (vscode.window as any).showInputBox = async (options: vscode.InputBoxOptions) => {
    capture.rowBox = options;
    if (script.rows !== undefined && options.validateInput) {
      const error = await options.validateInput(script.rows);
      if (error) { throw new Error(`scripted row count '${script.rows}' failed validation: ${error}`); }
    }
    return script.rows;
  };
  (vscode.window as any).showWarningMessage = async (message: string) => {
    capture.warnings.push(message);
    return script.confirm;
  };

  try {
    await vscode.commands.executeCommand(CMD);
  } finally {
    (vscode.window as any).showQuickPick = originalPick;
    (vscode.window as any).showInputBox = originalInput;
    (vscode.window as any).showWarningMessage = originalWarn;
  }
  return capture;
}

describe('Generate Dataset… — records → new file', function () {
  this.timeout(30000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    await setConfig(ConfigKey.SEED, '777');
  });

  after(async () => {
    await setConfig(ConfigKey.SEED, undefined);
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('opens an untitled JSON document holding an array of N objects — with no editor open', async () => {
    assert.strictEqual(vscode.window.activeTextEditor, undefined, 'the suite runs editor-less by construction');
    await runDataset({ fields: [ 'person', 'email' ], shape: 'json', rows: '3' });
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor, 'the dataset should open in a new editor');
    assert.ok(editor.document.isUntitled, 'the dataset opens as an UNTITLED document');
    assert.strictEqual(editor.document.languageId, 'json');
    const text = editor.document.getText();
    assert.ok(text.endsWith('\n'), 'a dataset file ends with a trailing newline');
    const parsed = JSON.parse(text);
    assert.ok(Array.isArray(parsed), 'a json dataset is always an array');
    assert.strictEqual(parsed.length, 3);
    for (const row of parsed) {
      assert.deepStrictEqual(Object.keys(row).sort(), [ 'email', 'person' ]);
    }
  });

  it('csv opens as plaintext and leads with a header row of the field ids', async () => {
    await runDataset({ fields: [ 'person', 'email' ], shape: 'csv', rows: '2' });
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    assert.strictEqual(editor.document.languageId, 'plaintext');
    const lines = editor.document.getText().split('\n');
    assert.strictEqual(lines[0], 'person,email', 'the header names the field ids');
    assert.strictEqual(lines.length, 4, 'header + 2 rows + trailing newline');
    assert.strictEqual(lines[3], '');
  });

  it('sql emits one INSERT per row into the configured table', async () => {
    await setConfig(ConfigKey.RECORD_SQL_TABLE, 'users');
    try {
      await runDataset({ fields: [ 'person' ], shape: 'sql', rows: '2' });
      const editor = vscode.window.activeTextEditor;
      assert.ok(editor);
      assert.strictEqual(editor.document.languageId, 'sql');
      const lines = editor.document.getText().split('\n').filter((line) => line.length > 0);
      assert.strictEqual(lines.length, 2);
      for (const line of lines) {
        assert.ok(line.startsWith('INSERT INTO users (person) VALUES ('), `expected a users INSERT, got ${line}`);
      }
    } finally {
      await setConfig(ConfigKey.RECORD_SQL_TABLE, undefined);
    }
  });

  it('the shape pick floats the current recordFormat to the top, marked as current', async () => {
    await setConfig(ConfigKey.RECORD_FORMAT, 'csv');
    try {
      const { shapeItems } = await runDataset({ fields: [ 'person' ], shape: 'csv', rows: '1' });
      assert.strictEqual(shapeItems.length, 3, 'json / sql / csv');
      assert.strictEqual(shapeItems[0].value, 'csv', 'the configured shape leads the pick');
      assert.match(shapeItems[0].description ?? '', /current/i, 'the configured shape is marked');
    } finally {
      await setConfig(ConfigKey.RECORD_FORMAT, undefined);
    }
  });

  it('the row-count box prefills from the bulkCount setting', async () => {
    await setConfig(ConfigKey.BULK_COUNT, 7);
    try {
      const { rowBox } = await runDataset({ fields: [ 'person' ], shape: 'json', rows: undefined });
      assert.ok(rowBox, 'the flow reached the row-count box');
      assert.strictEqual(rowBox.value, '7', 'the default row count is the bulkCount setting');
    } finally {
      await setConfig(ConfigKey.BULK_COUNT, undefined);
    }
  });

  it('rejects zero, negatives, fractions, junk, and counts over the 100,000 cap', async () => {
    const { rowBox } = await runDataset({ fields: [ 'person' ], shape: 'json', rows: '1' });
    const validate = rowBox?.validateInput as (raw: string) => string | undefined;
    assert.ok(validate, 'the row-count box validates its input');
    for (const bad of [ '0', '-5', '2.5', 'abc', '', '100001' ]) {
      assert.ok(validate(bad), `'${bad}' must be rejected`);
    }
    for (const good of [ '1', '100000', ' 42 ' ]) {
      assert.strictEqual(validate(good), undefined, `'${good}' must be accepted`);
    }
  });

  it('cancelling the field pick opens nothing', async () => {
    await runDataset({ fields: undefined });
    assert.strictEqual(vscode.window.activeTextEditor, undefined, 'Esc at the field pick must be a clean cancel');
  });

  it('confirming the field pick with nothing ticked opens nothing', async () => {
    await runDataset({ fields: [] });
    assert.strictEqual(vscode.window.activeTextEditor, undefined, 'an empty tick set must be a clean cancel');
  });

  it('cancelling the shape pick opens nothing', async () => {
    await runDataset({ fields: [ 'person' ], shape: undefined });
    assert.strictEqual(vscode.window.activeTextEditor, undefined, 'Esc at the shape pick must be a clean cancel');
  });

  it('cancelling the row-count box opens nothing', async () => {
    await runDataset({ fields: [ 'person' ], shape: 'json', rows: undefined });
    assert.strictEqual(vscode.window.activeTextEditor, undefined, 'Esc at the row count must be a clean cancel');
  });

  it('asks for confirmation above 10,000 rows — dismissing generates nothing', async () => {
    const { warnings } = await runDataset({ fields: [ 'boolean' ], shape: 'csv', rows: '10001', confirm: undefined });
    assert.strictEqual(warnings.length, 1, 'one confirmation for a large dataset');
    assert.match(warnings[0], /10,001/, 'the confirmation names the row count');
    assert.strictEqual(vscode.window.activeTextEditor, undefined, 'dismissing the confirmation must generate nothing');
  });

  it('generates after the large-count confirmation is accepted', async () => {
    const { warnings } = await runDataset({ fields: [ 'boolean' ], shape: 'csv', rows: '10001', confirm: 'Generate' });
    assert.strictEqual(warnings.length, 1);
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor, 'confirming should generate the dataset');
    assert.strictEqual(editor.document.getText().split('\n').length, 10003, 'header + 10,001 rows + trailing newline');
  });

  it('does not ask for confirmation at exactly 10,000 rows', async () => {
    const { warnings } = await runDataset({ fields: [ 'boolean' ], shape: 'csv', rows: '10000' });
    assert.strictEqual(warnings.length, 0, 'the confirm threshold is strictly above 10,000');
    const editor = vscode.window.activeTextEditor;
    assert.ok(editor);
    assert.strictEqual(editor.document.getText().split('\n').length, 10002, 'header + 10,000 rows + trailing newline');
  });

  it('seeded runs are reproducible', async () => {
    await runDataset({ fields: [ 'person', 'email' ], shape: 'json', rows: '2' });
    const first = vscode.window.activeTextEditor?.document.getText();
    assert.ok(first, 'first run generated');
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await runDataset({ fields: [ 'person', 'email' ], shape: 'json', rows: '2' });
    assert.strictEqual(vscode.window.activeTextEditor?.document.getText(), first, 'same seed → same dataset');
  });

  it('a picked custom list becomes a column keyed by its name', async () => {
    await setConfig(ConfigKey.CUSTOM_LISTS, { pet: [ 'dog', 'cat' ] });
    try {
      await runDataset({ fields: [ 'pet', 'email' ], shape: 'csv', rows: '2' });
      const editor = vscode.window.activeTextEditor;
      assert.ok(editor);
      const lines = editor.document.getText().split('\n');
      assert.strictEqual(lines[0], 'pet,email', 'the list name leads the header (custom lists come first)');
      assert.match(lines[1], /^(dog|cat),/);
      assert.match(lines[2], /^(dog|cat),/);
    } finally {
      await setConfig(ConfigKey.CUSTOM_LISTS, undefined);
    }
  });
});
