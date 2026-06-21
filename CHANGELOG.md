# Changelog

## v1.0.0 (2026-06-28)

The first stable release — a ground-up relaunch as **Random & Fake Data Generator**.

### Features

- Switched the random engine to [`@faker-js/faker`](https://fakerjs.dev) (single locale) for realistic, coherent data.
- Expanded the catalog to ~24 data types — names, email, username, phone, UUID, hash, numbers, boolean, dates, country/city/address, IP/MAC/URL, color, password, words/sentences/lorem, and more.
- **Multi-cursor fill** — insert a different value at every cursor in one step.
- New **Insert Random: Pick…** command — choose any type from a searchable, grouped menu.
- New settings: `insertRandomText.uniquePerCursor`, `insertRandomText.seed` (reproducible output), `insertRandomText.bulkCount`, `insertRandomText.outputFormat` (`plain` / `jsonArray` / `quotedList`), and an opt-in editor context-menu submenu (`insertRandomText.contextMenu.enabled`).

### Fixes

- Lorem is now genuinely randomized (previously a fixed substring of one hardcoded string).
- Random string is alphanumeric, so it no longer breaks quote-wrapping.
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
