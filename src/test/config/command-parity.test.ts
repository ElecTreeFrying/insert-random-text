import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { getGenerator } from '../../catalog';
import { promptedCommands } from '../../prompted';

// COMMAND_TO_GENERATOR (extension.ts) is the wiring between a palette command and the generator it
// inserts. extension.ts imports `vscode`, so we can't import the map under a plain-node run — read it
// off disk and parse the object literal (the same source-as-contract tactic as command-contributions).
// This pins the three ways the wiring drifts while the catalog grows: a mapping to a non-existent
// generator, a mapping whose command isn't contributed, and a contributed generator command with no
// mapping (a palette entry that fires nothing).

const ROOT = path.join(__dirname, '..', '..', '..');
const extensionSrc = fs.readFileSync(path.join(ROOT, 'src', 'extension.ts'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const declared: string[] = pkg.contributes.commands.map((c: { command: string }) => c.command);

// Slice out just the COMMAND_TO_GENERATOR object literal, then pull every 'command': 'generator' pair.
function readCommandMap(source: string): Record<string, string> {
  const start = source.indexOf('COMMAND_TO_GENERATOR');
  assert.notStrictEqual(start, -1, 'COMMAND_TO_GENERATOR not found — did it get renamed?');
  const open = source.indexOf('{', start);
  const close = source.indexOf('\n};', open);
  assert.notStrictEqual(close, -1, 'could not find the end of the COMMAND_TO_GENERATOR literal');
  const body = source.slice(open, close);
  const map: Record<string, string> = {};
  for (const match of body.matchAll(/'([\w.]+)'\s*:\s*'([\w.]+)'/g)) {
    map[match[1]] = match[2];
  }
  return map;
}

const commandMap = readCommandMap(extensionSrc);
// The commands that are NOT generator-backed: the Quick Pick, the multi-field Record command, the
// Generate Dataset… file builder, the Randomize Selection editor action, and every settings command
// (set/toggle/manage/reset).
const META = /^insertRandomText\.(pick|record|generateDataset|randomizeSelection|set|toggle|reset|manage)/;
// Prompted (parameterized) commands are registered from `promptedCommands`, not COMMAND_TO_GENERATOR.
const PROMPTED = new Set(promptedCommands.map((command) => `insertRandomText.${command.id}`));

describe('COMMAND_TO_GENERATOR ↔ catalog parity', () => {
  it('parses a non-trivial map out of the source', () => {
    assert.ok(Object.keys(commandMap).length >= 100, `only parsed ${Object.keys(commandMap).length} entries — is the slice right?`);
  });

  it('every mapped generator id exists in the catalog', () => {
    for (const [ command, generatorId ] of Object.entries(commandMap)) {
      assert.ok(getGenerator(generatorId), `${command} → '${generatorId}' has no generator in the catalog`);
    }
  });

  it('every mapped command is declared in package.json contributes.commands', () => {
    const declaredSet = new Set(declared);
    for (const command of Object.keys(commandMap)) {
      assert.ok(declaredSet.has(command), `${command} is mapped but not contributed in package.json`);
    }
  });

  it('every contributed generator command is wired (only pick/settings/prompted commands may be unmapped)', () => {
    const unwired = declared.filter((command) => !commandMap[command] && !META.test(command) && !PROMPTED.has(command));
    assert.deepStrictEqual(unwired, [], `contributed but missing a COMMAND_TO_GENERATOR entry: ${unwired.join(', ')}`);
  });

  it('every prompted command is declared in package.json contributes.commands', () => {
    const declaredSet = new Set(declared);
    for (const command of PROMPTED) {
      assert.ok(declaredSet.has(command), `${command} is a prompted command but not contributed in package.json`);
    }
  });

  it('no prompted id collides with a catalog generator id (they share the insertRandomText.* namespace)', () => {
    for (const { id } of promptedCommands) {
      assert.strictEqual(getGenerator(id), undefined, `prompted id '${id}' shadows a catalog generator`);
    }
  });

  it('every hidden generator is reachable through a command (else it is dead code)', () => {
    // hidden generators are excluded from the Quick Pick, so a command is their ONLY entry point.
    const mappedGenerators = new Set(Object.values(commandMap));
    for (const id of [ 'loremSmall', 'loremMedium', 'loremLarge', 'hashSmall', 'hashMedium', 'hashLarge' ]) {
      assert.ok(mappedGenerators.has(id), `hidden generator '${id}' has no command — unreachable`);
    }
  });
});
