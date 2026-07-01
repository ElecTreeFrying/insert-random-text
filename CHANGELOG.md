# Changelog

## v1.0.0 (2026-07-01)

The first stable release — a ground-up relaunch as **Random, Fake & Mock Data Generator**.

### Features

- Switched the random engine to [`@faker-js/faker`](https://fakerjs.dev) (single locale) for realistic, coherent data.
- Expanded the catalog to **~130 data types** — on top of the originals (names, email, UUID, dates, lorem, …), added company, commerce, finance (credit card, IBAN, currency, crypto), git, system/files, vehicle, food, music, travel, color variants, and richer identity / location / date / number / internet types, plus IDs like ULID & nanoid. Every type is a searchable command and a grouped Quick Pick entry.
- **Multi-cursor fill** — insert a different value at every cursor in one step.
- New **Insert Random: Pick…** command — choose any type from a searchable, grouped menu.
- **Clipboard insert type** — set `insertType` to `Clipboard` to copy a generated value to the clipboard instead of inserting it (no editor needed; resolves #4).
- **Automatic quoting** — inserted values wrap in the correct quote for the file's language with zero configuration, so they're always valid syntax: SQL dialects use single quotes and escape an embedded quote by doubling it (`'O''Brien'`); every other language (JSON, Go, Java, Rust, JS/TS, Python, and the rest) uses double quotes. No quote settings to configure.
- **Multi-field records** — new **Insert Random: Record…** command: multi-select any fields and insert them together as one record — a JSON object, a SQL `INSERT` row, or a CSV line — at every cursor. Set the shape with `insertRandomText.recordFormat` (`json` / `sql` / `csv`) and the SQL table name with `insertRandomText.recordSqlTable`. Respects bulk count (a JSON array / repeated rows), multi-cursor, seed, and the insert type (cursors / top of file / clipboard).
- New settings: `insertRandomText.uniquePerCursor`, `insertRandomText.seed` (reproducible output), `insertRandomText.bulkCount`, `insertRandomText.outputFormat` (`plain` / `jsonArray` / `quotedList`), `insertRandomText.recordFormat`, `insertRandomText.recordSqlTable`, and an opt-in editor context-menu submenu (`insertRandomText.contextMenu.enabled`).
- **Settings commands** — change any setting from the Command Palette: *Insert Random: Set Insert Type / Output Format / Record Format / Record SQL Table / Bulk Count / Seed*, *Toggle* commands for each boolean setting (Wrap With Quotes, Trailing New Line, Unique Value Per Cursor, Editor Context Menu), and *Reset Settings to Defaults*.

### Fixes

- Lorem is now genuinely randomized (previously a fixed substring of one hardcoded string).
- Random string is alphanumeric, so it no longer breaks quote-wrapping.
- Quote-wrapped values are now escaped, so a value containing the active quote character (e.g. `O'Brien`) stays a valid string literal.
- Removed the global notification-clearing side effect and a duplicate-draw bug in the animal command.

### Changes

- Removed the unused `loremSize`, `hashSize`, and `disableNotifs` settings.
- Existing `extension.insertRandom*` commands continue to work unchanged.
- Modernized the build (esbuild bundle; now requires VS Code 1.97+).

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
