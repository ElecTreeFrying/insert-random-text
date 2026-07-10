import { formatTimestamp, GenerateOptions, Generator } from './catalog';
import { faker } from './engine';

/**
 * Parameterized ("prompted") insert commands — types that ask for parameters in
 * input boxes or Quick Picks before inserting: Number (Range…), Float (Range…),
 * String (Length…), Date (Between…), Words/Sentences/Paragraphs (Count…),
 * UUID (Format…), Password (Options…), Phone (Format…), From Template…,
 * From Pattern…, Sequence (Start/Step…).
 *
 * These are deliberately NOT catalog entries: the registry stays a list of
 * zero-argument generators, while each prompted command declares its steps
 * here and is wrapped as a one-off {@link Generator} (via {@link toGenerator})
 * that rides the exact same insert pipeline — settings, quoting, bulk,
 * multi-cursor, and seed all apply. Pure by design: no `vscode` import — the
 * box/pick walk lives in `extension.ts` (`runPrompted`), so validation, pick
 * options, and rendering are checkable headless.
 */

/** One input box in a prompted command's flow. */
export interface InputStep {
  /** Step-kind discriminant; the input box is the default kind and may omit it. */
  readonly kind?: 'input';
  /** Params key; also the suffix of the last-used-value memory key. */
  readonly key: string;
  /** Input-box prompt text. */
  readonly prompt: string;
  /** Example text shown while the box is empty. */
  readonly placeholder: string;
  /** Prefill used when no last-used value is remembered. */
  readonly fallback: string;
  /**
   * `showInputBox`-shaped validation: an error message keeps the box open,
   * `undefined` accepts. `prior` holds the values accepted at earlier steps, so
   * later boxes can enforce cross-field rules (e.g. min ≤ max).
   */
  validate(input: string, prior: Readonly<Record<string, string>>): string | undefined;
}

/** One selectable option in a {@link PickStep}. */
export interface PickOption {
  /** Params value stored under the step's key (also what gets remembered). */
  readonly value: string;
  /** Quick Pick row label. */
  readonly label: string;
  /** Explanatory line under the label — an example rendering where possible. */
  readonly detail: string;
}

/** One Quick Pick in a prompted command's flow. A closed set of choices needs no
 * validation; options are declared fallback-first, so a virgin pick leads with it. */
export interface PickStep {
  readonly kind: 'pick';
  /** Params key; also the suffix of the last-pick memory key. */
  readonly key: string;
  /** Quick Pick placeholder text (the question). */
  readonly prompt: string;
  /** The choices, in display order. */
  readonly options: readonly PickOption[];
  /** Option value that acts as the default when no last pick is remembered. */
  readonly fallback: string;
}

/** One step in a prompted command's flow: an input box (the default) or a Quick Pick. */
export type PromptStep = InputStep | PickStep;

/** A palette command that prompts for parameters, then inserts one data type. */
export interface PromptedCommand {
  /** Stable identifier — the command id is `insertRandomText.<id>`. */
  readonly id: string;
  /** Human-readable label (the command title minus the `Insert Random:` prefix). */
  readonly label: string;
  /** Catalog group the type belongs with (informational — not in the Quick Pick). */
  readonly group: string;
  /** The input boxes, in order. Cancelling any one aborts the whole command. */
  readonly steps: readonly PromptStep[];
  /** Draw one fresh value from validated params. Called once per generate();
   * `opts` carries the per-call settings the pipeline threads in (dateFormat).
   * Exactly one of render/createRender is defined (a spec test enforces it). */
  render?(params: Readonly<Record<string, string>>, opts?: GenerateOptions): string;
  /** Stateful alternative to {@link render}: called once per insert operation
   * (inside {@link toGenerator}) to build the drawing closure, so consecutive
   * generate() calls can share state within that one insert — Sequence advances
   * its counter per cursor/bulk item — while every new insert starts fresh. */
  createRender?(params: Readonly<Record<string, string>>): (opts?: GenerateOptions) => string;
}

/** Parse a safe integer out of raw input-box text; `undefined` when it isn't one. */
function parseInteger(input: string): number | undefined {
  const trimmed = input.trim();
  if (trimmed === '') { return undefined; }
  const value = Number(trimmed);
  return Number.isSafeInteger(value) ? value : undefined;
}

/** Parse a finite number out of raw input-box text; `undefined` when it isn't one. */
function parseNumber(input: string): number | undefined {
  const trimmed = input.trim();
  if (trimmed === '') { return undefined; }
  const value = Number(trimmed);
  return Number.isFinite(value) ? value : undefined;
}

const DATE_INPUT = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?(Z|[+-]\d{2}:\d{2})?)?$/;

/** Parse `YYYY-MM-DD` or full ISO 8601 out of raw input-box text; `undefined` when
 * it isn't one. The shape gate keeps `new Date`'s looser parses (e.g. '5') out.
 * The calendar check is explicit because V8 rolls an impossible day over
 * (2026-02-31 → March 3) instead of rejecting it; a NaN check alone misses that. */
function parseDate(input: string): Date | undefined {
  const trimmed = input.trim();
  if (!DATE_INPUT.test(trimmed)) { return undefined; }
  const [ year, month, day ] = trimmed.slice(0, 10).split('-').map(Number);
  // Date.UTC(year, month, 0) is the last day of `month` (1-based here, 0-based in Date.UTC).
  if (month < 1 || month > 12 || day < 1 || day > new Date(Date.UTC(year, month, 0)).getUTCDate()) { return undefined; }
  const value = new Date(trimmed);
  return Number.isNaN(value.getTime()) ? undefined : value;
}

const INTEGER_ERROR = 'Enter a whole number (e.g. 42).';
const NUMBER_ERROR = 'Enter a number (e.g. 0.5).';
const DATE_ERROR = 'Enter a date as YYYY-MM-DD or full ISO 8601 (e.g. 2026-07-02 or 2026-07-02T12:00:00Z).';

function maxAtLeastMin(min: string): string {
  return `Max must be at least the min you entered (${min}).`;
}

const COUNT_ERROR = 'Enter a whole number between 1 and 100.';

/** The single count box shared by the lorem trio (words/sentences/paragraphs). */
function countStep(prompt: string): InputStep {
  return {
    key: 'count',
    prompt,
    placeholder: 'e.g. 3',
    fallback: '3',
    validate: (input) => {
      const value = parseInteger(input);
      return value !== undefined && value >= 1 && value <= 100 ? undefined : COUNT_ERROR;
    },
  };
}

/**
 * UUID post-transform for the uuidFormat command: a pure re-rendering of faker's
 * lowercase-dashed uuid string. Unknown formats fall through unchanged.
 */
export function formatUuid(uuid: string, format: string): string {
  switch (format) {
    case 'uppercase': return uuid.toUpperCase();
    case 'braced': return `{${uuid}}`;
    case 'noDashes': return uuid.replace(/-/g, '');
    case 'uppercaseNoDashes': return uuid.replace(/-/g, '').toUpperCase();
    default: return uuid; // 'lowercase' — faker's native rendering.
  }
}

/** Render a mustache template — faker's `helpers.fake` — for From Template…. */
function renderTemplate(template: string): string {
  return faker().helpers.fake(template);
}

/** Render a regex-subset pattern — faker's `helpers.fromRegExp` — for From Pattern…. */
function renderPattern(pattern: string): string {
  return faker().helpers.fromRegExp(pattern);
}

const TEMPLATE_EXAMPLE = '{{person.firstName}} <{{internet.email}}>';
const PATTERN_EXAMPLE = '[A-Z]{3}-[0-9]{4}';

/**
 * Shared validate for the free-form template/pattern boxes: the only authority
 * on whether such input renders is faker itself, so prove it with one test
 * render and surface faker's error plus a working example when it throws.
 * A render's structure is deterministic (only leaf values vary), so one success
 * here means insert-time renders cannot throw. Empty input needs the explicit
 * reject because faker renders '' to '' without complaint.
 */
function validateByRendering(
  input: string,
  noun: string,
  example: string,
  render: (value: string) => string,
): string | undefined {
  const trimmed = input.trim();
  if (trimmed === '') { return `Enter a ${noun} — e.g. ${example}`; }
  try {
    render(trimmed);
    return undefined;
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return `${message} — a working example: ${example}`;
  }
}

/**
 * The prompted-command registry. Fallbacks reproduce the matching zero-argument
 * catalog types (Number: 0–1000, Float: 0–1000 at 2 decimals, String: 15
 * alphanumeric chars, Password: 15 chars, and the lowercase / no-symbols / human
 * pick defaults), so accepting the prefills behaves like the plain command.
 * The lorem counts prefill 3 — faker's own words/paragraphs default — and the
 * template/pattern boxes prefill their documented examples.
 */
export const promptedCommands: readonly PromptedCommand[] = [
  {
    id: 'numberRange',
    label: 'Number (Range…)',
    group: 'Numbers',
    steps: [
      {
        key: 'min',
        prompt: 'Number range — the smallest value to draw (whole number).',
        placeholder: 'e.g. 0',
        fallback: '0',
        validate: (input) => (parseInteger(input) === undefined ? INTEGER_ERROR : undefined),
      },
      {
        key: 'max',
        prompt: 'Number range — the largest value to draw (whole number).',
        placeholder: 'e.g. 1000',
        fallback: '1000',
        validate: (input, prior) => {
          const value = parseInteger(input);
          if (value === undefined) { return INTEGER_ERROR; }
          return value < Number(prior.min) ? maxAtLeastMin(prior.min) : undefined;
        },
      },
    ],
    render: ({ min, max }) => faker().number.int({ min: Number(min), max: Number(max) }).toString(),
  },
  {
    id: 'floatRange',
    label: 'Float (Range…)',
    group: 'Numbers',
    steps: [
      {
        key: 'min',
        prompt: 'Float range — the smallest value to draw.',
        placeholder: 'e.g. 0',
        fallback: '0',
        validate: (input) => (parseNumber(input) === undefined ? NUMBER_ERROR : undefined),
      },
      {
        key: 'max',
        prompt: 'Float range — the largest value to draw (rendered with 2 decimals).',
        placeholder: 'e.g. 1000',
        fallback: '1000',
        validate: (input, prior) => {
          const value = parseNumber(input);
          if (value === undefined) { return NUMBER_ERROR; }
          const min = Number(prior.min);
          if (!Number.isFinite(min)) { return undefined; }
          if (value < min) { return maxAtLeastMin(prior.min); }
          // The draw is int(ceil(min·100) … floor(max·100)) / 100 — faker throws
          // when that integer range is empty, so reject exactly those inputs.
          if (Math.ceil(min * 100) > Math.floor(value * 100)) {
            return 'Range too narrow — it must contain a multiple of 0.01 (output has 2 decimals).';
          }
          return undefined;
        },
      },
    ],
    render: ({ min, max }) =>
      faker().number.float({ min: Number(min), max: Number(max), fractionDigits: 2 }).toFixed(2),
  },
  {
    id: 'stringLength',
    label: 'String (Length…)',
    group: 'Text',
    steps: [
      {
        key: 'length',
        prompt: 'String length — how many alphanumeric characters (1–1000).',
        placeholder: 'e.g. 15',
        fallback: '15',
        validate: (input) => {
          const value = parseInteger(input);
          return value !== undefined && value >= 1 && value <= 1000
            ? undefined
            : 'Enter a whole number between 1 and 1000.';
        },
      },
    ],
    render: ({ length }) => faker().string.alphanumeric(Number(length)),
  },
  {
    id: 'dateBetween',
    label: 'Date (Between…)',
    group: 'Time',
    steps: [
      {
        key: 'from',
        prompt: 'Date range — the earliest date (YYYY-MM-DD or full ISO 8601).',
        placeholder: 'e.g. 2020-01-01',
        fallback: '2020-01-01',
        validate: (input) => (parseDate(input) === undefined ? DATE_ERROR : undefined),
      },
      {
        key: 'to',
        prompt: 'Date range — the latest date (YYYY-MM-DD or full ISO 8601).',
        placeholder: 'e.g. 2030-12-31',
        fallback: '2030-12-31',
        validate: (input, prior) => {
          const value = parseDate(input);
          if (value === undefined) { return DATE_ERROR; }
          const from = parseDate(prior.from ?? '');
          if (from === undefined) { return undefined; }
          return value.getTime() < from.getTime()
            ? `To must be on or after the from date you entered (${prior.from}).`
            : undefined;
        },
      },
    ],
    // Rendered per the dateFormat setting, like the zero-argument Time generators.
    render: ({ from, to }, opts) => formatTimestamp(faker().date.between({ from, to }), opts?.dateFormat),
  },
  {
    id: 'wordsCount',
    label: 'Words (Count…)',
    group: 'Text',
    steps: [ countStep('Words — how many lorem words to insert (1–100).') ],
    render: ({ count }) => faker().lorem.words(Number(count)),
  },
  {
    id: 'sentencesCount',
    label: 'Sentences (Count…)',
    group: 'Text',
    steps: [ countStep('Sentences — how many lorem sentences to insert (1–100).') ],
    render: ({ count }) => faker().lorem.sentences(Number(count)),
  },
  {
    id: 'paragraphsCount',
    label: 'Paragraphs (Count…)',
    group: 'Text',
    steps: [ countStep('Paragraphs — how many lorem paragraphs to insert (1–100).') ],
    render: ({ count }) => faker().lorem.paragraphs(Number(count)),
  },
  {
    id: 'uuidFormat',
    label: 'UUID (Format…)',
    group: 'IDs',
    steps: [
      {
        kind: 'pick',
        key: 'format',
        prompt: 'UUID format — how the drawn UUID is rendered.',
        options: [
          { value: 'lowercase', label: 'Lowercase', detail: 'e.g. 9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' },
          { value: 'uppercase', label: 'UPPERCASE', detail: 'e.g. 9B1DEB4D-3B7D-4BAD-9BDD-2B0D7B3DCB6D' },
          { value: 'braced', label: 'Braced', detail: 'e.g. {9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d}' },
          { value: 'noDashes', label: 'No dashes', detail: 'e.g. 9b1deb4d3b7d4bad9bdd2b0d7b3dcb6d' },
          { value: 'uppercaseNoDashes', label: 'UPPERCASE, no dashes', detail: 'e.g. 9B1DEB4D3B7D4BAD9BDD2B0D7B3DCB6D' },
        ],
        fallback: 'lowercase',
      },
    ],
    render: ({ format }) => formatUuid(faker().string.uuid(), format),
  },
  {
    id: 'passwordOptions',
    label: 'Password (Options…)',
    group: 'Security',
    steps: [
      {
        key: 'length',
        prompt: 'Password length — how many characters (8–128).',
        placeholder: 'e.g. 15',
        fallback: '15',
        validate: (input) => {
          const value = parseInteger(input);
          return value !== undefined && value >= 8 && value <= 128
            ? undefined
            : 'Enter a whole number between 8 and 128.';
        },
      },
      {
        kind: 'pick',
        key: 'symbols',
        prompt: 'Password characters — include symbols?',
        options: [
          { value: 'no', label: 'No symbols', detail: 'Letters and digits only.' },
          { value: 'yes', label: 'Include symbols', detail: 'Letters, digits, and !@#$%^&*.' },
        ],
        fallback: 'no',
      },
    ],
    render: ({ length, symbols }) =>
      faker().internet.password({
        length: Number(length),
        pattern: symbols === 'yes' ? /[A-Za-z0-9!@#$%^&*]/ : /[A-Za-z0-9]/,
      }),
  },
  {
    id: 'phoneFormat',
    label: 'Phone (Format…)',
    group: 'Identity',
    steps: [
      {
        kind: 'pick',
        key: 'style',
        prompt: 'Phone format — which style to insert.',
        options: [
          { value: 'human', label: 'Human', detail: 'As people write them, e.g. 555.770.2411 x1234.' },
          { value: 'national', label: 'National', detail: 'Standardized national format, e.g. (555) 770-2411.' },
          { value: 'international', label: 'International', detail: 'E.164 format, e.g. +15557702411.' },
        ],
        fallback: 'human',
      },
    ],
    render: ({ style }) => faker().phone.number({ style: style as 'human' | 'national' | 'international' }),
  },
  {
    id: 'fromTemplate',
    label: 'From Template…',
    group: 'Custom',
    steps: [
      {
        key: 'template',
        prompt: 'Template — text with {{module.method}} placeholders; every cursor and bulk item re-renders with fresh values.',
        placeholder: `e.g. ${TEMPLATE_EXAMPLE}`,
        fallback: TEMPLATE_EXAMPLE,
        validate: (input) => validateByRendering(input, 'template', TEMPLATE_EXAMPLE, renderTemplate),
      },
    ],
    render: ({ template }) => renderTemplate(template),
  },
  {
    id: 'fromPattern',
    label: 'From Pattern…',
    group: 'Custom',
    steps: [
      {
        key: 'pattern',
        prompt: 'Pattern — a fresh string is drawn to match it at every cursor and bulk item.',
        placeholder: `e.g. ${PATTERN_EXAMPLE} — faker supports a limited regex subset (classes, ranges, quantifiers)`,
        fallback: PATTERN_EXAMPLE,
        validate: (input) => validateByRendering(input, 'pattern', PATTERN_EXAMPLE, renderPattern),
      },
    ],
    render: ({ pattern }) => renderPattern(pattern),
  },
  {
    id: 'sequence',
    label: 'Sequence (Start/Step…)',
    group: 'Numbers',
    steps: [
      {
        key: 'start',
        prompt: 'Sequence — the first value (whole number).',
        placeholder: 'e.g. 1',
        fallback: '1',
        validate: (input) => (parseInteger(input) === undefined ? INTEGER_ERROR : undefined),
      },
      {
        key: 'step',
        prompt: 'Sequence — how much each next value adds (whole number; negative counts down).',
        placeholder: 'e.g. 1',
        fallback: '1',
        validate: (input) => (parseInteger(input) === undefined ? INTEGER_ERROR : undefined),
      },
    ],
    // Not random at all — the one prompted command whose values must RELATE
    // across the cursors/bulk items of an insert: createRender builds one
    // counter per insert operation (1, 2, 3… down a column), and the next
    // insert restarts at start.
    createRender: ({ start, step }) => {
      let next = Number(start);
      return () => {
        const value = next;
        next += Number(step);
        return String(value);
      };
    },
  },
];

/** Look a prompted command up by id; undefined when the id is unknown. */
export function getPromptedCommand(id: string): PromptedCommand | undefined {
  return promptedCommands.find((command) => command.id === id);
}

/**
 * Wrap a completed prompt flow as a one-off {@link Generator} — the same
 * contract the catalog entries satisfy, so it feeds straight into the normal
 * insert path. `generate()` re-renders each call: a fresh draw per cursor and
 * per bulk item, seeded through the shared faker accessor.
 */
export function toGenerator(command: PromptedCommand, params: Readonly<Record<string, string>>): Generator {
  // A createRender command builds its closure HERE — once per insert operation —
  // so state (Sequence's counter) spans the cursors/bulk items of one insert
  // and resets on the next.
  const draw = command.createRender
    ? command.createRender(params)
    : (opts?: GenerateOptions) => command.render!(params, opts);
  return {
    id: command.id,
    label: command.label,
    group: command.group,
    generate: (opts) => draw(opts),
  };
}
