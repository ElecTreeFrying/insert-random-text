import * as assert from 'assert';

import { formatUuid, getPromptedCommand, InputStep, PickStep, promptedCommands, toGenerator } from '../../prompted';
import { load, seed } from '../../engine';

// The prompted-command registry is pure (no vscode import): each entry declares its steps — input boxes
// (prompt/placeholder/fallback + a validateInput-shaped validator) and Quick Picks (options + fallback) —
// and a render(params) that draws one fresh value. The vscode glue in extension.ts just walks the steps —
// so everything that can be wrong about a prompted command (validation rules, pick options, rendering,
// the Generator contract) is checkable here.

/** The input-box steps of a command, typed; pick steps filtered out. */
function inputSteps(id: string): readonly InputStep[] {
  return (getPromptedCommand(id)?.steps ?? []).filter((step): step is InputStep => step.kind !== 'pick');
}

/** The Quick Pick steps of a command, typed; input-box steps filtered out. */
function pickSteps(id: string): readonly PickStep[] {
  return (getPromptedCommand(id)?.steps ?? []).filter((step): step is PickStep => step.kind === 'pick');
}

describe('prompted — registry', function () {
  this.timeout(15000);

  // The template/pattern validators prove their input by test-rendering through
  // faker, so the registry checks that exercise validate() need the engine live —
  // mirroring the glue, which awaits load() before the first box opens.
  before(async () => {
    await load();
  });

  it('exposes the parameterized commands, id-addressable', () => {
    assert.deepStrictEqual(
      promptedCommands.map((command) => command.id),
      [
        'numberRange', 'floatRange', 'stringLength', 'dateBetween',
        'wordsCount', 'sentencesCount', 'paragraphsCount',
        'uuidFormat', 'passwordOptions', 'phoneFormat',
        'fromTemplate', 'fromPattern', 'sequence',
      ],
    );
    for (const command of promptedCommands) {
      assert.strictEqual(getPromptedCommand(command.id), command);
      assert.ok(command.label.length > 0, `'${command.id}' needs a label`);
      assert.ok(command.group.length > 0, `'${command.id}' needs a group`);
      assert.ok(command.steps.length > 0, `'${command.id}' needs at least one input step`);
    }
    assert.strictEqual(getPromptedCommand('nope'), undefined);
  });

  it('every step carries its prompt texts and a valid prefill fallback', () => {
    for (const command of promptedCommands) {
      for (const step of command.steps) {
        assert.ok(step.key.length > 0, `${command.id} step needs a key`);
        assert.ok(step.prompt.length > 0, `${command.id}.${step.key} needs a prompt`);
        if (step.kind === 'pick') {
          assert.ok(step.options.length >= 2, `${command.id}.${step.key} needs at least two options`);
          const values = step.options.map((option) => option.value);
          assert.strictEqual(new Set(values).size, values.length, `${command.id}.${step.key} option values must be unique`);
          assert.ok(values.includes(step.fallback), `${command.id}.${step.key} fallback '${step.fallback}' must be one of its options`);
          for (const option of step.options) {
            assert.ok(option.label.length > 0 && option.detail.length > 0,
              `${command.id}.${step.key} option '${option.value}' needs a label and a detail`);
          }
        } else {
          assert.ok(step.placeholder.length > 0, `${command.id}.${step.key} needs a placeholder`);
          assert.strictEqual(step.validate(step.fallback, {}), undefined,
            `${command.id}.${step.key} fallback '${step.fallback}' must pass its own validation`);
        }
      }
    }
  });

  it('every command defines exactly one rendering surface — render or createRender', () => {
    for (const command of promptedCommands) {
      const surfaces = [ command.render, command.createRender ].filter(Boolean).length;
      assert.strictEqual(surfaces, 1, `'${command.id}' must define exactly one of render/createRender`);
    }
  });

  it('range commands validate their fallbacks as a pair (max fallback vs min fallback)', () => {
    for (const id of [ 'numberRange', 'floatRange' ]) {
      const [ min, max ] = inputSteps(id);
      assert.strictEqual(max.validate(max.fallback, { min: min.fallback }), undefined,
        `${id} fallbacks must form a valid range`);
    }
    const [ from, to ] = inputSteps('dateBetween');
    assert.strictEqual(to.validate(to.fallback, { from: from.fallback }), undefined,
      'dateBetween fallbacks must form a valid range');
  });
});

describe('prompted — numberRange validation', () => {
  const [ min, max ] = inputSteps('numberRange');

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
  const [ min, max ] = inputSteps('floatRange');

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
  const [ length ] = inputSteps('stringLength');

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

describe('prompted — dateBetween validation', () => {
  const [ from, to ] = inputSteps('dateBetween');

  it('from accepts YYYY-MM-DD and full ISO 8601 (padding tolerated)', () => {
    for (const input of [ '2020-01-01', ' 2020-01-01 ', '2026-07-02T12:00:00Z', '2026-07-02T12:00', '2026-07-02T12:00:00.500+02:00' ]) {
      assert.strictEqual(from.validate(input, {}), undefined, `'${input}' should be a valid date`);
    }
  });

  it('from rejects empty, non-date, and impossible-calendar input', () => {
    for (const input of [ '', '   ', 'yesterday', '01/02/2026', '20260702', '5', '2026-13-01', '2026-02-31' ]) {
      assert.ok(from.validate(input, {}), `'${input}' should be rejected with a message`);
    }
  });

  it('to enforces from ≤ to against the already-entered from', () => {
    assert.ok(to.validate('2019-12-31', { from: '2020-01-01' }), 'to before from must be rejected');
    assert.strictEqual(to.validate('2020-01-01', { from: '2020-01-01' }), undefined, 'to equal to from pins the date');
    assert.strictEqual(to.validate('2020-01-02', { from: '2020-01-01' }), undefined);
  });
});

describe('prompted — count validation (wordsCount / sentencesCount / paragraphsCount)', () => {
  for (const id of [ 'wordsCount', 'sentencesCount', 'paragraphsCount' ]) {
    describe(id, () => {
      const [ count ] = inputSteps(id);

      it('accepts 1 through 100 (padding tolerated)', () => {
        for (const input of [ '1', '3', '100', ' 42 ' ]) {
          assert.strictEqual(count.validate(input, {}), undefined, `'${input}' should be a valid count`);
        }
      });

      it('rejects out-of-range and non-integer input', () => {
        for (const input of [ '0', '101', '-3', '2.5', 'abc', '' ]) {
          assert.ok(count.validate(input, {}), `'${input}' should be rejected with a message`);
        }
      });
    });
  }
});

describe('prompted — pick steps (uuidFormat / passwordOptions / phoneFormat)', () => {
  it('carries the S5 format variants with their catalog groups', () => {
    assert.deepStrictEqual(
      [ 'uuidFormat', 'passwordOptions', 'phoneFormat' ].map((id) => {
        const { label, group } = getPromptedCommand(id)!;
        return { id, label, group };
      }),
      [
        { id: 'uuidFormat', label: 'UUID (Format…)', group: 'IDs' },
        { id: 'passwordOptions', label: 'Password (Options…)', group: 'Security' },
        { id: 'phoneFormat', label: 'Phone (Format…)', group: 'Identity' },
      ],
    );
  });

  it('uuidFormat asks for one of the five formats, defaulting to lowercase', () => {
    assert.strictEqual(getPromptedCommand('uuidFormat')!.steps.length, 1);
    const [ format ] = pickSteps('uuidFormat');
    assert.strictEqual(format.key, 'format');
    assert.deepStrictEqual(
      format.options.map((option) => option.value),
      [ 'lowercase', 'uppercase', 'braced', 'noDashes', 'uppercaseNoDashes' ],
    );
    assert.strictEqual(format.fallback, 'lowercase');
  });

  it('passwordOptions asks for a length box, then a symbols yes/no pick', () => {
    const steps = getPromptedCommand('passwordOptions')!.steps;
    assert.deepStrictEqual(
      steps.map((step) => [ step.key, step.kind === 'pick' ? 'pick' : 'input' ]),
      [ [ 'length', 'input' ], [ 'symbols', 'pick' ] ],
    );
    const [ symbols ] = pickSteps('passwordOptions');
    assert.deepStrictEqual(symbols.options.map((option) => option.value), [ 'no', 'yes' ]);
    assert.strictEqual(symbols.fallback, 'no');
  });

  it('phoneFormat asks for one of the three faker phone styles, defaulting to human', () => {
    assert.strictEqual(getPromptedCommand('phoneFormat')!.steps.length, 1);
    const [ style ] = pickSteps('phoneFormat');
    assert.strictEqual(style.key, 'style');
    assert.deepStrictEqual(style.options.map((option) => option.value), [ 'human', 'national', 'international' ]);
    assert.strictEqual(style.fallback, 'human');
  });
});

describe('prompted — passwordOptions length validation', () => {
  const [ length ] = inputSteps('passwordOptions');

  it('accepts 8 through 128 (padding tolerated)', () => {
    for (const input of [ '8', '15', '128', ' 64 ' ]) {
      assert.strictEqual(length.validate(input, {}), undefined, `'${input}' should be a valid length`);
    }
  });

  it('rejects out-of-range and non-integer input', () => {
    for (const input of [ '7', '129', '0', '-8', '2.5', 'abc', '' ]) {
      assert.ok(length.validate(input, {}), `'${input}' should be rejected with a message`);
    }
  });
});

describe('prompted — fromTemplate / fromPattern (custom input)', function () {
  this.timeout(15000);

  // validate() proves free-form input by test-rendering it through faker.
  before(async () => {
    await load();
  });

  it('carries the two custom-input commands, one box each', () => {
    assert.deepStrictEqual(
      [ 'fromTemplate', 'fromPattern' ].map((id) => {
        const { label, group, steps } = getPromptedCommand(id)!;
        return { id, label, group, keys: steps.map((step) => step.key) };
      }),
      [
        { id: 'fromTemplate', label: 'From Template…', group: 'Custom', keys: [ 'template' ] },
        { id: 'fromPattern', label: 'From Pattern…', group: 'Custom', keys: [ 'pattern' ] },
      ],
    );
  });

  it('prefills the documented examples as fallbacks', () => {
    const [ template ] = inputSteps('fromTemplate');
    assert.strictEqual(template.fallback, '{{person.firstName}} <{{internet.email}}>');
    const [ pattern ] = inputSteps('fromPattern');
    assert.strictEqual(pattern.fallback, '[A-Z]{3}-[0-9]{4}');
  });

  it('documents the limited regex subset in the pattern box placeholder', () => {
    const [ pattern ] = inputSteps('fromPattern');
    assert.match(pattern.placeholder, /limited regex subset/i);
  });

  it('template box accepts anything that renders — placeholders, call args, plain text', () => {
    const [ template ] = inputSteps('fromTemplate');
    for (const input of [ '{{person.firstName}} <{{internet.email}}>', 'x-{{string.numeric(3)}}', 'plain text', ' {{internet.email}} ' ]) {
      assert.strictEqual(template.validate(input, {}), undefined, `'${input}' should render`);
    }
  });

  it('template box rejects empty input and unresolvable expressions, offering a working example', () => {
    const [ template ] = inputSteps('fromTemplate');
    for (const input of [ '', '   ', '{{nope.nope}}', '{{person.nope}}' ]) {
      const message = template.validate(input, {});
      assert.ok(message, `'${input}' should be rejected with a message`);
      assert.ok(message!.includes('{{person.firstName}}'), `the message must carry a working example (got: ${message})`);
    }
  });

  it('pattern box accepts the regex subset faker renders', () => {
    const [ pattern ] = inputSteps('fromPattern');
    for (const input of [ '[A-Z]{3}-[0-9]{4}', 'a{2,4}', 'abc?', '[0-9]*x', ' [a-f]{8} ' ]) {
      assert.strictEqual(pattern.validate(input, {}), undefined, `'${input}' should render`);
    }
  });

  it('pattern box rejects empty input and throwing patterns, offering a working example', () => {
    const [ pattern ] = inputSteps('fromPattern');
    for (const input of [ '', '   ', '[z-a]', 'a{4,2}' ]) {
      const message = pattern.validate(input, {});
      assert.ok(message, `'${input}' should be rejected with a message`);
      assert.ok(message!.includes('[A-Z]{3}-[0-9]{4}'), `the message must carry a working example (got: ${message})`);
    }
  });
});

describe('prompted — formatUuid (the pure uuid post-transform)', () => {
  const SAMPLE = '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d';

  it('renders each of the five formats exactly', () => {
    assert.strictEqual(formatUuid(SAMPLE, 'lowercase'), SAMPLE);
    assert.strictEqual(formatUuid(SAMPLE, 'uppercase'), '9B1DEB4D-3B7D-4BAD-9BDD-2B0D7B3DCB6D');
    assert.strictEqual(formatUuid(SAMPLE, 'braced'), '{9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d}');
    assert.strictEqual(formatUuid(SAMPLE, 'noDashes'), '9b1deb4d3b7d4bad9bdd2b0d7b3dcb6d');
    assert.strictEqual(formatUuid(SAMPLE, 'uppercaseNoDashes'), '9B1DEB4D3B7D4BAD9BDD2B0D7B3DCB6D');
  });

  it('leaves the uuid untouched for an unknown format (defensive default)', () => {
    assert.strictEqual(formatUuid(SAMPLE, 'nope'), SAMPLE);
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

  it('dateBetween draws a date within [from, to], full ISO by default', () => {
    seed(20260702);
    const generator = toGenerator(getPromptedCommand('dateBetween')!, { from: '2020-01-01', to: '2020-12-31' });
    for (let i = 0; i < 25; i++) {
      const value = generator.generate();
      assert.match(value, /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/, `'${value}' is not full ISO`);
      const drawn = new Date(value).getTime();
      assert.ok(
        drawn >= Date.parse('2020-01-01T00:00:00Z') && drawn <= Date.parse('2020-12-31T00:00:00Z'),
        `${value} outside [from, to]`,
      );
    }
  });

  it('dateBetween renders through generate({ dateFormat }) — the pipeline threads the setting in', () => {
    // A pinned range (from = to) makes each rendering exact.
    const generator = toGenerator(getPromptedCommand('dateBetween')!, { from: '2020-06-15', to: '2020-06-15' });
    assert.strictEqual(generator.generate({ dateFormat: 'isoDate' }), '2020-06-15');
    assert.strictEqual(generator.generate({ dateFormat: 'unixSeconds' }), String(Date.parse('2020-06-15T00:00:00Z') / 1000));
    assert.strictEqual(generator.generate(), '2020-06-15T00:00:00.000Z');
  });

  it('wordsCount draws exactly N space-separated words (boundaries 1 and 100 included)', () => {
    seed(20260702);
    for (const count of [ 1, 5, 100 ]) {
      const value = toGenerator(getPromptedCommand('wordsCount')!, { count: String(count) }).generate();
      const words = value.split(' ');
      assert.strictEqual(words.length, count, `'${value.slice(0, 40)}…' should hold ${count} words`);
      for (const word of words) { assert.match(word, /^\S+$/, 'every word must be non-empty'); }
    }
  });

  it('sentencesCount draws exactly N period-terminated sentences', () => {
    seed(20260702);
    for (const count of [ 1, 4 ]) {
      const value = toGenerator(getPromptedCommand('sentencesCount')!, { count: String(count) }).generate();
      assert.strictEqual((value.match(/\./g) ?? []).length, count, `'${value}' should hold ${count} sentences`);
      assert.match(value, /^[A-Z]/, 'a sentence starts capitalized');
      assert.ok(value.endsWith('.'), 'the last sentence ends with a period');
    }
  });

  it('paragraphsCount draws exactly N newline-separated paragraphs', () => {
    seed(20260702);
    for (const count of [ 1, 3 ]) {
      const value = toGenerator(getPromptedCommand('paragraphsCount')!, { count: String(count) }).generate();
      const paragraphs = value.split('\n');
      assert.strictEqual(paragraphs.length, count, `${count} paragraphs expected`);
      for (const paragraph of paragraphs) { assert.match(paragraph, /\./, 'each paragraph holds sentences'); }
    }
  });

  it('uuidFormat draws a fresh uuid and renders the picked format', () => {
    seed(20260702);
    const braced = toGenerator(getPromptedCommand('uuidFormat')!, { format: 'braced' });
    assert.match(braced.generate(), /^\{[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\}$/);
    const compactUpper = toGenerator(getPromptedCommand('uuidFormat')!, { format: 'uppercaseNoDashes' });
    assert.match(compactUpper.generate(), /^[0-9A-F]{32}$/);
    const plain = toGenerator(getPromptedCommand('uuidFormat')!, { format: 'lowercase' });
    assert.match(plain.generate(), /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/);
    assert.notStrictEqual(plain.generate(), plain.generate(), 'each generate() draws a fresh uuid');
  });

  it('passwordOptions draws exactly N characters from the picked pool', () => {
    seed(20260702);
    const plain = toGenerator(getPromptedCommand('passwordOptions')!, { length: '12', symbols: 'no' });
    for (let i = 0; i < 10; i++) { assert.match(plain.generate(), /^[A-Za-z0-9]{12}$/); }
    const symbolic = toGenerator(getPromptedCommand('passwordOptions')!, { length: '64', symbols: 'yes' });
    const drawn = Array.from({ length: 3 }, () => symbolic.generate());
    for (const value of drawn) { assert.match(value, /^[A-Za-z0-9!@#$%^&*]{64}$/); }
    assert.match(drawn.join(''), /[!@#$%^&*]/, 'the symbol pool must actually be drawn from');
  });

  it('phoneFormat renders the picked faker style', () => {
    seed(20260702);
    const human = toGenerator(getPromptedCommand('phoneFormat')!, { style: 'human' });
    assert.match(human.generate(), /^[0-9\s().x-]+$/, 'human style: digits with human punctuation');
    const national = toGenerator(getPromptedCommand('phoneFormat')!, { style: 'national' });
    assert.match(national.generate(), /^\(\d{3}\) \d{3}-\d{4}$/);
    const international = toGenerator(getPromptedCommand('phoneFormat')!, { style: 'international' });
    assert.match(international.generate(), /^\+\d{8,15}$/);
  });

  it('fromTemplate re-renders the mustache template with fresh draws each call', () => {
    seed(20260702);
    const generator = toGenerator(getPromptedCommand('fromTemplate')!, { template: 'x-{{string.numeric(3)}}' });
    for (let i = 0; i < 10; i++) { assert.match(generator.generate(), /^x-\d{3}$/); }
    const fresh = toGenerator(getPromptedCommand('fromTemplate')!, { template: '{{string.alphanumeric(12)}}' });
    assert.notStrictEqual(fresh.generate(), fresh.generate(), 'each generate() re-renders with fresh values');
  });

  it('fromTemplate passes plain text through unchanged', () => {
    const generator = toGenerator(getPromptedCommand('fromTemplate')!, { template: 'plain text' });
    assert.strictEqual(generator.generate(), 'plain text');
  });

  it('fromPattern draws a string matching the entered pattern', () => {
    seed(20260702);
    const generator = toGenerator(getPromptedCommand('fromPattern')!, { pattern: '[A-Z]{3}-[0-9]{4}' });
    for (let i = 0; i < 10; i++) { assert.match(generator.generate(), /^[A-Z]{3}-\d{4}$/); }
  });

  it('fromTemplate and fromPattern reproduce under the same seed', () => {
    const template = toGenerator(getPromptedCommand('fromTemplate')!, { template: '{{string.alphanumeric(16)}}' });
    const pattern = toGenerator(getPromptedCommand('fromPattern')!, { pattern: '[a-z0-9]{16}' });
    seed(7);
    const first = [ template.generate(), pattern.generate() ];
    seed(7);
    const second = [ template.generate(), pattern.generate() ];
    assert.deepStrictEqual(first, second);
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

describe('prompted — sequence validation', () => {
  const [ start, step ] = inputSteps('sequence');

  it('start and step accept whole numbers (negative, zero, padded included)', () => {
    for (const box of [ start, step ]) {
      for (const input of [ '1', '0', '-3', ' 7 ', '100000' ]) {
        assert.strictEqual(box.validate(input, {}), undefined, `'${input}' should be a valid whole number`);
      }
    }
  });

  it('start and step reject empty, non-numeric, fractional, and unsafe-magnitude input', () => {
    for (const box of [ start, step ]) {
      for (const input of [ '', '   ', 'abc', '1.5', '9007199254740993' ]) {
        assert.ok(box.validate(input, {}), `'${input}' should be rejected with a message`);
      }
    }
  });
});

describe('prompted — sequence rendering (a stateful counter per insert)', () => {
  it('carries the command with its group, one box per parameter', () => {
    const command = getPromptedCommand('sequence')!;
    assert.strictEqual(command.label, 'Sequence (Start/Step…)');
    assert.strictEqual(command.group, 'Numbers');
    assert.deepStrictEqual(command.steps.map((step) => step.key), [ 'start', 'step' ]);
  });

  it('counts up from start by step across generate() calls — one insert, one running counter', () => {
    const generator = toGenerator(getPromptedCommand('sequence')!, { start: '10', step: '5' });
    assert.deepStrictEqual([ generator.generate(), generator.generate(), generator.generate() ], [ '10', '15', '20' ]);
  });

  it('supports negative and zero steps', () => {
    const down = toGenerator(getPromptedCommand('sequence')!, { start: '5', step: '-2' });
    assert.deepStrictEqual([ down.generate(), down.generate(), down.generate() ], [ '5', '3', '1' ]);
    const flat = toGenerator(getPromptedCommand('sequence')!, { start: '4', step: '0' });
    assert.deepStrictEqual([ flat.generate(), flat.generate() ], [ '4', '4' ]);
  });

  it('every toGenerator() wrap restarts at start — each insert operation counts fresh', () => {
    const first = toGenerator(getPromptedCommand('sequence')!, { start: '10', step: '5' });
    assert.deepStrictEqual([ first.generate(), first.generate() ], [ '10', '15' ]);
    const second = toGenerator(getPromptedCommand('sequence')!, { start: '10', step: '5' });
    assert.strictEqual(second.generate(), '10', 'a fresh wrap must not continue the previous counter');
  });

  it('ignores GenerateOptions — a sequence value has no date to format', () => {
    const generator = toGenerator(getPromptedCommand('sequence')!, { start: '1', step: '1' });
    assert.strictEqual(generator.generate({ dateFormat: 'unixSeconds' }), '1');
  });

  it('needs no randomness — the sequence is identical with or without a seed', () => {
    seed(1);
    const seeded = toGenerator(getPromptedCommand('sequence')!, { start: '3', step: '3' });
    const first = [ seeded.generate(), seeded.generate() ];
    const unseeded = toGenerator(getPromptedCommand('sequence')!, { start: '3', step: '3' });
    assert.deepStrictEqual([ unseeded.generate(), unseeded.generate() ], first);
  });
});
