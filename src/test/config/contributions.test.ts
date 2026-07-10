import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

// The package.json contribution blocks are data VS Code renders directly — a typo'd `when` clause or a
// submenu item pointing at a nothing-command renders as a silently missing menu entry, with no error
// anywhere. No API can open a context menu or the palette, so this pins the DATA half of those surfaces;
// the RENDERING half (the submenu actually appearing on right-click) stays in qa/checklists/manual-qa.md.

const ROOT = path.join(__dirname, '..', '..', '..');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const commands: { command: string; title: string }[] = pkg.contributes.commands;
const declared = new Set(commands.map((c) => c.command));

const SUBMENU_ID = 'insertRandomText.contextSubmenu';

describe('package.json contributions — palette & keybindings', () => {
  it("every command title carries the 'Insert Random: ' palette prefix", () => {
    const bare = commands.filter((c) => !c.title.startsWith('Insert Random: '));
    assert.deepStrictEqual(bare.map((c) => c.command), [], 'commands missing the searchable prefix');
  });

  it('ships zero default keybindings (by design — never squat on user chords)', () => {
    assert.strictEqual(pkg.contributes.keybindings, undefined);
  });
});

describe('package.json contributions — editor context menu', () => {
  const editorContext = pkg.contributes.menus['editor/context'] ?? [];
  const submenuItems = pkg.contributes.menus[SUBMENU_ID] ?? [];

  it('editor/context contributes exactly one entry: the Insert Random submenu', () => {
    assert.strictEqual(editorContext.length, 1);
    assert.strictEqual(editorContext[0].submenu, SUBMENU_ID);
  });

  it('the submenu is declared with its display label', () => {
    const submenus = pkg.contributes.submenus ?? [];
    const entry = submenus.find((s: { id: string }) => s.id === SUBMENU_ID);
    assert.ok(entry, `contributes.submenus is missing '${SUBMENU_ID}'`);
    assert.strictEqual(entry.label, 'Insert Random');
  });

  it('the when clause gates on editor focus AND the real contextMenu setting key', () => {
    const when = editorContext[0]?.when ?? '';
    assert.ok(when.includes('editorTextFocus'), `when clause lost the focus guard: '${when}'`);
    assert.ok(when.includes('config.insertRandomText.contextMenu.enabled'), `when clause references a wrong/missing key: '${when}'`);
  });

  it('the when-clause setting key exists in contributes.configuration', () => {
    const conf = pkg.contributes.configuration;
    const properties = Array.isArray(conf)
      ? Object.assign({}, ...conf.map((section: { properties: object }) => section.properties))
      : conf.properties;
    assert.ok(properties['insertRandomText.contextMenu.enabled'], 'the setting the when clause reads is not declared');
  });

  it('every submenu item is a declared command (a typo here renders as a missing menu row)', () => {
    assert.ok(submenuItems.length > 0, 'the submenu has no items');
    for (const item of submenuItems) {
      assert.ok(declared.has(item.command), `submenu item '${item.command}' is not in contributes.commands`);
    }
  });

  it('the submenu keeps its curated shape: Pick… first, 8 items total', () => {
    assert.strictEqual(submenuItems.length, 8, 'the submenu is curated at 8 items — update this test deliberately if that changes');
    assert.strictEqual(submenuItems[0].command, 'insertRandomText.pick');
  });

  it('Randomize Selection closes the submenu in its own group (S9 — anonymize in place)', () => {
    const item = submenuItems.find((entry: { command: string }) => entry.command === 'insertRandomText.randomizeSelection');
    assert.ok(item, 'the submenu lost its Randomize Selection entry');
    assert.strictEqual(item.group, '4_anonymize', 'randomize is an action, not an insert — it gets its own trailing group');
  });
});
