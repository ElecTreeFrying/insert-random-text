import * as assert from 'assert';

import { CUSTOM_LISTS_GROUP, customListGenerators, TEMPLATES_GROUP, templateGenerators } from '../../custom';
import { load, seed } from '../../engine';

// The settings-defined data pools (insertRandomText.templates / .customLists) are wrapped as plain
// Generator objects here — pure (no vscode import), so the wrapping, rendering, and seeding are all
// checkable headless. The maps arrive pre-validated from configuration.ts (string values only), so this
// module never sees junk; extension.ts feeds the wrapped generators into the same insert pipeline as the
// catalog. The id doubles as the Record… field key, which is why it is the bare name, unprefixed.

describe('custom — saved templates as generators', function () {
  this.timeout(15000);

  // Rendering draws through the shared engine accessor, like every catalog generator.
  before(async () => {
    await load();
  });

  it('wraps each named template as a Generator in the Templates group, declaration order preserved', () => {
    const generatorsBuilt = templateGenerators({
      invoice: 'INV-{{string.numeric(4)}}',
      contact: '{{person.fullName}} <{{internet.email}}>',
    });
    assert.deepStrictEqual(
      generatorsBuilt.map(({ id, label, group }) => ({ id, label, group })),
      [
        { id: 'invoice', label: 'invoice', group: TEMPLATES_GROUP },
        { id: 'contact', label: 'contact', group: TEMPLATES_GROUP },
      ],
    );
  });

  it('an empty map wraps to an empty array (nothing saved → no group)', () => {
    assert.deepStrictEqual(templateGenerators({}), []);
  });

  it('generate() renders the template through faker', () => {
    const [ generator ] = templateGenerators({ invoice: 'INV-{{string.numeric(4)}}' });
    assert.match(generator.generate(), /^INV-\d{4}$/);
  });

  it('draws a fresh value per call — never memoized', () => {
    const [ generator ] = templateGenerators({ id: '{{string.alphanumeric(16)}}' });
    assert.notStrictEqual(generator.generate(), generator.generate());
  });

  it('is reproducible under a seed (draws ride the shared RNG)', () => {
    const [ generator ] = templateGenerators({ id: '{{string.alphanumeric(16)}}' });
    seed(4242);
    const first = generator.generate();
    seed(4242);
    assert.strictEqual(generator.generate(), first);
  });
});

describe('custom — custom lists as generators', function () {
  this.timeout(15000);

  before(async () => {
    await load();
  });

  it('wraps each named list as a Generator in the Custom Lists group, declaration order preserved', () => {
    const generatorsBuilt = customListGenerators({
      environment: [ 'dev', 'staging', 'production' ],
      team: [ 'ada', 'grace' ],
    });
    assert.deepStrictEqual(
      generatorsBuilt.map(({ id, label, group }) => ({ id, label, group })),
      [
        { id: 'environment', label: 'environment', group: CUSTOM_LISTS_GROUP },
        { id: 'team', label: 'team', group: CUSTOM_LISTS_GROUP },
      ],
    );
  });

  it('an empty map wraps to an empty array (nothing saved → no group)', () => {
    assert.deepStrictEqual(customListGenerators({}), []);
  });

  it('generate() draws only from the list', () => {
    const values = [ 'red', 'green', 'blue' ];
    const [ generator ] = customListGenerators({ colors: values });
    for (let draw = 0; draw < 25; draw++) {
      assert.ok(values.includes(generator.generate()), 'every draw must come from the list');
    }
  });

  it('a single-value list always draws that value', () => {
    const [ generator ] = customListGenerators({ only: [ 'the-one' ] });
    assert.strictEqual(generator.generate(), 'the-one');
  });

  it('is reproducible under a seed (draws ride the shared RNG)', () => {
    const [ generator ] = customListGenerators({ colors: [ 'red', 'green', 'blue', 'cyan', 'plum' ] });
    seed(31415);
    const first = [ generator.generate(), generator.generate(), generator.generate() ];
    seed(31415);
    const second = [ generator.generate(), generator.generate(), generator.generate() ];
    assert.deepStrictEqual(second, first);
  });
});
