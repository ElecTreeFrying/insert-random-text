import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

import { deactivate } from '../extension';

// Runtime activation + command-registration smoke, the auto-import way (getExtension().activate() then
// vscode.commands.getCommands). This complements config/command-parity.test.ts: that one statically pins
// the COMMAND_TO_GENERATOR wiring off disk; this proves every declared command is actually REGISTERED in
// a running VS Code — catching a command that's contributed but never reaches registerCommand (a dead
// palette/menu entry). Runs only under the Extension Host (`npm test`), not the plain-node run.
const EXTENSION_ID = 'ElecTreeFrying.insert-random-text';
const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', 'package.json'), 'utf8'));
const declared: string[] = pkg.contributes.commands.map((c: { command: string }) => c.command);

describe('extension activation', () => {
  before(async () => {
    await vscode.extensions.getExtension(EXTENSION_ID)?.activate();
  });

  it('activates', () => {
    assert.strictEqual(vscode.extensions.getExtension(EXTENSION_ID)?.isActive, true);
  });

  it('registers every command declared in package.json', async () => {
    const registered = new Set(await vscode.commands.getCommands(true));
    const missing = declared.filter((command) => !registered.has(command));
    assert.deepStrictEqual(missing, [], `declared but not registered: ${missing.join(', ')}`);
  });

  it('deactivate() is a safe no-op', () => {
    assert.doesNotThrow(() => deactivate());
    assert.strictEqual(deactivate(), undefined);
  });
});
