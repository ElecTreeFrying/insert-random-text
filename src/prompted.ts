import { formatTimestamp, GenerateOptions, Generator } from './catalog';
import { faker } from './engine';

/**
 * Parameterized ("prompted") insert commands — types that ask for parameters in
 * input boxes before inserting: Number (Range…), Float (Range…), String
 * (Length…), Date (Between…), Words/Sentences/Paragraphs (Count…).
 *
 * These are deliberately NOT catalog entries: the registry stays a list of
 * zero-argument generators, while each prompted command declares its input steps
 * here and is wrapped as a one-off {@link Generator} (via {@link toGenerator})
 * that rides the exact same insert pipeline — settings, quoting, bulk,
 * multi-cursor, and seed all apply. Pure by design: no `vscode` import — the
 * input-box walk lives in `extension.ts` (`runPrompted`), so validation and
 * rendering are checkable headless.
 */

/** One input box in a prompted command's flow. */
export interface PromptStep {
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
   * `opts` carries the per-call settings the pipeline threads in (dateFormat). */
  render(params: Readonly<Record<string, string>>, opts?: GenerateOptions): string;
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
function countStep(prompt: string): PromptStep {
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
 * The prompted-command registry. Fallbacks reproduce the matching zero-argument
 * catalog types (Number: 0–1000, Float: 0–1000 at 2 decimals, String: 15
 * alphanumeric chars), so accepting the prefills behaves like the plain command.
 * The lorem counts prefill 3 — faker's own words/paragraphs default.
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
  return {
    id: command.id,
    label: command.label,
    group: command.group,
    generate: (opts) => command.render(params, opts),
  };
}
