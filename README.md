# Random, Fake & Mock Data Generator

[![version][version svg]][package]
[![installs][installs svg]][package]
[![downloads][downloads svg]][package]
[![ratings][ratings svg]][package]
[![license][license svg]][repo]
[![vscode][vscode svg]][package]

[version svg]: https://vsmarketplacebadges.dev/version-short/electreefrying.insert-random-text.png
[installs svg]: https://vsmarketplacebadges.dev/installs/electreefrying.insert-random-text.png
[downloads svg]: https://vsmarketplacebadges.dev/downloads/electreefrying.insert-random-text.png
[ratings svg]: https://vsmarketplacebadges.dev/rating-short/ElecTreeFrying.insert-random-text.png
[license svg]: https://img.shields.io/github/license/ElecTreeFrying/insert-random-text
[vscode svg]: https://img.shields.io/badge/vscode-%3E%3D1.97.0-blue
[package]: https://marketplace.visualstudio.com/items?itemName=ElecTreeFrying.insert-random-text
[repo]: https://github.com/ElecTreeFrying/insert-random-text

> **Fill every cursor with realistic fake data — a _different_ value in each, in one step.**

**Names** · **Emails** · **Addresses** · **Finance** · **Git** · **Dates** · **UUIDs** · **Lorem ipsum** · **Mock JSON**

Drop a multi-cursor selection down a column and fill every row with a _different_ realistic value in one step — names, emails, IDs, dates, prices, whatever the column needs. All generated right where you're typing: no website, no signup, fully offline.

**Perfect for** test fixtures & database seeds · mock API responses · whole CSV / JSON / SQL datasets · UI placeholder & Storybook props · throwaway IDs, addresses & credentials.

![Random, Fake & Mock Data Generator demo](images/playback.gif "Insert random data at the cursor")

[**See the full specification**][SPEC]

[SPEC]: SPEC.md

---

## Highlights

- **Fill every cursor at once** — a _different_ value in each, in one step. The fastest way to seed a table, an array, or a fixture.
- **130+ realistic types** — stop hand-typing fake data: identity, finance, git, system, network, and more across 20 categories (full list below).
- **Six locales** — names, addresses & text in English, German, French, Spanish, Brazilian Portuguese, or Japanese. One setting, no reload.
- **Whole records in one shot** — multi-select fields and drop a `{ name, email, phone }` object, a SQL `INSERT` row, or a CSV line at every cursor. Scales with bulk count.
- **Whole datasets in one command** — **Generate Dataset…** builds up to 100,000 rows of JSON, CSV (with a header), or SQL `INSERT`s and opens them as a new file. No signup, no row caps, no export button — instant and offline.
- **Anonymize in place** — select real data and **Randomize Selection** re-rolls every letter and digit where it stands: `3.14` → `8.77`, `Bob@x.io` → `Kqe@v.zt`. Shapes intact, secrets gone.
- **Reproducible when you need it** — set a seed, get the same values every run — stable tests and snapshots.
- **Drops straight into code** — optional language-aware quoting and a trailing newline, so values land as valid syntax in arrays, JSON, SQL, and configs.
- **Stays in your editor** — fully offline, no account, nothing pasted from a website.
- **Or skip the editor entirely** — Clipboard mode copies a value straight to your clipboard (filenames, terminals, anywhere).
- **Configure from the Command Palette** — insert type, quotes, bulk count, output format, seed, and locale, without ever opening Settings.
- **Powered by [Faker][faker]** — coherent, realistic data, not random noise.

[faker]: https://fakerjs.dev

---

## Quick start

1. Open the Command Palette — <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>
2. Type **Insert Random**, then pick a type — or run **Insert Random: Pick…** to browse all 130+.
3. It drops in at every cursor. Multi-select a column first to fill every row at once.

No setup required — tweak quotes, bulk count, output format, seed, and locale whenever you want them.

---

## What it generates

**130+ types across 20 categories** — every one is a direct `Insert Random:` command *and* a Quick Pick entry.

| Category | Types |
|---|---|
| **Identity** (17) | Full Name · First Name · Middle Name · Last Name · Name Prefix · Name Suffix · Username · Display Name · Email · Phone · Sex · Gender · Bio · Zodiac Sign · Job Title · Job Type · Job Area |
| **Numbers** (6) | Number · Float · Boolean · Hex Number · Binary Number · Octal Number |
| **Text** (12) | String · Alpha String · Numeric String · Word · Words · Sentence · Slug · Lorem Paragraph · Hacker Phrase · Emoji · Book Title · Book Author |
| **Time** (8) | Date · Past Date · Future Date · Recent Date · Soon Date · Birthdate · Weekday · Month |
| **Location** (15) | Country · Country Code · State · State Abbreviation · County · City · Zip Code · Street Name · Street Address · Secondary Address · Building Number · Direction · Latitude · Longitude · Time Zone |
| **Network** (11) | IP Address · IPv6 Address · MAC Address · URL · Domain Name · Port · Protocol · HTTP Method · HTTP Status Code · User Agent · JWT |
| **Media** (2) | Image URL · Avatar URL |
| **Design** (4) | Color (hex) · Color (rgb) · Color (hsl) · Color Name |
| **Security** (1) | Password |
| **IDs** (5) | UUID · ULID · Nano ID · MongoDB ObjectId · Hash |
| **Nature** (6) | Animal · Dog Breed · Cat Breed · Bird Species · Fish Species · Horse Breed |
| **Company** (3) | Company Name · Catch Phrase · Buzz Phrase |
| **Commerce** (7) | Product · Product Name · Price · Department · Product Material · Product Description · ISBN |
| **Finance** (13) | Amount · Currency Code · Currency Name · Currency Symbol · Credit Card Number · Credit Card CVV · IBAN · BIC · Account Number · Routing Number · Bitcoin Address · Ethereum Address · PIN |
| **Git** (3) | Git Branch · Git Commit SHA · Git Commit Message |
| **System** (6) | File Name · File Path · File Extension · MIME Type · Semver · Cron Expression |
| **Vehicle** (5) | Vehicle · Vehicle Manufacturer · Vehicle Model · VIN · License Plate (VRM) |
| **Food** (5) | Dish · Ingredient · Fruit · Vegetable · Cuisine |
| **Music** (4) | Song Name · Music Genre · Artist · Album |
| **Travel** (4) | Airline · Airport · Flight Number · Seat |

See [SPEC — §Data Catalog][SPEC-catalog] for every type with its registry id, command id, and faker source.

[SPEC-catalog]: SPEC.md#data-catalog

---

## Settings

Change any of these from the [Commands](#commands) below, or in VS Code Settings.

| Setting | Options | Default | What it does |
|---|---|---|---|
| `insertType` | `Cursor` · `Top` · `Clipboard` | `Cursor` | Where values go — each cursor, the top of the file, or the clipboard. |
| `insertRandomText.uniquePerCursor` | `true` · `false` | `true` | A different value at each cursor (multi-cursor fill), or the same value repeated. |
| `insertRandomText.strictUnique` | `true` · `false` | `false` | Re-draw duplicates so values meant to differ within one insert really do — bulk values, and across cursors when `uniquePerCursor` is on. A small pool (booleans, weekdays) that runs out keeps its duplicate. |
| `insertRandomText.bulkCount` | `1`–`1000` | `1` | How many values to insert at each cursor. |
| `insertRandomText.outputFormat` | `plain` · `jsonArray` · `quotedList` | `plain` | How bulk values render — one per line, a JSON array, or a quoted comma-separated list. |
| `insertRandomText.dateFormat` | `iso` · `isoDate` · `isoTime` · `unixSeconds` · `unixMillis` | `iso` | How the timestamp Time types render — full ISO 8601, date only, time only, or Unix seconds/milliseconds. |
| `insertRandomText.recordFormat` | `json` · `sql` · `csv` | `json` | Shape for **Insert Random: Record…** — a JSON object, a SQL INSERT row, or a CSV line. |
| `insertRandomText.recordSqlTable` | any string | `table` | Table name used by the SQL record shape (when `recordFormat` is `sql`). |
| `insertRandomText.templates` | object: name → template | `{}` | Your saved faker templates — shown in a **Templates** group at the top of **Insert Random: Pick…**. See [Your own data](#your-own-data). |
| `insertRandomText.customLists` | object: name → string array | `{}` | Your own value lists — shown in a **Custom Lists** group at the top of **Pick…**, and available as **Record…** fields. See [Your own data](#your-own-data). |
| `insertRandomText.seed` | any number, or empty | _(empty)_ | Reproducible output — the same seed yields the same values every run; empty = random. |
| `insertRandomText.locale` | `en` · `de` · `fr` · `es` · `pt_BR` · `ja` | `en` | Language/region generated data draws from — names, addresses, words and more come out localized. |
| `withQuote` | `true` · `false` | `true` | Wrap each inserted value in quotes. |
| `withNewLine` | `true` · `false` | `true` | Append a newline after each value. |
| `insertRandomText.contextMenu.enabled` | `true` · `false` | `false` | Add an "Insert Random" submenu to the editor right-click menu. |

See [SPEC — §Configuration Reference][SPEC-config] for every setting with its exact type, default, and resolution rules, and [§Quote Wrapping & Language-Aware Quoting][SPEC-quotes] for the full language buckets.

[SPEC-config]: SPEC.md#configuration-reference
[SPEC-quotes]: SPEC.md#quote-wrapping--language-aware-quoting

### How the key settings behave

A few settings are easier to *see* than to describe.

**`outputFormat`** — how bulk values (bulk count > 1) render at each cursor. Two values, `Kohler` and `Reilly` (quotes follow the file's language — double in most, single in SQL; `jsonArray` always emits valid JSON):

| Format | Result |
|---|---|
| `plain` | `"Kohler"`, then `"Reilly"` on the next line |
| `jsonArray` | `[ "Kohler", "Reilly" ]` |
| `quotedList` | `"Kohler", "Reilly"` |

**`recordFormat`** — the shape **Insert Random: Record…** composes your ticked fields into. Two fields, `firstName` and `email`, with `recordSqlTable` set to `users`:

| Shape | Result |
|---|---|
| `json` | `{ "firstName": "Cooper", "email": "Noe.Dibbert@yahoo.com" }` |
| `sql` | `INSERT INTO users (firstName, email) VALUES ('Cooper', 'Noe.Dibbert@yahoo.com');` |
| `csv` | `Cooper,Noe.Dibbert@yahoo.com` |

Records escape by shape, not by the file's language — and a bulk count stacks them: `json` wraps into an array, `sql` emits one `INSERT` per line, `csv` one line per record.

**`dateFormat`** — how the timestamp Time types (Date, Past/Future/Recent/Soon Date, Birthdate, and **Date (Between…)**) render, everywhere they're drawn — single inserts and record fields alike. One drawn instant, five renderings:

| Format | Result |
|---|---|
| `iso` | `2026-07-02T12:34:56.789Z` |
| `isoDate` | `2026-07-02` |
| `isoTime` | `12:34:56` |
| `unixSeconds` | `1782995696` |
| `unixMillis` | `1782995696789` |

Weekday and Month are names, not timestamps — they're unaffected.

**`locale`** — the language/region every type draws from. The same "insert first name · street address" under four locales:

| Locale | Result |
|---|---|
| `en` (default) | `Ignatius` · `34683 Courtney Lakes` |
| `de` | `Jonna` · `Im Nesselrader Kamp 346` |
| `fr` | `Danielle` · `12 Boulevard de Presbourg` |
| `ja` | `愛菜` · `5丁目1番3号` |

Templates, patterns, and records follow it too; a type without localized data (UUIDs, numbers, …) falls back to English. Seeded runs stay reproducible per locale.

**Automatic quoting** — the *same* "insert email" adapts to the file's language, so the result is always valid syntax, no setting required:

- `.json` · `.go` · `.rs` · `.js` · `.py` → `"jane@example.com"` — double quotes
- `.sql` → `'jane@example.com'`, and an embedded apostrophe doubles: `O'Brien` → `'O''Brien'`

**`insertType`** — where the value lands:

- **Cursor** — a fresh value at *every* cursor; fill a whole column in one step
- **Top** — one block dropped at line 1
- **Clipboard** — copies a bare value, inserts nothing (handy for filenames, terminals)

---

## Commands

Open the Command Palette (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>P</kbd>) and type **Insert Random**.

| Command | What it does |
|---|---|
| **Insert Random: Pick…** | Choose any type — led by your saved templates and custom lists, when you've defined some — from a grouped, searchable menu, then insert at every cursor. |
| **Insert Random: Record…** | Multi-select fields (catalog types and your custom lists) and insert them together as one record — a JSON object, SQL row, or CSV line — at every cursor (or the top / clipboard, per your insert type). |
| **Insert Random: Generate Dataset…** | Pick fields, a format, and a row count — up to 100,000 rows of JSON, CSV (with a header row), or SQL `INSERT`s open as a new file. See [Generate whole datasets](#generate-whole-datasets). |
| **Insert Random: Number (Range…) / Float (Range…) / String (Length…) / Date (Between…) / Words (Count…) / Sentences (Count…) / Paragraphs (Count…) / UUID (Format…) / Password (Options…) / Phone (Format…)** | Parameterized types — enter a min & max, a length, a from/to date, or a lorem count in input boxes, or pick a format from a Quick Pick (UUID casing / braces / dashes, password length & symbols, phone style), and the value is generated to your spec, through the same pipeline (multi-cursor, bulk, quoting, seed). Your last inputs and picks are remembered; Esc cancels cleanly. |
| **Insert Random: From Template… / From Pattern…** | Free-form types — write your own faker template or regex-like pattern and every cursor gets a fresh rendering. See [Templates & patterns](#templates--patterns). |
| **Insert Random: Randomize Selection** | Anonymize in place — every selected letter and digit is re-rolled in kind (digits stay digits, letters keep their case, punctuation doesn't move), each selection replaced where it stands. See [Anonymize in place](#anonymize-in-place). |
| **Insert Random: _‹Type›_** | A direct command for every type — e.g. *Insert Random: Email*, *Insert Random: UUID*, *Insert Random: Credit Card Number*. |
| **Insert Random: Set Insert Type / Output Format / Date Format / Record Format / Locale** | Pick the value from a Quick Pick. |
| **Insert Random: Set Bulk Count / Set Seed / Set Record SQL Table** | Enter the value in an input box. |
| **Insert Random: Toggle Wrap With Quotes / Trailing New Line / Unique Value Per Cursor / Strict Unique / Editor Context Menu** | Flip a setting on or off. |
| **Insert Random: Manage Templates / Manage Custom Lists** | Jump to the setting where your saved templates / custom lists live. See [Your own data](#your-own-data). |
| **Insert Random: Reset Settings to Defaults** | Restore every setting to its default — your saved templates and custom lists are kept. |

See [SPEC — §Commands][SPEC-commands] for the two command namespaces and back-compat notes, [§Insert Targets][SPEC-targets] for exactly how Cursor / Top / Clipboard behave, and [§Multi-Field Records][SPEC-records] for the record composer.

[SPEC-commands]: SPEC.md#commands
[SPEC-targets]: SPEC.md#insert-targets
[SPEC-records]: SPEC.md#multi-field-records

### Templates & patterns

When no built-in type fits, write your own — one input box exposes faker's entire surface:

- **Insert Random: From Template…** — mustache-style placeholders, re-rendered with fresh values at every cursor and bulk item:
  `{{person.firstName}} <{{internet.email}}>` → `Jane <Vicky.DAmore99@gmail.com>`
- **Insert Random: From Pattern…** — a regex-like pattern (faker supports a limited subset: character classes, ranges, quantifiers):
  `[A-Z]{3}-[0-9]{4}` → `WUZ-7314`

Input is validated as you type by test-rendering it — a typo shows faker's error plus a working example right in the box, and nothing is inserted until it renders. Your last template and pattern are remembered and prefilled.

### Your own data

Save the templates you reuse, and the values only your project knows, straight into Settings — they appear at the **top** of **Insert Random: Pick…**, ahead of the catalog:

```jsonc
"insertRandomText.templates": {
  "invoice": "INV-{{string.numeric(4)}}",
  "contact": "{{person.fullName}} <{{internet.email}}>"
},
"insertRandomText.customLists": {
  "environment": [ "dev", "staging", "production" ],
  "plan": [ "free", "pro", "enterprise" ]
}
```

- **Templates** render through faker on every insert — same syntax as [From Template…](#templates--patterns), so every cursor and bulk item gets fresh values.
- **Custom lists** draw one random item per insert, and also show up as **Record…** fields — the name becomes the field key, so picking `environment` next to `Email` yields `{ "environment": "staging", "email": "…" }`.
- **Insert Random: Manage Templates / Manage Custom Lists** jump straight to these settings. Both survive **Reset Settings to Defaults** — they're your data, not tuning.

Everything rides the normal pipeline: multi-cursor, bulk count, quoting, and seed all apply.

### Generate whole datasets

Need a file of test data, not a value at the cursor? **Insert Random: Generate Dataset…** walks three quick steps — pick fields (your [custom lists](#your-own-data) included), pick a format, enter a row count — and opens the result as a new untitled file, ready to save:

- **JSON** — an array of objects, one record per line.
- **CSV** — one line per record, led by a **header row** of the field names.
- **SQL** — one `INSERT INTO your_table (…) VALUES (…);` per record, using your configured table name.

Up to **100,000 rows**, generated locally in an instant — no signup, no row caps, no export step, no data leaving your editor. The format pick starts on your `recordFormat` setting, the row count starts at your bulk count, and [locale, seed](#settings), and date format all apply — a seeded run regenerates the identical dataset every time. Works with no editor open.

### Anonymize in place

Pasted real data into a fixture, log, or bug report? Select it and run **Insert Random: Randomize Selection** — each selection is replaced by a same-shape randomization: digits stay digits, letters keep their case, punctuation and layout don't move.

```
jane.doe+prod@acme.com  →  wqzt.kfa+xjvn@ublr.pce
```

- Works on every non-empty selection at once — multi-select a column of secrets and scrub them in one step.
- It's a replacement, not an insertion: quoting, bulk count, and the insert type don't apply. The [seed](#settings) does, so a seeded run scrubs reproducibly.
- Also in the editor right-click menu, when the context-menu submenu is enabled.

### Keyboard shortcuts

This extension ships **no default keyboard shortcuts** — with 130+ commands, presetting a few would only collide with bindings you already use. Bind the types you reach for most, instead:

1. Open **Keyboard Shortcuts** (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>K</kbd> <kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>S</kbd>).
2. Search **Insert Random**.
3. Click the ✎ pencil next to any command — e.g. *Insert Random: UUID* or *Insert Random: Pick…* — and press your combo.

**Tip:** bind **Insert Random: Pick…** to a single shortcut and you get keyboard-fast access to *every* type through its searchable menu.

---

## Installation

**Requires VS Code 1.97.0 or later.**

- **Marketplace:** Extensions view (<kbd>Cmd</kbd>/<kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>X</kbd>) → search **Random, Fake & Mock Data Generator** by _ElecTreeFrying_ → **Install**.
- **CLI:** `code --install-extension ElecTreeFrying.insert-random-text`
- **Direct:** [VS Code Marketplace listing][package]

---

## Compatibility

- **VS Code** 1.97.0 or later.
- **Compatible hosts:** Cursor, VSCodium, Code Server, and other forks that implement the VS Code API at the same engine version.
- **Platforms:** macOS, Windows, Linux.
- **Privacy:** No network calls, no telemetry — every value is generated locally.

---

## Troubleshooting

If a command doesn't insert, or a value looks wrong, please open an issue on [GitHub Issues][issues].

[issues]: https://github.com/ElecTreeFrying/insert-random-text/issues

---

## Changelog

See [CHANGELOG.md][changelog] for full release notes.

[changelog]: CHANGELOG.md

---

## Contributing

Contributions, bug reports, and feature requests are welcome in [GitHub Issues][issues].

---

## Support

**This extension is free and always will be.** If it's become part of your workflow, here are a few ways to give back:

- Star the repo on [GitHub][repo]
- Leave a review on the [VS Code Marketplace][reviews]
- Send a donation to any address below

[reviews]: https://marketplace.visualstudio.com/items?itemName=ElecTreeFrying.insert-random-text&ssr=false#review-details

| Network | Address |
|---|---|
| **Bitcoin** | `bc1q4j2uewfphjmca83905qv37vcl4jh8va5yupl7w` |
| **Solana** | `EHtTGyRoDAK44KBGrEoypAWyPpResHUqwufKnuLs7Tyy` |
| **Sui** | `0xcaf8ff4a65d7e35d961abd0203180013b7fe974d4fa0313e880c39c45ada2b09` |
| **ERC-20** (Ethereum / Base / Monad / Polygon / HyperEVM) | `0xd25f84Ed2F76dF2F0C8f1207402eF9e15b5d7855` |

---

## Related

- **[All extensions by ElecTreeFrying][all]** on the VS Code Marketplace.

[all]: https://marketplace.visualstudio.com/publishers/ElecTreeFrying

---

## License

[MIT][license]

[license]: https://marketplace.visualstudio.com/items/ElecTreeFrying.insert-random-text/license
