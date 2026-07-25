import * as assert from 'assert';
import * as fs from 'fs';
import * as path from 'path';

import { promptedCommands } from '../../prompted';

// SPEC.md states its totals as exact literals ("190 contributed commands", "157 entries") rather
// than soft "190+" figures — a deliberate choice recorded in CLAUDE.md. An exact number in prose is
// a second copy of a list's length with no sync gate, which is how six of them went stale in one
// step when the fourteen legacy ids gained namespaced twins. This pins every literal to the
// manifest that defines it, so the manifest and the contract can't drift apart again.

const ROOT = path.join(__dirname, '..', '..', '..');
const spec = fs.readFileSync(path.join(ROOT, 'SPEC.md'), 'utf8');
const extensionSrc = fs.readFileSync(path.join(ROOT, 'src', 'extension.ts'), 'utf8');
const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

const commands: string[] = pkg.contributes.commands.map((c: { command: string }) => c.command);

// Same split the parity test uses: everything that is not a meta command or a prompted command is a
// generator command.
const META = /^insertRandomText\.(pick|record|generateDataset|randomizeSelection|set|toggle|reset|manage)/;
const PROMPTED = new Set(promptedCommands.map((command) => `insertRandomText.${command.id}`));

const total = commands.length;
const legacy = commands.filter((command) => command.startsWith('extension.')).length;
const generators = commands.filter((command) => !META.test(command) && !PROMPTED.has(command)).length;
const modern = generators - legacy;

function countCommandMapEntries(source: string): number {
  const start = source.indexOf('COMMAND_TO_GENERATOR');
  assert.notStrictEqual(start, -1, 'COMMAND_TO_GENERATOR not found — did it get renamed?');
  const open = source.indexOf('{', start);
  const close = source.indexOf('\n};', open);
  assert.notStrictEqual(close, -1, 'could not find the end of the COMMAND_TO_GENERATOR literal');
  return [ ...source.slice(open, close).matchAll(/'([\w.]+)'\s*:\s*'([\w.]+)'/g) ].length;
}

const mapEntries = countCommandMapEntries(extensionSrc);

// Pull one figure out of SPEC.md. A reworded sentence must fail loudly rather than quietly matching
// nothing — a gate that can't find its number is a gate that always passes.
function stated(pattern: RegExp, label: string): number {
  const match = spec.match(pattern);
  assert.ok(match, `SPEC.md: could not find the ${label} figure. If the wording changed, update this pattern — do not delete the check.`);
  return Number(match[1]);
}

describe('SPEC.md totals ↔ manifest parity', () => {
  it('the front-matter contributed-command total matches package.json', () => {
    assert.strictEqual(stated(/\*\*(\d+) contributed commands\*\*/, 'front-matter contributed-command'), total);
  });

  it('the Commands-section total matches package.json', () => {
    assert.strictEqual(stated(/contributes \*\*(\d+) commands\*\*/, 'Commands-section total'), total);
  });

  it('the Activation-section total matches package.json', () => {
    assert.strictEqual(stated(/any of the (\d+) commands activates/, 'Activation-section total'), total);
  });

  it('the generator-command count matches package.json', () => {
    assert.strictEqual(stated(/\|\s*Generator commands\s*\|\s*(\d+)\s*\|/, 'generator-command row'), generators);
  });

  it('the legacy-namespace count matches package.json', () => {
    assert.strictEqual(stated(/\(legacy, (\d+)/, 'legacy-namespace'), legacy);
  });

  it('the modern-namespace count matches package.json', () => {
    assert.strictEqual(stated(/\(modern, (\d+)\)/, 'modern-namespace'), modern);
  });

  it('the COMMAND_TO_GENERATOR entry count matches extension.ts', () => {
    assert.strictEqual(stated(/COMMAND_TO_GENERATOR` map \((\d+) entries\)/, 'COMMAND_TO_GENERATOR entry'), mapEntries);
  });

  it('the command-family table rows sum to the stated total', () => {
    const table = spec.slice(spec.indexOf('| Family | Count |'));
    const rows = [ ...table.slice(0, table.indexOf('\n\n')).matchAll(/^\|[^|]+\|\s*(\d+)\s*\|/gm) ];
    assert.ok(rows.length >= 7, `only parsed ${rows.length} family rows — is the table still there?`);
    const sum = rows.reduce((running, row) => running + Number(row[1]), 0);
    assert.strictEqual(sum, total, `the ${rows.length} family rows sum to ${sum}, but the extension contributes ${total} commands`);
  });
});
