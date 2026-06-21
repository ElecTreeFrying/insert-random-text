import { faker } from './engine';

/** A single named data type the extension can generate and insert. */
export interface Generator {
  /** Stable identifier — used in command ids and registry lookup. */
  readonly id: string;
  /** Human-readable label shown in the Quick Pick. */
  readonly label: string;
  /** Quick Pick group heading this generator is listed under. */
  readonly group: string;
  /** When true, hidden from the Quick Pick (a back-compat-only generator). */
  readonly hidden?: boolean;
  /** Produce one fresh value. Called once per cursor — must never be memoized. */
  generate(): string;
}

/**
 * The generator registry — the single source of truth for what the extension can
 * produce. It drives generation, the contributed commands, and the Quick Pick, so
 * adding an entry here surfaces a new type everywhere at once.
 *
 * Ordered by group for a sensible Quick Pick; `hidden` entries (the legacy
 * Lorem/Hash size variants) are kept at the end and never shown in the picker.
 */
export const generators: readonly Generator[] = [
  // Identity
  { id: 'person', label: 'Full Name', group: 'Identity', generate: () => faker().person.fullName() },
  { id: 'firstName', label: 'First Name', group: 'Identity', generate: () => faker().person.firstName() },
  { id: 'lastName', label: 'Last Name', group: 'Identity', generate: () => faker().person.lastName() },
  { id: 'username', label: 'Username', group: 'Identity', generate: () => faker().internet.username() },
  { id: 'email', label: 'Email', group: 'Identity', generate: () => faker().internet.email() },
  { id: 'phone', label: 'Phone', group: 'Identity', generate: () => faker().phone.number() },

  // Numbers
  { id: 'number', label: 'Number', group: 'Numbers', generate: () => faker().number.int({ min: 0, max: 1000 }).toString() },
  { id: 'boolean', label: 'Boolean', group: 'Numbers', generate: () => faker().datatype.boolean().toString() },

  // Text — `string` is alphanumeric (symbol-free, so it survives quote-wrapping); `lorem` is randomized.
  { id: 'string', label: 'String', group: 'Text', generate: () => faker().string.alphanumeric(15) },
  { id: 'word', label: 'Word', group: 'Text', generate: () => faker().lorem.word() },
  { id: 'sentence', label: 'Sentence', group: 'Text', generate: () => faker().lorem.sentence() },
  { id: 'lorem', label: 'Lorem Paragraph', group: 'Text', generate: () => faker().lorem.paragraph() },

  // Time
  { id: 'date', label: 'Date', group: 'Time', generate: () => faker().date.anytime().toISOString() },

  // Location
  { id: 'country', label: 'Country', group: 'Location', generate: () => faker().location.country() },
  { id: 'city', label: 'City', group: 'Location', generate: () => faker().location.city() },
  { id: 'address', label: 'Street Address', group: 'Location', generate: () => faker().location.streetAddress() },

  // Network
  { id: 'ipv4', label: 'IP Address', group: 'Network', generate: () => faker().internet.ipv4() },
  { id: 'mac', label: 'MAC Address', group: 'Network', generate: () => faker().internet.mac() },
  { id: 'url', label: 'URL', group: 'Network', generate: () => faker().internet.url() },

  // Design / Security
  { id: 'color', label: 'Color (hex)', group: 'Design', generate: () => faker().color.rgb({ format: 'hex' }) },
  { id: 'password', label: 'Password', group: 'Security', generate: () => faker().internet.password() },

  // IDs
  { id: 'uuid', label: 'UUID', group: 'IDs', generate: () => faker().string.uuid() },
  { id: 'hash', label: 'Hash', group: 'IDs', generate: () => faker().string.hexadecimal({ length: 13, casing: 'lower', prefix: '' }) },

  // Nature
  { id: 'animal', label: 'Animal', group: 'Nature', generate: () => faker().animal.type() },

  // Back-compat sized variants — drive the legacy Lorem/Hash Small/Medium/Large commands only.
  { id: 'loremSmall', label: 'Lorem (small)', group: 'Text', hidden: true, generate: () => faker().lorem.sentence() },
  { id: 'loremMedium', label: 'Lorem (medium)', group: 'Text', hidden: true, generate: () => faker().lorem.paragraph() },
  { id: 'loremLarge', label: 'Lorem (large)', group: 'Text', hidden: true, generate: () => faker().lorem.paragraphs(3) },
  { id: 'hashSmall', label: 'Hash (7)', group: 'IDs', hidden: true, generate: () => faker().string.hexadecimal({ length: 7, casing: 'lower', prefix: '' }) },
  { id: 'hashMedium', label: 'Hash (17)', group: 'IDs', hidden: true, generate: () => faker().string.hexadecimal({ length: 17, casing: 'lower', prefix: '' }) },
  { id: 'hashLarge', label: 'Hash (27)', group: 'IDs', hidden: true, generate: () => faker().string.hexadecimal({ length: 27, casing: 'lower', prefix: '' }) },
];

const byId = new Map<string, Generator>(generators.map((generator) => [ generator.id, generator ]));

/** Look up a generator by id, or `undefined` if none matches. */
export function getGenerator(id: string): Generator | undefined {
  return byId.get(id);
}
