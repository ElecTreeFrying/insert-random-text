import * as assert from 'assert';

import { getPromptedCommand, promptedCommands, toGenerator } from '../../prompted';
import { load, seed } from '../../engine';

// The prompted-command registry is pure (no vscode import): each entry declares its input-box steps
// (prompt/placeholder/fallback + a validateInput-shaped validator) and a render(params) that draws one
// fresh value. The vscode glue in extension.ts just walks the steps — so everything that can be wrong
// about a prompted command (validation rules, rendering, the Generator contract) is checkable here.

describe('prompted — registry', () => {
  it('exposes the three S2 commands, id-addressable', () => {
    assert.deepStrictEqual(
      promptedCommands.map((command) => command.id),
      [ 'numberRange', 'floatRange', 'stringLength' ],
    );
    for (const command of promptedCommands) {
      assert.strictEqual(getPromptedCommand(command.id), command);
      assert.ok(command.label.length > 0, `'${command.id}' needs a label`);
      assert.ok(command.group.length > 0, `'${command.id}' needs a group`);
      assert.ok(command.steps.length > 0, `'${command.id}' needs at least one input step`);
    }
    assert.strictEqual(getPromptedCommand('nope'), undefined);
  });

  it('every step carries the input-box texts and a prefill fallback', () => {
    for (const command of promptedCommands) {
      for (const step of command.steps) {
        assert.ok(step.key.length > 0, `${command.id} step needs a key`);
        assert.ok(step.prompt.length > 0, `${command.id}.${step.key} needs a prompt`);
        assert.ok(step.placeholder.length > 0, `${command.id}.${step.key} needs a placeholder`);
        assert.strictEqual(step.validate(step.fallback, {}), undefined,
          `${command.id}.${step.key} fallback '${step.fallback}' must pass its own validation`);
      }
    }
  });

  it('range commands validate their fallbacks as a pair (max fallback vs min fallback)', () => {
    for (const id of [ 'numberRange', 'floatRange' ]) {
      const [ min, max ] = getPromptedCommand(id)!.steps;
      assert.strictEqual(max.validate(max.fallback, { min: min.fallback }), undefined,
        `${id} fallbacks must form a valid range`);
    }
  });
});

describe('prompted — numberRange validation', () => {
  const [ min, max ] = getPromptedCommand('numberRange')?.steps ?? [];

  it('min accepts integers (negative and padded included)', () => {
    for (const input of [ '0', '42', '-5', ' 7 ' ]) {
      assert.strictEqual(min.validate(input, {}), undefined, `'${input}' should be a valid min`);
    }
  });

  it('min rejects empty, non-numeric, fractional, and unsafe-magnitude input', () => {
    for (const input of [ '', '   ', 'abc', '1.5', '9007199254740993' ]) {
      assert.ok(min.validate(input, {}), `'${input}' should be rejected with a message`);
    }
  });

  it('max enforces min ≤ max against the already-entered min', () => {
    assert.ok(max.validate('5', { min: '10' }), 'max below min must be rejected');
    assert.strictEqual(max.validate('10', { min: '10' }), undefined, 'max equal to min is a valid (pinned) range');
    assert.strictEqual(max.validate('11', { min: '10' }), undefined);
  });
});

describe('prompted — floatRange validation', () => {
  const [ min, max ] = getPromptedCommand('floatRange')?.steps ?? [];

  it('min accepts any finite number', () => {
    for (const input of [ '0', '0.5', '-1.25', '3', ' 2.5 ' ]) {
      assert.strictEqual(min.validate(input, {}), undefined, `'${input}' should be a valid min`);
    }
  });

  it('min rejects empty and non-numeric input', () => {
    for (const input of [ '', '  ', 'x', 'NaN', 'Infinity' ]) {
      assert.ok(min.validate(input, {}), `'${input}' should be rejected with a message`);
    }
  });

  it('max enforces min ≤ max', () => {
    assert.ok(max.validate('0.5', { min: '1' }), 'max below min must be rejected');
    assert.strictEqual(max.validate('1', { min: '1' }), undefined);
  });

  it('max rejects a range too narrow to contain a 2-decimal value (mirrors the faker draw)', () => {
    // faker.number.float({ fractionDigits: 2 }) draws int(ceil(min*100)..floor(max*100)) / 100 and
    // throws when that integer range is empty — the validator must reject exactly those inputs.
    assert.ok(max.validate('0.002', { min: '0.001' }), 'no multiple of 0.01 lies in [0.001, 0.002]');
    assert.strictEqual(max.validate('0.005', { min: '0' }), undefined, '0.00 lies in [0, 0.005]');
    assert.strictEqual(max.validate('0.01', { min: '0.001' }), undefined, '0.01 lies in [0.001, 0.01]');
  });
});

describe('prompted — stringLength validation', () => {
  const [ length ] = getPromptedCommand('stringLength')?.steps ?? [];

  it('accepts 1 through 1000', () => {
    for (const input of [ '1', '15', '1000' ]) {
      assert.strictEqual(length.validate(input, {}), undefined, `'${input}' should be a valid length`);
    }
  });

  it('rejects out-of-range and non-integer input', () => {
    for (const input of [ '0', '1001', '-3', '2.5', 'abc', '' ]) {
      assert.ok(length.validate(input, {}), `'${input}' should be rejected with a message`);
    }
  });
});

describe('prompted — rendering (one-off Generator through toGenerator)', function () {
  this.timeout(15000);

  before(async () => {
    await load();
  });

  it('wraps a command as a Generator carrying its id/label/group', () => {
    const command = getPromptedCommand('numberRange')!;
    const generator = toGenerator(command, { min: '1', max: '2' });
    assert.strictEqual(generator.id, command.id);
    assert.strictEqual(generator.label, command.label);
    assert.strictEqual(generator.group, command.group);
  });

  it('numberRange draws integers within [min, max], as strings', () => {
    seed(20260702);
    const generator = toGenerator(getPromptedCommand('numberRange')!, { min: '1', max: '3' });
    for (let i = 0; i < 50; i++) {
      const value = Number(generator.generate());
      assert.ok(Number.isInteger(value) && value >= 1 && value <= 3, `${value} outside [1, 3]`);
    }
  });

  it('numberRange with min = max pins the value (negative included)', () => {
    const generator = toGenerator(getPromptedCommand('numberRange')!, { min: '-3', max: '-3' });
    assert.strictEqual(generator.generate(), '-3');
  });

  it('floatRange renders two fraction digits, matching the catalog float style', () => {
    const pinned = toGenerator(getPromptedCommand('floatRange')!, { min: '2', max: '2' });
    assert.strictEqual(pinned.generate(), '2.00');
    seed(20260702);
    const ranged = toGenerator(getPromptedCommand('floatRange')!, { min: '0.5', max: '1.5' });
    for (let i = 0; i < 50; i++) {
      const value = ranged.generate();
      assert.match(value, /^\d+\.\d{2}$/, `'${value}' is not a 2-decimal rendering`);
      assert.ok(Number(value) >= 0.5 && Number(value) <= 1.5, `${value} outside [0.5, 1.5]`);
    }
  });

  it('stringLength draws exactly N alphanumeric characters', () => {
    seed(20260702);
    const generator = toGenerator(getPromptedCommand('stringLength')!, { length: '12' });
    for (let i = 0; i < 20; i++) {
      assert.match(generator.generate(), /^[A-Za-z0-9]{12}$/);
    }
  });

  it('draws a fresh value on each generate() call — no memoization', () => {
    seed(4242);
    const generator = toGenerator(getPromptedCommand('numberRange')!, { min: '1', max: '1000000000' });
    const values = new Set(Array.from({ length: 5 }, () => generator.generate()));
    assert.ok(values.size > 1, 'expected distinct values across repeated calls');
  });

  it('draws through the shared faker accessor — the same seed reproduces the same sequence', () => {
    const generator = toGenerator(getPromptedCommand('stringLength')!, { length: '20' });
    seed(7);
    const first = [ generator.generate(), generator.generate() ];
    seed(7);
    const second = [ generator.generate(), generator.generate() ];
    assert.deepStrictEqual(first, second);
  });
});
