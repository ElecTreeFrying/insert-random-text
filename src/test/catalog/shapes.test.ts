import * as assert from 'assert';

import { generators, getGenerator } from '../../catalog';
import { load, seed } from '../../engine';

// Objective output-shape pins for every type whose value has a checkable structure (uuid, ipv4, VIN,
// two-decimal prices, …). generate.test.ts guarantees non-empty/fresh/seeded for the WHOLE catalog;
// this table adds the "is it the right KIND of value" layer for the ids that have one. Prose types
// (Dish, Catch Phrase, …) can't be shape-checked — their plausibility sweep lives in manual-qa.
type Shape = { ok: (value: string) => boolean; want: string };

const re = (pattern: RegExp, want: string): Shape => ({ ok: (v) => pattern.test(v), want });

const SHAPES: Record<string, Shape> = {
  // Identity
  email: re(/^[^\s@]+@[^\s@]+\.[^\s@]+$/, 'name@domain.tld'),
  sex: re(/^(male|female)$/, "'male' or 'female'"),

  // Numbers
  number: { ok: (v) => /^\d+$/.test(v) && Number(v) <= 1000, want: 'integer 0–1000' },
  float: { ok: (v) => /^\d+\.\d{2}$/.test(v) && Number(v) <= 1000, want: 'two-decimal number 0–1000' },
  boolean: re(/^(true|false)$/, "'true' or 'false'"),
  hexNumber: { ok: (v) => /^[0-9a-f]+$/.test(v) && parseInt(v, 16) <= 0xffffff, want: 'lowercase hex ≤ ffffff' },
  binary: { ok: (v) => /^[01]+$/.test(v) && parseInt(v, 2) <= 255, want: 'binary digits ≤ 255' },
  octal: { ok: (v) => /^[0-7]+$/.test(v) && parseInt(v, 8) <= 511, want: 'octal digits ≤ 511' },

  // Text
  string: re(/^[A-Za-z0-9]{15}$/, '15 alphanumeric chars'),
  alpha: re(/^[A-Za-z]{10}$/, '10 letters'),
  numeric: re(/^\d{10}$/, '10 digits'),
  word: re(/^\S+$/, 'a single token'),
  words: { ok: (v) => { const n = v.split(' ').length; return n >= 3 && n <= 6; }, want: '3–6 space-separated words' },
  sentence: re(/^[A-Z].*\.$/, 'capitalized, period-terminated'),
  slug: re(/^[a-z0-9]+(-[a-z0-9]+)*$/, 'kebab-case'),

  // Time — the six timestamp generators are pinned per-format in date-format.test.ts; names only here.
  weekday: re(/^[A-Z][a-z]+day$/, 'an English weekday name'),
  month: re(/^[A-Z][a-z]+$/, 'a capitalized month name'),

  // Location
  countryCode: re(/^[A-Z]{2}$/, '2-letter code'),
  stateAbbr: re(/^[A-Z]{2}$/, '2-letter abbreviation'),
  zipCode: re(/^\d{5}(-\d{4})?$/, 'US zip'),
  buildingNumber: re(/^\d+$/, 'digits'),
  latitude: { ok: (v) => Math.abs(Number(v)) <= 90 && v.trim() !== '' && !Number.isNaN(Number(v)), want: 'signed decimal within ±90' },
  longitude: { ok: (v) => Math.abs(Number(v)) <= 180 && v.trim() !== '' && !Number.isNaN(Number(v)), want: 'signed decimal within ±180' },
  timeZone: { ok: (v) => v.includes('/') && !v.includes(' '), want: 'IANA zone (Area/City)' },
  direction: re(/^[A-Za-z]+$/, 'a cardinal/ordinal name'),

  // Network
  ipv4: { ok: (v) => /^(\d{1,3}\.){3}\d{1,3}$/.test(v) && v.split('.').every((o) => Number(o) <= 255), want: 'dotted quad, octets ≤ 255' },
  ipv6: re(/^[0-9a-f]{1,4}(:[0-9a-f]{1,4}){7}$/, '8 colon-separated hex groups'),
  mac: re(/^([0-9a-f]{2}:){5}[0-9a-f]{2}$/, 'colon-separated MAC'),
  url: re(/^https?:\/\/\S+$/, 'http(s) URL'),
  domainName: re(/^[^\s/]+\.[^\s/]+$/, 'bare domain'),
  port: { ok: (v) => /^\d+$/.test(v) && Number(v) <= 65535, want: 'integer ≤ 65535' },
  protocol: re(/^https?$/, "'http' or 'https'"),
  httpMethod: re(/^[A-Z]+$/, 'an uppercase HTTP verb'),
  httpStatus: { ok: (v) => /^\d{3}$/.test(v) && Number(v) >= 100 && Number(v) <= 599, want: '3-digit status 1xx–5xx' },
  jwt: re(/^[\w-]+\.[\w-]+\.[\w-]+$/, 'three dot-separated base64url segments'),

  // Media
  imageUrl: re(/^https?:\/\/\S+$/, 'image URL'),
  avatarUrl: re(/^https?:\/\/\S+$/, 'avatar URL'),

  // Design
  color: re(/^#[0-9a-f]{6}$/, '#rrggbb'),
  rgb: re(/^rgb\([\d, ]+\)$/, 'rgb(r, g, b)'),
  hsl: re(/^hsl\(\d+deg [\d.]+% [\d.]+%\)$/, 'hsl(Ndeg N% N%)'),

  // Security
  password: re(/^\S{15}$/, '15 non-space chars'),

  // IDs
  uuid: re(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/, '8-4-4-4-12 hex'),
  ulid: re(/^[0-9A-HJKMNP-TV-Z]{26}$/, '26 Crockford-base32 chars'),
  nanoid: re(/^[A-Za-z0-9_-]{21}$/, '21 URL-safe chars'),
  mongodbObjectId: re(/^[0-9a-f]{24}$/, '24 lowercase hex'),
  hash: re(/^[0-9a-f]{13}$/, '13 lowercase hex'),

  // Commerce / Finance
  price: re(/^\d+\.\d{2}$/, 'two-decimal price'),
  amount: re(/^\d+\.\d{2}$/, 'two-decimal amount'),
  currencyCode: re(/^[A-Z]{3}$/, 'ISO 4217 code'),
  creditCardCVV: re(/^\d{3,4}$/, '3–4 digits'),
  pin: re(/^\d{4}$/, '4 digits'),
  iban: re(/^[A-Z]{2}\d{2}[A-Z0-9]+$/, 'country-prefixed IBAN'),
  bic: re(/^[A-Z0-9]{8}([A-Z0-9]{3})?$/, '8 or 11 chars'),
  accountNumber: re(/^\d+$/, 'digits'),
  routingNumber: re(/^\d{9}$/, '9 digits'),
  ethereum: re(/^0x[0-9a-fA-F]{40}$/, '0x + 40 hex'),
  bitcoin: re(/^(1|3|bc1)[a-zA-Z0-9]{20,}$/, 'legacy/segwit address'),

  // Git / System
  gitCommitSha: re(/^[0-9a-f]{40}$/, '40 hex'),
  gitBranch: re(/^\S+$/, 'no spaces'),
  semver: re(/^\d+\.\d+\.\d+$/, 'x.y.z'),
  cron: { ok: (v) => { const n = v.split(' ').length; return n === 5 || n === 6; }, want: '5–6 space-separated fields' },
  mimeType: re(/^[\w.-]+\/[\w.+-]+$/, 'type/subtype'),
  fileExt: re(/^[a-z0-9]+$/, 'bare extension'),

  // Vehicle / Travel
  vin: re(/^[A-HJ-NPR-Z0-9]{17}$/, '17-char VIN (no I/O/Q)'),
  flightNumber: re(/^\d{4}$/, '4 digits (leading zeros kept)'),
  seat: re(/^\d{1,2}[A-K]$/, 'row + letter, e.g. 23F'),

  // Hidden back-compat sizes — a command is their only entry point, so pin the size contract too.
  hashSmall: re(/^[0-9a-f]{7}$/, '7 lowercase hex'),
  hashMedium: re(/^[0-9a-f]{17}$/, '17 lowercase hex'),
  hashLarge: re(/^[0-9a-f]{27}$/, '27 lowercase hex'),
  loremSmall: re(/^[A-Z].*\.$/, 'one sentence'),
  loremMedium: re(/^[A-Z].*\.$/, 'one paragraph'),
  loremLarge: { ok: (v) => v.split('\n').length === 3, want: '3 newline-separated paragraphs' },
};

describe('catalog generators — output shapes', function () {
  this.timeout(20000);

  before(async () => { await load(); });

  it('every shape-table id still exists in the catalog (guards renames)', () => {
    for (const id of Object.keys(SHAPES)) {
      assert.ok(getGenerator(id), `shape table entry '${id}' has no catalog generator`);
    }
  });

  for (const [ id, shape ] of Object.entries(SHAPES)) {
    it(`'${id}' draws ${shape.want}`, () => {
      const generator = getGenerator(id)!;
      seed(20260702); // independent of table order — every id starts the same sequence.
      for (let draw = 0; draw < 25; draw++) {
        const value = generator.generate();
        assert.ok(shape.ok(value), `'${id}' draw ${draw} → ${JSON.stringify(value)} — expected ${shape.want}`);
      }
    });
  }

  it('every catalog generator is either shape-pinned here or covered by the non-empty guarantee', () => {
    // Not an assertion that SHAPES is exhaustive — prose types can't be shape-checked. This just keeps
    // the split visible: if the unpinned list grows past the known prose set, a new structured type
    // probably belongs in the table above.
    const unpinned = generators.filter((g) => !SHAPES[g.id]).map((g) => g.id);
    assert.ok(unpinned.length < generators.length / 2, `most of the catalog is unpinned (${unpinned.length}) — did the shape table rot?`);
  });
});
