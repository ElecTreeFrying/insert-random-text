import * as assert from 'assert';
import * as vscode from 'vscode';

import { ConfigKey } from '../../configuration';

// insertRandomText.randomizeSelection anonymizes IN PLACE: each non-empty selection is replaced with a
// format-preserving randomization of its own text (digits→digits, letters→letters matching case, all
// else untouched). It is a replacement, not an insertion — insert type, quoting, newline and bulk never
// apply — but seed does: the per-character draws ride the shared faker RNG. The pure character contract
// is pinned headless in test/randomize/; this suite pins the editor semantics end to end.
const EXTENSION_ID = 'ElecTreeFrying.insert-random-text';
const CMD = 'insertRandomText.randomizeSelection';
const SEED = 424242;

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

async function openDoc(content: string): Promise<vscode.TextEditor> {
  const doc = await vscode.workspace.openTextDocument({ content });
  return vscode.window.showTextDocument(doc);
}

describe('randomizeSelection — anonymize in place', function () {
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    await setConfig(ConfigKey.SEED, String(SEED));
  });

  after(async () => {
    await setConfig(ConfigKey.SEED, undefined);
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it('replaces each non-empty selection with a same-shape random value', async () => {
    const editor = await openDoc('Alice Smith 42\ncontact: Bob@x.io');
    editor.selections = [
      new vscode.Selection(0, 0, 0, 'Alice Smith'.length),
      new vscode.Selection(1, 'contact: '.length, 1, 'contact: Bob@x.io'.length),
    ];
    await vscode.commands.executeCommand(CMD);
    assert.match(editor.document.lineAt(0).text, /^[A-Z][a-z]{4} [A-Z][a-z]{4} 42$/, 'case pattern, space and the unselected 42 must survive');
    assert.match(editor.document.lineAt(1).text, /^contact: [A-Z][a-z]{2}@[a-z]\.[a-z]{2}$/, 'the email keeps its shape and the unselected prefix stays');
    assert.notStrictEqual(editor.document.lineAt(0).text, 'Alice Smith 42', 'the selected text was actually re-rolled');
  });

  it('leaves empty selections alone in a mixed multi-selection', async () => {
    const editor = await openDoc('keep\nRandomizeMe');
    editor.selections = [
      new vscode.Selection(0, 2, 0, 2), // bare caret — must not receive an insert
      new vscode.Selection(1, 0, 1, 'RandomizeMe'.length),
    ];
    await vscode.commands.executeCommand(CMD);
    assert.strictEqual(editor.document.lineAt(0).text, 'keep', 'nothing may be inserted at the bare caret');
    assert.match(editor.document.lineAt(1).text, /^[A-Z][a-z]{8}[A-Z][a-z]$/);
  });

  it('does not leave the replacement selected — the cursor lands after it', async () => {
    const editor = await openDoc('RandomizeMe');
    editor.selection = new vscode.Selection(0, 0, 0, 'RandomizeMe'.length);
    await vscode.commands.executeCommand(CMD);
    assert.ok(editor.selections.every((selection) => selection.isEmpty), 'replaced text must not stay highlighted');
    assert.deepStrictEqual(
      [ editor.selection.active.line, editor.selection.active.character ],
      [ 0, 'RandomizeMe'.length ],
    );
  });

  it('shows one gentle info message and edits nothing when no text is selected', async () => {
    const editor = await openDoc('untouched');
    editor.selection = new vscode.Selection(0, 3, 0, 3);
    const messages: string[] = [];
    const original = vscode.window.showInformationMessage;
    (vscode.window as any).showInformationMessage = async (message: string) => { messages.push(message); return undefined; };
    try {
      await vscode.commands.executeCommand(CMD);
    } finally {
      (vscode.window as any).showInformationMessage = original;
    }
    assert.strictEqual(editor.document.getText(), 'untouched');
    assert.strictEqual(messages.length, 1, 'exactly one info message');
    assert.match(messages[0], /select/i);
  });

  it('is the same gentle no-op with no editor open at all', async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const messages: string[] = [];
    const original = vscode.window.showInformationMessage;
    (vscode.window as any).showInformationMessage = async (message: string) => { messages.push(message); return undefined; };
    try {
      await vscode.commands.executeCommand(CMD);
    } finally {
      (vscode.window as any).showInformationMessage = original;
    }
    assert.strictEqual(messages.length, 1);
  });

  it('seeded runs repeat', async () => {
    const first = await openDoc('Secret Value 123');
    first.selection = new vscode.Selection(0, 0, 0, 'Secret Value 123'.length);
    await vscode.commands.executeCommand(CMD);
    const a = first.document.getText();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const second = await openDoc('Secret Value 123');
    second.selection = new vscode.Selection(0, 0, 0, 'Secret Value 123'.length);
    await vscode.commands.executeCommand(CMD);
    assert.strictEqual(second.document.getText(), a, 'same seed + same selection → same randomization');
  });

  it('ignores quote/newline settings — a replacement, not an insertion', async () => {
    await setConfig(ConfigKey.WITH_QUOTE, true);
    await setConfig(ConfigKey.WITH_NEW_LINE, true);
    try {
      const editor = await openDoc('abc');
      editor.selection = new vscode.Selection(0, 0, 0, 3);
      await vscode.commands.executeCommand(CMD);
      assert.match(editor.document.getText(), /^[a-z]{3}$/, 'no quotes, no trailing newline — bare same-shape text');
    } finally {
      await setConfig(ConfigKey.WITH_QUOTE, undefined);
      await setConfig(ConfigKey.WITH_NEW_LINE, undefined);
    }
  });
});
