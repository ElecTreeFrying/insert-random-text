import * as assert from 'assert';
import * as vscode from 'vscode';

import { ConfigKey } from '../../configuration';
import { SETTING_COMMANDS } from '../../settingsCommands';

// Saved templates + custom lists end-to-end: the two settings feed user-defined groups at the TOP of
// Pick… (and custom lists into Record… as fields), inserting through the normal pipeline. Suite baseline
// mirrors insert.test.ts: quotes + newline OFF and a pinned seed. The two data-pool settings are set in
// before() and MUST be cleared in after() — other suites (insert.test.ts) pin the picker's virgin shape.
const EXTENSION_ID = 'ElecTreeFrying.insert-random-text';

const TEMPLATES = { invoice: 'INV-{{string.numeric(4)}}' };
const LISTS = { environment: [ 'dev', 'staging', 'production' ] };

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

type Pick = vscode.QuickPickItem & { generatorId?: string; generator?: { id: string } };

/** Run a picker command with showQuickPick stubbed: `choose` sees the resolved items and returns the
 * pick (or undefined = dismiss). The items are captured for structural assertions. */
async function runPicker(command: string, choose: (items: Pick[]) => Pick | Pick[] | undefined): Promise<Pick[]> {
  let captured: Pick[] = [];
  const original = vscode.window.showQuickPick;
  (vscode.window as any).showQuickPick = async (items: any) => { captured = await items; return choose(captured); };
  try {
    await vscode.commands.executeCommand(command);
  } finally {
    (vscode.window as any).showQuickPick = original;
  }
  return captured;
}

const byLabel = (items: Pick[], label: string): Pick => {
  const item = items.find((i) => i.label === label && !i.kind);
  assert.ok(item, `no picker entry labeled '${label}' among: ${items.map((i) => i.label).join(', ')}`);
  return item!;
};

describe('custom data — saved templates & custom lists through Pick…/Record…', function () {
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    await setConfig(ConfigKey.WITH_QUOTE, false);
    await setConfig(ConfigKey.WITH_NEW_LINE, false);
    await setConfig(ConfigKey.SEED, '2718');
    await setConfig(ConfigKey.TEMPLATES, TEMPLATES);
    await setConfig(ConfigKey.CUSTOM_LISTS, LISTS);
  });

  after(async () => {
    await setConfig(ConfigKey.WITH_QUOTE, undefined);
    await setConfig(ConfigKey.WITH_NEW_LINE, undefined);
    await setConfig(ConfigKey.SEED, undefined);
    await setConfig(ConfigKey.TEMPLATES, undefined);
    await setConfig(ConfigKey.CUSTOM_LISTS, undefined);
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('Pick… leads with the Templates and Custom Lists groups, before any catalog group', async () => {
    const items = await runPicker('insertRandomText.pick', () => undefined);
    const separators = items.filter((i) => i.kind === vscode.QuickPickItemKind.Separator).map((i) => i.label);
    assert.deepStrictEqual(separators.slice(0, 2), [ 'Templates', 'Custom Lists' ], 'the user groups must lead the picker');
    assert.strictEqual(items[0].kind, vscode.QuickPickItemKind.Separator, 'the picker must open on the Templates separator');
    assert.strictEqual(items[1].label, 'invoice', 'the saved template follows its separator');
    assert.strictEqual(items[1].description, TEMPLATES.invoice, 'the template text is the description (searchable)');
  });

  it('picking a saved template inserts a fresh rendering through the pipeline', async () => {
    const editor = await openDoc('');
    await runPicker('insertRandomText.pick', (items) => byLabel(items, 'invoice'));
    assert.match(editor.document.getText(), /^INV-\d{4}$/);
  });

  it('picking a custom list inserts one of its values', async () => {
    const editor = await openDoc('');
    await runPicker('insertRandomText.pick', (items) => byLabel(items, 'environment'));
    assert.ok(LISTS.environment.includes(editor.document.getText()), `expected a list value, got '${editor.document.getText()}'`);
  });

  it('a saved template fills every cursor with a fresh rendering (multi-cursor)', async () => {
    const editor = await openDoc('\n'); // two empty lines.
    editor.selections = [ new vscode.Selection(0, 0, 0, 0), new vscode.Selection(1, 0, 1, 0) ];
    await runPicker('insertRandomText.pick', (items) => byLabel(items, 'invoice'));
    const [ line0, line1 ] = editor.document.getText().split('\n');
    assert.match(line0, /^INV-\d{4}$/);
    assert.match(line1, /^INV-\d{4}$/);
  });

  it('a saved template honors bulkCount through the pipeline', async () => {
    await setConfig(ConfigKey.BULK_COUNT, 3);
    const editor = await openDoc('');
    await runPicker('insertRandomText.pick', (items) => byLabel(items, 'invoice'));
    await setConfig(ConfigKey.BULK_COUNT, undefined);
    const lines = editor.document.getText().split('\n');
    assert.strictEqual(lines.length, 3, 'plain bulk 3 → three lines');
    for (const line of lines) { assert.match(line, /^INV-\d{4}$/); }
  });

  it('is reproducible under the pinned seed', async () => {
    const first = await openDoc('');
    await runPicker('insertRandomText.pick', (items) => byLabel(items, 'invoice'));
    const a = first.document.getText();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const second = await openDoc('');
    await runPicker('insertRandomText.pick', (items) => byLabel(items, 'invoice'));
    const b = second.document.getText();
    assert.strictEqual(a, b, 'same seed + same template → same inserted value');
  });

  it('a template that fails to render shows a friendly error and inserts nothing', async () => {
    await setConfig(ConfigKey.TEMPLATES, { broken: '{{nope.nothing}}' });
    const messages: string[] = [];
    const originalError = vscode.window.showErrorMessage;
    (vscode.window as any).showErrorMessage = async (message: string) => { messages.push(message); return undefined; };
    const editor = await openDoc('');
    try {
      await assert.doesNotReject(async () => {
        await runPicker('insertRandomText.pick', (items) => byLabel(items, 'broken'));
      });
    } finally {
      (vscode.window as any).showErrorMessage = originalError;
      await setConfig(ConfigKey.TEMPLATES, TEMPLATES); // restore the suite baseline.
    }
    assert.strictEqual(editor.document.getText(), '', 'a failing template must insert nothing');
    assert.strictEqual(messages.length, 1, 'exactly one friendly error');
    assert.match(messages[0], /broken/, 'the error names the template');
    assert.match(messages[0], /Manage Templates/, 'the error points at the manage command');
  });

  it('Record… offers custom lists (before the catalog groups) and keys the field by the list name', async () => {
    await setConfig(ConfigKey.RECORD_FORMAT, undefined); // default: json
    const editor = await openDoc('');
    const items = await runPicker('insertRandomText.record', (all) => {
      const person = all.find((i) => i.generatorId === 'person');
      assert.ok(person, 'the catalog Full Name field must be offered');
      return [ byLabel(all, 'environment'), person! ];
    });
    const separators = items.filter((i) => i.kind === vscode.QuickPickItemKind.Separator).map((i) => i.label);
    assert.strictEqual(separators[0], 'Custom Lists', 'custom lists must lead the field picker');
    assert.ok(!separators.includes('Templates'), 'templates are Pick…-only, never record fields');
    const parsed = JSON.parse(editor.document.getText());
    assert.deepStrictEqual(Object.keys(parsed), [ 'environment', 'person' ], 'custom field first, keyed by its name');
    assert.ok(LISTS.environment.includes(parsed.environment), `the field value must come from the list, got '${parsed.environment}'`);
  });

  it('Pick… shows no user groups when both settings are empty', async () => {
    await setConfig(ConfigKey.TEMPLATES, undefined);
    await setConfig(ConfigKey.CUSTOM_LISTS, undefined);
    const items = await runPicker('insertRandomText.pick', () => undefined);
    await setConfig(ConfigKey.TEMPLATES, TEMPLATES); // restore the suite baseline.
    await setConfig(ConfigKey.CUSTOM_LISTS, LISTS);
    const separators = items.filter((i) => i.kind === vscode.QuickPickItemKind.Separator).map((i) => i.label);
    assert.ok(!separators.includes('Templates') && !separators.includes('Custom Lists'), 'empty settings contribute no groups');
    assert.strictEqual(separators[0], 'Identity', 'the picker falls back to opening on the first catalog group');
  });
});

describe('custom data — Manage commands & reset behavior', function () {
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('the Manage commands open Settings without error (registered end-to-end)', async () => {
    await assert.doesNotReject(async () => { await vscode.commands.executeCommand('insertRandomText.manageTemplates'); });
    await assert.doesNotReject(async () => { await vscode.commands.executeCommand('insertRandomText.manageCustomLists'); });
  });

  it('resetSettings keeps saved templates and custom lists (user content, not tuning)', async () => {
    const setGlobal = (key: string, value: unknown) =>
      vscode.workspace.getConfiguration().update(key, value, vscode.ConfigurationTarget.Global);
    await setGlobal(ConfigKey.TEMPLATES, TEMPLATES);
    await setGlobal(ConfigKey.CUSTOM_LISTS, LISTS);
    await setGlobal(ConfigKey.BULK_COUNT, 7);

    const original = vscode.window.showWarningMessage;
    (vscode.window as any).showWarningMessage = async () => 'Reset';
    try {
      await SETTING_COMMANDS['insertRandomText.resetSettings']();
    } finally {
      (vscode.window as any).showWarningMessage = original;
    }

    const inspect = (key: string) => vscode.workspace.getConfiguration().inspect(key)?.globalValue;
    assert.strictEqual(inspect(ConfigKey.BULK_COUNT), undefined, 'a tuning setting must reset');
    assert.deepStrictEqual(inspect(ConfigKey.TEMPLATES), TEMPLATES, 'saved templates must survive a reset');
    assert.deepStrictEqual(inspect(ConfigKey.CUSTOM_LISTS), LISTS, 'custom lists must survive a reset');

    await setGlobal(ConfigKey.TEMPLATES, undefined);
    await setGlobal(ConfigKey.CUSTOM_LISTS, undefined);
  });
});
