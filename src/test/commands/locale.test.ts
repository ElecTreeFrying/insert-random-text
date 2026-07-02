import * as assert from 'assert';
import * as vscode from 'vscode';

import { ConfigKey } from '../../configuration';

// insertRandomText.locale swaps which faker data set EVERY generator draws from — set 'de' and
// insertRandomText.firstName produces German names, with no reload. Assertions compare the inserted
// text against a locally imported locale instance under the suite's seed: the bundled extension and
// this test each hold their own Faker copy, but identical version + identical seed → identical
// sequence, so expectations track faker upgrades instead of pinning today's strings.
const EXTENSION_ID = 'ElecTreeFrying.insert-random-text';
const CMD = 'insertRandomText.firstName';
const SEED = 2026;

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

/** The first firstName the given locale draws under the suite's seed. */
async function expectedFirstName(locale: 'en' | 'de' | 'ja'): Promise<string> {
  const { faker } = locale === 'de'
    ? await import('@faker-js/faker/locale/de')
    : locale === 'ja'
      ? await import('@faker-js/faker/locale/ja')
      : await import('@faker-js/faker/locale/en');
  faker.seed(SEED);
  return faker.person.firstName();
}

describe('locale — localized draws through the insert pipeline', function () {
  this.timeout(20000);

  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
    await setConfig(ConfigKey.WITH_QUOTE, false);
    await setConfig(ConfigKey.WITH_NEW_LINE, false);
    await setConfig(ConfigKey.SEED, String(SEED));
  });

  after(async () => {
    await setConfig(ConfigKey.WITH_QUOTE, undefined);
    await setConfig(ConfigKey.WITH_NEW_LINE, undefined);
    await setConfig(ConfigKey.SEED, undefined);
    // The active instance is a module singleton in the shared extension host —
    // leave it (and the setting) on English data for the suites that run after.
    await setConfig(ConfigKey.LOCALE, undefined);
  });

  afterEach(async () => {
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
  });

  it("locale 'de' draws German data through the normal pipeline", async () => {
    await setConfig(ConfigKey.LOCALE, 'de');
    const editor = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    assert.strictEqual(editor.document.getText(), await expectedFirstName('de'));
  });

  it('seeded runs repeat per locale', async () => {
    await setConfig(ConfigKey.LOCALE, 'ja');
    const first = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    const a = first.document.getText();
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    const second = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    assert.strictEqual(second.document.getText(), a, 'same seed + same locale → same value');
    assert.strictEqual(a, await expectedFirstName('ja'), 'and it is the ja data set that repeats');
  });

  it('switching back to en applies to the next insert, no reload', async () => {
    await setConfig(ConfigKey.LOCALE, 'de');
    const german = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    assert.strictEqual(german.document.getText(), await expectedFirstName('de'));
    await vscode.commands.executeCommand('workbench.action.closeAllEditors');
    await setConfig(ConfigKey.LOCALE, 'en');
    const english = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    assert.strictEqual(english.document.getText(), await expectedFirstName('en'));
  });

  it('an unshipped locale value falls back to en data', async () => {
    await setConfig(ConfigKey.LOCALE, 'zh_CN');
    const editor = await openDoc('');
    await vscode.commands.executeCommand(CMD);
    assert.strictEqual(editor.document.getText(), await expectedFirstName('en'));
  });
});
