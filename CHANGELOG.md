# Changelog

## v1.0.0 (2026-07-12)

The first stable release — a ground-up relaunch as **Random, Fake & Mock Data Generator**.

### Features

- Switched the random engine to [`@faker-js/faker`](https://fakerjs.dev) for realistic, coherent data.
- Expanded the catalog to **~130 data types** — on top of the originals (names, email, UUID, dates, lorem, …), added company, commerce, finance (credit card, IBAN, currency, crypto), git, system/files, vehicle, food, music, travel, color variants, and richer identity / location / date / number / internet types, plus IDs like ULID & nanoid. Every type is a searchable command and a grouped Quick Pick entry.
- **Multi-cursor fill** — insert a different value at every cursor in one step.
- New **Insert Random: Pick…** command — choose any type from a searchable, grouped menu.
- **Clipboard insert type** — set `insertType` to `Clipboard` to copy a generated value to the clipboard instead of inserting it (no editor needed; resolves #4).
- **Automatic quoting** — inserted values wrap in the correct quote for the file's language with zero configuration, so they're always valid syntax: SQL dialects use single quotes and escape an embedded quote by doubling it (`'O''Brien'`); every other language (JSON, Go, Java, Rust, JS/TS, Python, and the rest) uses double quotes. No quote settings to configure.
- **Multi-field records** — new **Insert Random: Record…** command: multi-select any fields and insert them together as one record — a JSON object, a SQL `INSERT` row, or a CSV line — at every cursor. Set the shape with `insertRandomText.recordFormat` (`json` / `sql` / `csv`) and the SQL table name with `insertRandomText.recordSqlTable`. Respects bulk count (a JSON array / repeated rows), multi-cursor, seed, and the insert type (cursors / top of file / clipboard).
- **Generate whole datasets** — new **Insert Random: Generate Dataset…** command: pick fields (custom lists included), a format, and a row count, and up to **100,000 rows** open as a new untitled file — a JSON array (one record per line), SQL `INSERT` statements, or CSV **with a header row**. The format pick starts on your `recordFormat`, the row count on your bulk count (large counts confirm first); locale, seed, and date format apply, so a seeded run regenerates the identical dataset. Instant and offline, works with no editor open.
- New settings: `insertRandomText.uniquePerCursor`, `insertRandomText.strictUnique`, `insertRandomText.seed` (reproducible output), `insertRandomText.locale`, `insertRandomText.bulkCount`, `insertRandomText.outputFormat` (`plain` / `jsonArray` / `quotedList`), `insertRandomText.dateFormat`, `insertRandomText.recordFormat`, `insertRandomText.recordSqlTable`, and an opt-in editor context-menu submenu (`insertRandomText.contextMenu.enabled`).
- **Settings commands** — change any setting from the Command Palette: *Insert Random: Set Insert Type / Output Format / Date Format / Record Format / Record SQL Table / Bulk Count / Seed / Locale*, *Toggle* commands for each boolean setting (Wrap With Quotes, Trailing New Line, Unique Value Per Cursor, Strict Unique, Editor Context Menu), and *Reset Settings to Defaults*.
- New **Image URL** and **Avatar URL** types (new **Media** category) — UI placeholders and Storybook props — plus **MongoDB ObjectId** under IDs.
- **Parameterized types** — new *Insert Random: Number (Range…)*, *Float (Range…)*, *String (Length…)*, *Date (Between…)*, *Words (Count…)*, *Sentences (Count…)*, and *Paragraphs (Count…)* commands ask for a min & max, a length up to 1000, a from/to date (`YYYY-MM-DD` or full ISO 8601), or a lorem count up to 100 in validated input boxes, then insert through the normal pipeline (multi-cursor, bulk, quoting, seed all apply). Last-used inputs are remembered and prefilled; Esc cancels cleanly.
- **Format variants** — new *Insert Random: UUID (Format…)*, *Password (Options…)*, and *Phone (Format…)* commands: pick a UUID rendering (lowercase / UPPERCASE / braced / no dashes / UPPERCASE without dashes), a password length (8–128) with or without symbols, or a phone style (human / national / international) from a Quick Pick. The last pick is remembered and floats to the top next time; same pipeline and clean Esc-cancel as the other parameterized types.
- **Templates & patterns** — new *Insert Random: From Template…* and *From Pattern…* commands expose faker's entire surface through one input box: a mustache template (`{{person.firstName}} <{{internet.email}}>`) or a regex-like pattern (`[A-Z]{3}-[0-9]{4}`, faker's limited regex subset) is re-rendered with fresh values at every cursor and bulk item. Input is proven by test-rendering as you type — a typo shows faker's error plus a working example inline, and nothing inserts until it renders; the last template and pattern are remembered and prefilled.
- **Your own data** — two new settings put your data in the picker: `insertRandomText.templates` (named faker templates) and `insertRandomText.customLists` (named value lists) appear as **Templates** and **Custom Lists** groups at the *top* of *Insert Random: Pick…*, and custom lists double as *Record…* fields (the name becomes the field key). Everything rides the normal pipeline — multi-cursor, bulk, quoting, seed. New *Insert Random: Manage Templates* / *Manage Custom Lists* commands jump straight to the settings; malformed entries are skipped safely (logged to the console), and both settings survive *Reset Settings to Defaults*.
- **Sequences** — new *Insert Random: Sequence (Start/Step…)* command fills cursors with incrementing values: enter a start and a step (negative counts down) and 1, 2, 3… lands down your column — one counter runs through the cursors and bulk items of an insert, and the next insert restarts at your start. Deliberately not random — the multi-cursor machinery makes numbered columns free.
- **Runs in the browser** — the extension now ships a web build alongside the desktop one, so it works on [vscode.dev](https://vscode.dev) and github.dev; the web bundle carries no Node dependencies and generates everything in the browser, still fully offline.
- **Six locales** — new `insertRandomText.locale` setting (`en` / `de` / `fr` / `es` / `pt_BR` / `ja`): names, addresses, words and more come out in the chosen language, across everything — single inserts, records, templates and patterns. Switching applies to the next insert with no reload, seeded runs stay reproducible per locale, and a type without localized data falls back to English. Change it from the palette with *Insert Random: Set Locale*.
- **Anonymize in place, type-aware** — new *Insert Random: Randomize Selection* command replaces each selection where it stands: a selection that *is* an email, UUID, or ISO date/timestamp becomes a **fresh realistic fake of the same type** (a UUID stays a *valid* UUID — case and braces preserved; a date stays a real calendar date at its own precision), and everything else gets a same-shape randomization — digits become digits, letters keep their case, punctuation and layout don't move (`3.14` → `8.77`). Works across a multi-selection in one step, honors the seed for reproducible scrubs, and joins the editor right-click submenu.
- **Date format control** — new `insertRandomText.dateFormat` setting (`iso` / `isoDate` / `isoTime` / `unixSeconds` / `unixMillis`) renders every timestamp Time type (Date, Past/Future/Recent/Soon Date, Birthdate, Date (Between…)) as a full ISO 8601 timestamp, date only, time only, or Unix seconds/milliseconds — in single inserts and record fields alike (Weekday/Month are unaffected). Change it from the palette with *Insert Random: Set Date Format*.
- **Strict unique (opt-in)** — new `insertRandomText.strictUnique` setting: duplicates are re-drawn so values meant to differ within one insert really do — bulk values at a cursor, and values across cursors when `uniquePerCursor` is on. Honestly bounded: after 25 re-draws a small pool (booleans, weekdays) keeps its duplicate rather than hanging, and seeded runs stay reproducible. Flip it from the palette with *Insert Random: Toggle Strict Unique*.

### Fixes

- Inserted text no longer stays selected: after a Cursor-mode insert over a selection, the cursor now sits right after the inserted block — same as typing.
- Lorem is now genuinely randomized (previously a fixed substring of one hardcoded string).
- Random string is alphanumeric, so it no longer breaks quote-wrapping.
- Quote-wrapped values are now escaped, so a value containing the active quote character (e.g. `O'Brien`) stays a valid string literal.
- Removed the global notification-clearing side effect and a duplicate-draw bug in the animal command.

### Changes

- Removed the unused `loremSize`, `hashSize`, and `disableNotifs` settings.
- Existing `extension.insertRandom*` commands continue to work unchanged.
- Modernized the build (esbuild bundle; now requires VS Code 1.97+).
- Refreshed the marketplace listing: new icon, new description, added the **Testing** category, finalized the keyword set, a **Sponsor** button linking to the README's Support section, and a gallery banner tuned to the icon.

## v0.1.3 (2020-7-25)

### Changes

- updated readme

## v0.1.2 (2020-3-21)

### Changes

- updated readme

## v0.1.1 (2020-3-16)

### Feature

- toggle new line

### Changes

- added new configuration `withNewLine`

## v0.1.0 (2020-3-15)

- initial release
